import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { jsonError, requireStaff, HttpError } from "@/lib/auth";
import { analyzeRoster } from "@/lib/roster";
import { birthHash } from "@/lib/crypto";
import { ensureSection } from "@/lib/sections";
import { audit } from "@/lib/audit";

// 확인 후 반영 — 같은 파일 내용을 서버에서 다시 점검하고, 오류 없는 행만 등록한다.
// 원본 CSV는 저장하지 않는다(요청 처리 후 메모리에서 사라짐).
export async function POST(req: NextRequest) {
  try {
    const head = await requireStaff({ head: true });
    const b = await req.json().catch(() => ({}));
    const { rows, missingCols } = await analyzeRoster({ text: b.text, base64: b.base64 });
    if (missingCols.length) throw new HttpError(400, `필수 열이 없습니다: ${missingCols.join(", ")}`);
    const ok = rows.filter((r) => r.errors.length === 0);

    // 학생
    const students = new Map<string, (typeof ok)[number]>();
    for (const r of ok) students.set(r.studentNo, r);
    const studentRows = Array.from(students.values()).map((r) => ({
      student_no: r.studentNo,
      name: r.name,
      department: r.department,
      birth_hash: birthHash(r.studentNo, r.birth!),
    }));
    const idByNo = new Map<string, string>();
    for (let i = 0; i < studentRows.length; i += 200) {
      const { data, error } = await db().from("students").upsert(studentRows.slice(i, i + 200), { onConflict: "student_no" }).select("id, student_no");
      if (error) throw error;
      for (const s of data ?? []) idByNo.set(s.student_no, s.id);
    }

    // 분반 + 수강
    const sectionCache = new Map<string, string>();
    let enrolled = 0;
    for (const r of ok) {
      const key = `${r.course}|${r.section}`;
      if (!sectionCache.has(key)) sectionCache.set(key, await ensureSection(r.course, r.section));
      const row: Record<string, unknown> = { student_id: idByNo.get(r.studentNo), section_id: sectionCache.get(key) };
      if (r.absenceWeeks) row.absence_weeks = r.absenceWeeks;
      const { error } = await db().from("enrollments").upsert(row, { onConflict: "student_id,section_id" });
      if (error) throw error;
      enrolled++;
    }
    await audit({ type: "staff", id: head.id, label: head.name }, "roster.upload", null, {
      students: studentRows.length,
      enrollments: enrolled,
      skippedRows: rows.length - ok.length,
    });
    return NextResponse.json({ ok: true, students: studentRows.length, enrollments: enrolled, skipped: rows.length - ok.length });
  } catch (e) {
    return jsonError(e);
  }
}

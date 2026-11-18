import { NextRequest, NextResponse } from "next/server";
import { db, BUCKET } from "@/lib/supabase";
import { jsonError, requireStaff, HttpError } from "@/lib/auth";
import { birthHash } from "@/lib/crypto";
import { normalizeBirth } from "@/lib/format";
import { ensureSection } from "@/lib/sections";
import { audit } from "@/lib/audit";
import { parseWeeks } from "@/lib/roster";

// 학생 한 명 추가 (또는 기존 학생에 과목·분반 추가)
export async function POST(req: NextRequest) {
  try {
    const head = await requireStaff({ head: true });
    const b = await req.json().catch(() => ({}));
    const studentNo = String(b.studentNo ?? "").trim();
    const name = String(b.name ?? "").trim();
    const department = String(b.department ?? "").trim();
    const course = String(b.course ?? "").trim();
    const section = String(b.section ?? "").trim();
    const birth = normalizeBirth(b.birth);
    if (!/^[A-Za-z0-9-]{4,20}$/.test(studentNo)) throw new HttpError(400, "학번 형식이 올바르지 않습니다.");
    if (!name || !department || !course || !section) throw new HttpError(400, "모든 칸을 입력해 주세요.");
    if (!birth) throw new HttpError(400, "생년월일 형식이 올바르지 않습니다 (예: 20030507).");

    const { data: st, error } = await db()
      .from("students")
      .upsert({ student_no: studentNo, name, department, birth_hash: birthHash(studentNo, birth) }, { onConflict: "student_no" })
      .select("id")
      .single();
    if (error) throw error;
    const sectionId = await ensureSection(course, section);
    const n = b.requiredCount === undefined || b.requiredCount === "" ? 3 : parseWeeks(b.requiredCount);
    if (n === null) throw new HttpError(400, "공가 주차는 1~3입니다.");
    const en = { student_id: st.id, section_id: sectionId, required_count: n };
    const r = await db().from("enrollments").upsert(en, { onConflict: "student_id,section_id" });
    if (r.error) throw r.error;
    await audit({ type: "staff", id: head.id, label: head.name }, "student.add", studentNo, { course, section });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}

// 학생 정보 수정 (이름·학과·생년월일) 또는 수강별 공가 주차(=과제 수) 수정
export async function PATCH(req: NextRequest) {
  try {
    const head = await requireStaff({ head: true });
    const b = await req.json().catch(() => ({}));
    if (b.enrollmentId) {
      const n = parseWeeks(b.requiredCount);
      if (n === null) throw new HttpError(400, "공가 주차는 1~3입니다.");
      const { data: en } = await db().from("enrollments").select("id, final_confirmed_at").eq("id", String(b.enrollmentId)).maybeSingle();
      if (!en) throw new HttpError(404, "대상을 찾을 수 없습니다.");
      if (en.final_confirmed_at) throw new HttpError(409, "최종 확인된 건은 바꿀 수 없습니다. 먼저 최종 확인을 취소해 주세요.");
      // 줄이려는 번호에 이미 제출된 파일이 있으면 막는다
      const { data: over } = await db().from("submissions").select("slot").eq("enrollment_id", en.id).gt("slot", n).limit(1);
      if (over?.length) throw new HttpError(409, `과제 ${n + 1}번 이후에 이미 제출된 파일이 있어 줄일 수 없습니다.`);
      const { error } = await db().from("enrollments").update({ required_count: n }).eq("id", en.id);
      if (error) throw error;
      await audit({ type: "staff", id: head.id, label: head.name }, "enrollment.update", en.id, { requiredCount: n });
      return NextResponse.json({ ok: true });
    }
    const { data: st } = await db().from("students").select("id, student_no").eq("id", String(b.studentId ?? "")).maybeSingle();
    if (!st) throw new HttpError(404, "학생을 찾을 수 없습니다.");
    const update: Record<string, unknown> = {};
    if (b.name) update.name = String(b.name).trim();
    if (b.department !== undefined) update.department = String(b.department).trim();
    if (b.birth) {
      const birth = normalizeBirth(b.birth);
      if (!birth) throw new HttpError(400, "생년월일 형식이 올바르지 않습니다.");
      update.birth_hash = birthHash(st.student_no, birth);
      update.failed_attempts = 0;
      update.locked_until = null;
    }
    if (b.unlock) {
      update.failed_attempts = 0;
      update.locked_until = null;
    }
    const { error } = await db().from("students").update(update).eq("id", st.id);
    if (error) throw error;
    await audit({ type: "staff", id: head.id, label: head.name }, "student.update", st.student_no, {
      fields: Object.keys(update).filter((k) => k !== "birth_hash"),
      birthChanged: !!b.birth,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}

// 학생 삭제 (studentId) 또는 특정 과목·분반에서만 제외 (enrollmentId). 제출 파일도 함께 지운다.
export async function DELETE(req: NextRequest) {
  try {
    const head = await requireStaff({ head: true });
    const b = await req.json().catch(() => ({}));
    let enrollmentIds: string[] = [];
    let target = "";
    if (b.enrollmentId) {
      enrollmentIds = [String(b.enrollmentId)];
      target = `enrollment:${b.enrollmentId}`;
    } else {
      const { data: st } = await db().from("students").select("id, student_no").eq("id", String(b.studentId ?? "")).maybeSingle();
      if (!st) throw new HttpError(404, "학생을 찾을 수 없습니다.");
      const { data: ens } = await db().from("enrollments").select("id").eq("student_id", st.id);
      enrollmentIds = (ens ?? []).map((e) => e.id);
      target = st.student_no;
    }
    if (enrollmentIds.length) {
      const { data: subs } = await db().from("submissions").select("storage_path").in("enrollment_id", enrollmentIds).not("storage_path", "is", null);
      if (subs?.length) await db().storage.from(BUCKET).remove(subs.map((s) => s.storage_path as string));
    }
    const { error } = b.enrollmentId
      ? await db().from("enrollments").delete().eq("id", String(b.enrollmentId))
      : await db().from("students").delete().eq("id", String(b.studentId));
    if (error) throw error;
    await audit({ type: "staff", id: head.id, label: head.name }, b.enrollmentId ? "enrollment.delete" : "student.delete", target);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}

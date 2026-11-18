import { NextRequest, NextResponse } from "next/server";
import { db, BUCKET } from "@/lib/supabase";
import { jsonError, requireStudent, HttpError } from "@/lib/auth";
import { extOf, MAX_FILE_BYTES, ruleFileName } from "@/lib/files";
import { assertQuota, checkSlotWritable } from "@/lib/studentUpload";
import { audit, notify } from "@/lib/audit";

// 2단계: 업로드가 끝난 파일을 실제 크기로 다시 확인하고 제출로 확정한다.
export async function POST(req: NextRequest) {
  try {
    const student = await requireStudent();
    const ticketId = String((await req.json().catch(() => ({}))).ticketId ?? "");
    const { data: t } = await db().from("upload_tickets").select("*").eq("id", ticketId).maybeSingle();
    if (!t || t.used_at || new Date(t.expires_at).getTime() < Date.now()) throw new HttpError(400, "업로드 링크가 만료되었습니다. 다시 올려 주세요.");

    const discard = async (msg: string, status = 400) => {
      await db().storage.from(BUCKET).remove([t.storage_path]);
      await db().from("upload_tickets").update({ used_at: new Date().toISOString() }).eq("id", t.id);
      throw new HttpError(status, msg);
    };

    let ctx;
    try {
      ctx = await checkSlotWritable(student.id, t.enrollment_id, t.slot);
    } catch (e) {
      await db().storage.from(BUCKET).remove([t.storage_path]);
      throw e;
    }
    const { section, courseName, settings, existing } = ctx;

    // 실제 업로드된 파일 크기 확인
    const dir = t.storage_path.slice(0, t.storage_path.lastIndexOf("/"));
    const fname = t.storage_path.slice(t.storage_path.lastIndexOf("/") + 1);
    const { data: listed } = await db().storage.from(BUCKET).list(dir, { search: fname, limit: 10 });
    const obj = listed?.find((o) => o.name === fname);
    if (!obj) throw new HttpError(400, "업로드된 파일을 찾을 수 없습니다. 다시 올려 주세요.");
    const size = Number(obj.metadata?.size ?? 0);
    if (size <= 0) await discard("빈 파일입니다.");
    if (size > MAX_FILE_BYTES) await discard("파일은 10MB 이하만 올릴 수 있습니다.", 413);
    try {
      await assertQuota(student.id, settings.student_quota_mb, size, existing?.id);
    } catch (e) {
      await discard(e instanceof Error ? e.message : "용량 초과", 413);
    }

    const fileName = ruleFileName(student.student_no, student.name, courseName, t.slot, extOf(t.storage_path));
    const now = new Date().toISOString();
    const row = {
      enrollment_id: t.enrollment_id,
      slot: t.slot,
      storage_path: t.storage_path,
      file_name: fileName,
      original_name: t.original_name,
      size_bytes: size,
      status: "submitted",
      reject_reason: null,
      submitted_at: now,
      reviewed_by: null,
      reviewed_at: null,
      file_deleted_at: null,
    };
    const { error } = await db().from("submissions").upsert(row, { onConflict: "enrollment_id,slot" });
    if (error) throw error;
    await db().from("upload_tickets").update({ used_at: now }).eq("id", t.id);
    if (existing?.storage_path && existing.storage_path !== t.storage_path) {
      await db().storage.from(BUCKET).remove([existing.storage_path]);
    }

    const { data: profs } = await db().from("section_professors").select("staff_id").eq("section_id", section.id);
    await notify(
      "staff",
      (profs ?? []).map((p) => p.staff_id),
      `${courseName} ${section.code}분반 ${student.student_no} ${student.name} — 과제 ${t.slot} ${existing ? "재제출" : "제출"}`,
      `/prof/sections/${section.id}`
    );
    await audit({ type: "student", id: student.id, label: student.student_no }, existing ? "submission.replace" : "submission.create", fileName, {
      enrollmentId: t.enrollment_id,
      slot: t.slot,
      size,
    });
    return NextResponse.json({ ok: true, fileName });
  } catch (e) {
    return jsonError(e);
  }
}

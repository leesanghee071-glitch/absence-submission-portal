import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db, BUCKET } from "@/lib/supabase";
import { jsonError, requireStudent, HttpError } from "@/lib/auth";
import { extOf, isAllowedFile, MAX_FILE_BYTES } from "@/lib/files";
import { assertQuota, checkSlotWritable } from "@/lib/studentUpload";

// 1단계: 서버가 학생·슬롯·마감·형식·용량을 확인한 뒤 1회용 업로드 링크를 발급한다.
export async function POST(req: NextRequest) {
  try {
    const student = await requireStudent();
    const body = await req.json().catch(() => ({}));
    const enrollmentId = String(body.enrollmentId ?? "");
    const slot = Number(body.slot);
    const fileName = String(body.fileName ?? "");
    const size = Number(body.size);

    if (!isAllowedFile(fileName)) throw new HttpError(400, "PDF, 한글(hwp, hwpx), 워드(docx) 파일만 올릴 수 있습니다.");
    if (!(size > 0)) throw new HttpError(400, "빈 파일입니다.");
    if (size > MAX_FILE_BYTES) throw new HttpError(413, "파일은 10MB 이하만 올릴 수 있습니다.");

    const { settings, existing } = await checkSlotWritable(student.id, enrollmentId, slot);
    await assertQuota(student.id, settings.student_quota_mb, size, existing?.id);

    const path = `${enrollmentId}/${slot}/${randomUUID()}.${extOf(fileName)}`;
    const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw error ?? new Error("업로드 링크 발급 실패");

    const { data: ticket, error: tErr } = await db()
      .from("upload_tickets")
      .insert({
        enrollment_id: enrollmentId,
        slot,
        storage_path: path,
        original_name: fileName.slice(0, 200),
        expires_at: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
      })
      .select("id")
      .single();
    if (tErr) throw tErr;

    return NextResponse.json({ ticketId: ticket.id, path, token: data.token });
  } catch (e) {
    return jsonError(e);
  }
}

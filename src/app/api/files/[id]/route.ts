import { NextRequest, NextResponse } from "next/server";
import { db, BUCKET } from "@/lib/supabase";
import { assertSectionAccess, jsonError, readSession, requireStaff, HttpError } from "@/lib/auth";

// 과제 파일 열람/다운로드 — 본인(학생), 담당교수, 학과장만. 5분짜리 서명 링크로 넘긴다.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data: sub } = await db()
      .from("submissions")
      .select("id, storage_path, file_name, enrollment:enrollments!inner(student_id, section_id)")
      .eq("id", params.id)
      .maybeSingle();
    if (!sub) throw new HttpError(404, "파일을 찾을 수 없습니다.");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const en = sub.enrollment as any;

    const s = await readSession();
    if (s?.kind === "student") {
      if (en.student_id !== s.sub) throw new HttpError(403, "본인 파일만 볼 수 있습니다.");
    } else {
      const staff = await requireStaff();
      await assertSectionAccess(staff, en.section_id);
    }
    if (!sub.storage_path) throw new HttpError(410, "보관 기간이 끝나 원본 파일이 삭제되었습니다.");

    const download = req.nextUrl.searchParams.get("download") === "1";
    const { data, error } = await db()
      .storage.from(BUCKET)
      .createSignedUrl(sub.storage_path, 300, download ? { download: sub.file_name } : undefined);
    if (error || !data) throw error ?? new Error("링크 생성 실패");
    return NextResponse.redirect(data.signedUrl);
  } catch (e) {
    return jsonError(e);
  }
}

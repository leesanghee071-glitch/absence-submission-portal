import { NextRequest, NextResponse } from "next/server";
import { db, BUCKET } from "@/lib/supabase";
import { jsonError, requireStaff, HttpError } from "@/lib/auth";
import { audit } from "@/lib/audit";

// 보관 기간 종료: 원본 파일을 모두 지우고 제출 기록(파일명·일시·승인 상태)만 남긴다.
export async function POST(req: NextRequest) {
  try {
    const head = await requireStaff({ head: true });
    const b = await req.json().catch(() => ({}));
    if (b.confirm !== "원본 삭제") throw new HttpError(400, "확인 문구를 정확히 입력해 주세요.");
    let removed = 0;
    for (;;) {
      const { data } = await db().from("submissions").select("id, storage_path").not("storage_path", "is", null).limit(500);
      if (!data || data.length === 0) break;
      const paths = data.map((d) => d.storage_path as string);
      const { error } = await db().storage.from(BUCKET).remove(paths);
      if (error) throw error;
      await db()
        .from("submissions")
        .update({ storage_path: null, file_deleted_at: new Date().toISOString() })
        .in("id", data.map((d) => d.id));
      removed += data.length;
    }
    // 확정되지 않은 업로드 잔여물도 정리
    const { data: tickets } = await db().from("upload_tickets").select("storage_path").is("used_at", null);
    if (tickets?.length) await db().storage.from(BUCKET).remove(tickets.map((t) => t.storage_path));
    await db().from("upload_tickets").delete().not("id", "is", null);
    await audit({ type: "staff", id: head.id, label: head.name }, "files.purge", null, { removed });
    return NextResponse.json({ ok: true, removed });
  } catch (e) {
    return jsonError(e);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { jsonError, requireStaff, HttpError } from "@/lib/auth";
import { sendStaffLink } from "@/lib/staffTokens";
import { audit } from "@/lib/audit";

// 초대 재발송 / 로그인 링크 재발송 / 비밀번호 재설정 링크 발송
export async function POST(req: NextRequest) {
  try {
    const head = await requireStaff({ head: true });
    const b = await req.json().catch(() => ({}));
    const purpose = b.purpose;
    if (!["invite", "login", "reset"].includes(purpose)) throw new HttpError(400, "잘못된 요청입니다.");
    const { data: st } = await db().from("staff").select("id, name, email, status").eq("id", String(b.staffId ?? "")).maybeSingle();
    if (!st) throw new HttpError(404, "교수를 찾을 수 없습니다.");
    if (st.status === "disabled") throw new HttpError(400, "비활성화된 계정입니다. 먼저 재활성화해 주세요.");
    if (purpose === "invite") await db().from("staff").update({ invited_at: new Date().toISOString() }).eq("id", st.id);
    const r = await sendStaffLink(st, purpose, req.nextUrl.origin);
    await audit({ type: "staff", id: head.id, label: head.name }, `staff.link_${purpose}`, st.email, { emailed: r.sent });
    return NextResponse.json({ ok: true, link: r.link, sent: r.sent, emailError: r.error });
  } catch (e) {
    return jsonError(e);
  }
}

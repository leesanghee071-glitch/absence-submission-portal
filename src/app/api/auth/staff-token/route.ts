import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { sha256 } from "@/lib/crypto";
import { jsonError, setStaffSession } from "@/lib/auth";
import { audit } from "@/lib/audit";

// 메일 링크(/staff/auth?t=...) 페이지가 POST로 호출 — 메일 보안 검사기가 링크를 미리 열어도 소모되지 않는다.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body.token ?? "");
    if (!token) return NextResponse.json({ message: "링크가 올바르지 않습니다." }, { status: 400 });

    const { data: row } = await db()
      .from("staff_tokens")
      .select("id, staff_id, purpose, expires_at, used_at, staff:staff(id, name, role, status, password_hash)")
      .eq("token_hash", sha256(token))
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const staff = row?.staff as any;
    if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now() || !staff || staff.status === "disabled") {
      return NextResponse.json({ message: "만료되었거나 이미 사용한 링크입니다. 새 링크를 요청해 주세요." }, { status: 400 });
    }
    const now = new Date().toISOString();
    await db().from("staff_tokens").update({ used_at: now }).eq("id", row.id);
    await db().from("staff").update({ status: "active", last_login_at: now, failed_attempts: 0, locked_until: null }).eq("id", staff.id);
    await audit({ type: "staff", id: staff.id, label: staff.name }, "staff.login", null, { method: `link:${row.purpose}` });

    // 학과장은 메일 발송 없이 비밀번호로만 다시 들어오므로, 비밀번호가 없으면 반드시 만들게 한다.
    const isHead = staff.role === "head";
    const wantsPassword = row.purpose === "reset" || (row.purpose === "invite" && !staff.password_hash) || (isHead && !staff.password_hash);
    const home = isHead ? "/head" : "/prof";
    const next = wantsPassword ? `/staff/password?first=${row.purpose === "invite" ? "1" : "0"}${isHead ? "&required=1" : ""}` : home;
    const res = NextResponse.json({ ok: true, next, purpose: row.purpose, role: staff.role });
    await setStaffSession(res, staff);
    return res;
  } catch (e) {
    return jsonError(e);
  }
}

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/supabase";
import { jsonError, setStaffSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { emailConfigured } from "@/lib/email";
import { sendStaffLink } from "@/lib/staffTokens";

const FAIL = "이메일 또는 비밀번호가 맞지 않습니다. 비밀번호를 설정하지 않았다면 '로그인 링크 받기'를 이용해 주세요.";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!email || !password) return NextResponse.json({ message: "이메일과 비밀번호를 입력해 주세요." }, { status: 400 });

    const { data: st } = await db()
      .from("staff")
      .select("id, name, email, role, status, password_hash, failed_attempts, locked_until")
      .eq("email", email)
      .maybeSingle();
    if (!st || st.status === "disabled" || !st.password_hash) return NextResponse.json({ message: FAIL }, { status: 401 });
    if (st.locked_until && new Date(st.locked_until).getTime() > Date.now()) {
      return NextResponse.json({ message: "로그인 실패가 많아 잠시 잠겼습니다. 15분 후 다시 시도하거나 로그인 링크를 받아 주세요." }, { status: 429 });
    }
    if (!(await bcrypt.compare(password, st.password_hash))) {
      const fails = (st.failed_attempts ?? 0) + 1;
      const lock = fails >= 5;
      await db()
        .from("staff")
        .update({ failed_attempts: lock ? 0 : fails, locked_until: lock ? new Date(Date.now() + 15 * 60000).toISOString() : null })
        .eq("id", st.id);
      return NextResponse.json({ message: FAIL }, { status: 401 });
    }
    await db().from("staff").update({ failed_attempts: 0, locked_until: null }).eq("id", st.id);
    // 학과장은 비밀번호만으로 들어올 수 없고, 등록된 메일의 확인 링크를 눌러야 로그인된다.
    if (st.role === "head") {
      if (!emailConfigured()) {
        return NextResponse.json({ message: "메일 발송이 설정되지 않아 확인 링크를 보낼 수 없습니다." }, { status: 503 });
      }
      const r = await sendStaffLink(st, "login", req.nextUrl.origin);
      if (!r.sent) return NextResponse.json({ message: `확인 메일을 보내지 못했습니다. ${r.error ?? ""}` }, { status: 502 });
      return NextResponse.json({ ok: true, message: `${st.email}로 확인 메일을 보냈습니다. 메일의 링크를 누르면 로그인됩니다 (30분 유효).` });
    }
    await db().from("staff").update({ last_login_at: new Date().toISOString(), status: "active" }).eq("id", st.id);
    await audit({ type: "staff", id: st.id, label: st.name }, "staff.login", email, { method: "password" });
    const res = NextResponse.json({ ok: true, next: "/prof" });
    await setStaffSession(res, st);
    return res;
  } catch (e) {
    return jsonError(e);
  }
}

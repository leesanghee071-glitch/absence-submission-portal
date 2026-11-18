import { NextRequest, NextResponse } from "next/server";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { db } from "@/lib/supabase";
import { decrypt, encrypt } from "@/lib/crypto";
import { jsonError, readSession, setStaffSession, HttpError } from "@/lib/auth";
import { audit } from "@/lib/audit";

authenticator.options = { window: 1 };

async function loadHead() {
  const s = await readSession();
  if (!s || s.kind !== "staff") throw new HttpError(401, "로그인이 필요합니다.");
  const { data } = await db()
    .from("staff")
    .select("id, name, email, role, status, totp_enabled, totp_secret_enc, failed_attempts, locked_until")
    .eq("id", s.sub)
    .maybeSingle();
  if (!data || data.status === "disabled") throw new HttpError(401, "사용할 수 없는 계정입니다.");
  if (data.role !== "head") throw new HttpError(400, "학과장 계정만 2차 인증을 사용합니다.");
  return data;
}

// 등록 상태 확인 + (미등록이면) QR 발급
export async function GET() {
  try {
    const st = await loadHead();
    if (st.totp_enabled) return NextResponse.json({ enabled: true });
    let secret = st.totp_secret_enc ? decrypt(st.totp_secret_enc) : null;
    if (!secret) {
      secret = authenticator.generateSecret();
      await db().from("staff").update({ totp_secret_enc: encrypt(secret) }).eq("id", st.id);
    }
    const uri = authenticator.keyuri(st.email, "공가 과제 제출", secret);
    return NextResponse.json({ enabled: false, secret, qr: await QRCode.toDataURL(uri) });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const st = await loadHead();
    if (st.locked_until && new Date(st.locked_until).getTime() > Date.now()) {
      throw new HttpError(429, "인증 실패가 많아 15분간 잠겼습니다.");
    }
    const code = String((await req.json().catch(() => ({}))).code ?? "").replace(/\s/g, "");
    if (!st.totp_secret_enc) throw new HttpError(400, "먼저 인증 앱을 등록해 주세요.");
    if (!/^\d{6}$/.test(code) || !authenticator.check(code, decrypt(st.totp_secret_enc))) {
      const fails = (st.failed_attempts ?? 0) + 1;
      const lock = fails >= 5;
      await db()
        .from("staff")
        .update({ failed_attempts: lock ? 0 : fails, locked_until: lock ? new Date(Date.now() + 15 * 60000).toISOString() : null })
        .eq("id", st.id);
      throw new HttpError(401, "인증 코드가 맞지 않습니다.");
    }
    await db().from("staff").update({ totp_enabled: true, failed_attempts: 0, locked_until: null }).eq("id", st.id);
    if (!st.totp_enabled) await audit({ type: "staff", id: st.id, label: st.name }, "head.mfa_enrolled", st.email);
    const res = NextResponse.json({ ok: true });
    await setStaffSession(res, { id: st.id, role: "head" }, true);
    return res;
  } catch (e) {
    return jsonError(e);
  }
}

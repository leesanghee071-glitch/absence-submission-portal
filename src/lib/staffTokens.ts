import { db } from "@/lib/supabase";
import { randomToken, sha256 } from "@/lib/crypto";
import { sendEmail } from "@/lib/email";

export type TokenPurpose = "invite" | "login" | "reset";

const TTL: Record<TokenPurpose, number> = {
  invite: 7 * 86400, // 초대 링크 7일
  login: 30 * 60, // 로그인 링크 30분
  reset: 60 * 60, // 비밀번호 재설정 1시간
};

export function appUrl(fallbackOrigin?: string): string {
  return (process.env.APP_URL || fallbackOrigin || "http://localhost:3000").replace(/\/$/, "");
}

export async function issueStaffLink(staffId: string, purpose: TokenPurpose, origin?: string): Promise<string> {
  const token = randomToken();
  // 같은 용도의 이전 링크는 무효화
  await db().from("staff_tokens").update({ used_at: new Date().toISOString() }).eq("staff_id", staffId).eq("purpose", purpose).is("used_at", null);
  const { error } = await db().from("staff_tokens").insert({
    staff_id: staffId,
    purpose,
    token_hash: sha256(token),
    expires_at: new Date(Date.now() + TTL[purpose] * 1000).toISOString(),
  });
  if (error) throw error;
  return `${appUrl(origin)}/staff/auth?t=${encodeURIComponent(token)}`;
}

const SUBJECT: Record<TokenPurpose, string> = {
  invite: "[공가 과제 제출] 담당교수 초대",
  login: "[공가 과제 제출] 로그인 링크",
  reset: "[공가 과제 제출] 비밀번호 재설정",
};

export async function sendStaffLink(staff: { id: string; name: string; email: string }, purpose: TokenPurpose, origin?: string) {
  const link = await issueStaffLink(staff.id, purpose, origin);
  const body = {
    invite: `${staff.name} 교수님,\n\n유학생 공가 대체 과제 제출 사이트에 담당교수로 등록되었습니다.\n아래 링크로 처음 로그인해 주세요 (7일간 유효).\n\n${link}\n`,
    login: `${staff.name} 교수님,\n\n아래 링크를 누르면 로그인됩니다 (30분간 유효, 한 번만 사용 가능).\n\n${link}\n`,
    reset: `${staff.name} 교수님,\n\n아래 링크에서 비밀번호를 새로 설정해 주세요 (1시간 유효).\n\n${link}\n`,
  }[purpose];
  const r = await sendEmail(staff.email, SUBJECT[purpose], body);
  return { link, ...r };
}

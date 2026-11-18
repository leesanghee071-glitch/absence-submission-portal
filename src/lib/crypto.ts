import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

export function sha256(v: string): string {
  return createHash("sha256").update(v).digest("hex");
}

export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

// 생년월일은 학번과 묶어 서버 비밀값으로 HMAC — DB만 유출돼도 대입으로 복원할 수 없다.
export function birthHash(studentNo: string, birth8: string): string {
  const pepper = process.env.BIRTHDATE_PEPPER;
  if (!pepper) throw new Error("BIRTHDATE_PEPPER 환경변수가 설정되지 않았습니다.");
  return createHmac("sha256", pepper).update(`${studentNo}:${birth8}`).digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}

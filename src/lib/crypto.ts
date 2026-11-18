import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

function aesKey(): Buffer {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET 환경변수가 설정되지 않았습니다.");
  return createHash("sha256").update(`absence-portal:totp:${s}`).digest();
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", aesKey(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

export function decrypt(payload: string): string {
  const [iv, tag, enc] = payload.split(".").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", aesKey(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

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

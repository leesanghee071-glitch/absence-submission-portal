import { SignJWT, jwtVerify } from "jose";

// edge(middleware)와 Node 양쪽에서 사용 — Node 전용 API는 두지 않는다.

export const SESSION_COOKIE = "ap_session";
export const STUDENT_SESSION_SECONDS = 60 * 60 * 12; // 학생 12시간

export type StudentSession = { kind: "student"; sub: string };
export type StaffSession = { kind: "staff"; sub: string; role: "professor" | "head"; mfa: boolean };
export type Session = StudentSession | StaffSession;

function key(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET 환경변수가 설정되지 않았습니다.");
  return new TextEncoder().encode(s);
}

export async function signSession(s: Session, ttlSeconds: number): Promise<string> {
  return new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(key());
}

export async function verifySession(token: string): Promise<Session | null> {
  try {
    const { payload: p } = await jwtVerify(token, key());
    if (p.kind === "student" && typeof p.sub === "string") return { kind: "student", sub: p.sub };
    if (
      p.kind === "staff" &&
      typeof p.sub === "string" &&
      (p.role === "professor" || p.role === "head") &&
      typeof p.mfa === "boolean"
    ) {
      return { kind: "staff", sub: p.sub, role: p.role, mfa: p.mfa };
    }
    return null;
  } catch {
    return null;
  }
}

export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

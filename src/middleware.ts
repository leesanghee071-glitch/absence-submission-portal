import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const PUBLIC = new Set([
  "/",
  "/login",
  "/staff/login",
  "/staff/auth",
  "/api/auth/student-login",
  "/api/auth/staff-login",
  "/api/auth/staff-request-link",
  "/api/auth/staff-token",
  "/api/auth/logout",
]);

const under = (p: string, prefix: string) => p === prefix || p.startsWith(`${prefix}/`);

function deny(req: NextRequest, status: number, message: string, to: string) {
  if (req.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ message }, { status });
  return NextResponse.redirect(new URL(to, req.url));
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (PUBLIC.has(path)) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const s = token ? await verifySession(token) : null;
  const studentArea = under(path, "/student") || under(path, "/api/student");
  if (!s) return deny(req, 401, "로그인이 필요합니다.", studentArea ? "/login" : "/staff/login");

  if (s.kind === "student") {
    if (studentArea || under(path, "/api/files")) return NextResponse.next();
    return deny(req, 403, "접근 권한이 없습니다.", "/student");
  }

  // 교수·학과장
  // 학과장 세션은 이메일 링크 로그인으로만 생긴다. 그 밖의 세션은 다시 로그인.
  if (s.role === "head" && !s.mfa) return deny(req, 401, "이메일 확인 링크로 다시 로그인해 주세요.", "/staff/login");
  if (studentArea) return deny(req, 403, "접근 권한이 없습니다.", "/");
  if ((under(path, "/head") || under(path, "/api/head")) && s.role !== "head") {
    return deny(req, 403, "학과장만 사용할 수 있습니다.", "/prof");
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

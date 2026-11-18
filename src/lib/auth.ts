import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { Session, SESSION_COOKIE, verifySession, signSession, cookieOptions, STUDENT_SESSION_SECONDS } from "@/lib/session";
import { getSettings } from "@/lib/settings";

export type StaffRow = {
  id: string;
  name: string;
  email: string;
  role: "professor" | "head";
  status: "invited" | "active" | "disabled";
  password_hash: string | null;
};

export type StudentRow = { id: string; student_no: string; name: string; department: string | null };

export async function readSession(): Promise<Session | null> {
  const t = cookies().get(SESSION_COOKIE)?.value;
  return t ? verifySession(t) : null;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function jsonError(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ message: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ message: "서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
}

export async function requireStudent(): Promise<StudentRow> {
  const s = await readSession();
  if (!s || s.kind !== "student") throw new HttpError(401, "로그인이 필요합니다.");
  const { data } = await db().from("students").select("id, student_no, name, department").eq("id", s.sub).maybeSingle();
  if (!data) throw new HttpError(401, "명단에서 삭제된 학생입니다.");
  return data as StudentRow;
}

// 비활성화된 계정이나 이메일 확인을 거치지 않은 학과장 세션은 여기서 막는다.
export async function requireStaff(opts: { head?: boolean } = {}): Promise<StaffRow> {
  const s = await readSession();
  if (!s || s.kind !== "staff") throw new HttpError(401, "로그인이 필요합니다.");
  const { data } = await db()
    .from("staff")
    .select("id, name, email, role, status, password_hash")
    .eq("id", s.sub)
    .maybeSingle();
  const staff = data as StaffRow | null;
  if (!staff || staff.status === "disabled") throw new HttpError(401, "사용할 수 없는 계정입니다.");
  if (staff.role === "head" && !s.mfa) throw new HttpError(401, "이메일 확인 링크로 다시 로그인해 주세요.");
  if (opts.head && staff.role !== "head") throw new HttpError(403, "학과장만 사용할 수 있습니다.");
  return staff;
}

export async function setStudentSession(res: NextResponse, studentId: string) {
  const token = await signSession({ kind: "student", sub: studentId }, STUDENT_SESSION_SECONDS);
  res.cookies.set(SESSION_COOKIE, token, cookieOptions(STUDENT_SESSION_SECONDS));
}

// 학과장 세션은 이메일 링크로 로그인했을 때만 만든다(mfa = 이메일 확인 완료).
export async function setStaffSession(res: NextResponse, staff: { id: string; role: "professor" | "head" }) {
  const { staff_session_days } = await getSettings();
  const ttl = Math.max(1, staff_session_days) * 86400;
  const token = await signSession({ kind: "staff", sub: staff.id, role: staff.role, mfa: true }, ttl);
  res.cookies.set(SESSION_COOKIE, token, cookieOptions(ttl));
}

// 교수가 이 분반 담당인지
export async function assertSectionAccess(staff: StaffRow, sectionId: string) {
  if (staff.role === "head") return;
  const { data } = await db()
    .from("section_professors")
    .select("section_id")
    .eq("section_id", sectionId)
    .eq("staff_id", staff.id)
    .maybeSingle();
  if (!data) throw new HttpError(403, "담당 분반이 아닙니다.");
}

export async function mySectionIds(staff: StaffRow): Promise<string[]> {
  const { data } = await db().from("section_professors").select("section_id").eq("staff_id", staff.id);
  return (data ?? []).map((r) => r.section_id as string);
}

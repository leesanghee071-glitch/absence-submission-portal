import { redirect } from "next/navigation";
import { readSession, StaffRow } from "@/lib/auth";
import { db } from "@/lib/supabase";
import Header from "@/components/Header";

// 교수·학과장 페이지 공통: 세션 확인 + 상단 메뉴
export async function loadStaffForPage(opts: { head?: boolean } = {}): Promise<StaffRow> {
  const s = await readSession();
  if (!s || s.kind !== "staff") redirect("/staff/login");
  if (s.role === "head" && !s.mfa) redirect("/staff/mfa");
  const { data } = await db()
    .from("staff")
    .select("id, name, email, role, status, password_hash, totp_enabled, totp_secret_enc")
    .eq("id", s.sub)
    .maybeSingle();
  if (!data || data.status === "disabled") redirect("/staff/login");
  if (opts.head && data.role !== "head") redirect("/prof");
  return data as StaffRow;
}

export default function StaffHeader({ staff }: { staff: StaffRow }) {
  const nav =
    staff.role === "head"
      ? [
          { href: "/head", label: "대시보드" },
          { href: "/head/professors", label: "교수 관리" },
          { href: "/head/students", label: "학생 명단" },
          { href: "/head/courses", label: "과목·분반" },
          { href: "/head/settings", label: "설정" },
          { href: "/head/audit", label: "작업 기록" },
        ]
      : [{ href: "/prof", label: "내 분반" }];
  nav.push({ href: "/staff/password", label: "비밀번호" });
  return <Header who={`${staff.name} ${staff.role === "head" ? "학과장" : "교수"}`} nav={nav} logoutTo="/staff/login" />;
}

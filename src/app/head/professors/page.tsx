import { db } from "@/lib/supabase";
import { emailConfigured } from "@/lib/email";
import StaffHeader, { loadStaffForPage } from "@/components/StaffHeader";
import ProfessorManager, { ProfRow } from "./ProfessorManager";

export const dynamic = "force-dynamic";

export default async function ProfessorsPage() {
  const staff = await loadStaffForPage({ head: true });
  const { data } = await db()
    .from("staff")
    .select("id, name, email, role, status, last_login_at, invited_at, password_hash, section_professors(section:sections(id, code, course:courses(name)))")
    .order("name");
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const rows: ProfRow[] = (data ?? []).map((s: any) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    role: s.role,
    status: s.status,
    lastLogin: s.last_login_at,
    invitedAt: s.invited_at,
    hasPassword: !!s.password_hash,
    sections: (s.section_professors ?? [])
      .map((sp: any) => sp.section)
      .filter(Boolean)
      .map((sec: any) => ({ id: sec.id, label: `${sec.course?.name ?? ""} ${sec.code}분반` })),
  }));
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return (
    <>
      <StaffHeader staff={staff} />
      <main className="max-w-6xl mx-auto px-4 py-6 grid gap-5">
        <h1 className="h1">교수 관리</h1>
        {!emailConfigured() && (
          <p className="text-sm bg-amber-soft text-amber rounded px-3 py-2">
            메일 발송이 설정되지 않아 초대·로그인 링크를 메일로 보내지 못합니다. 링크를 만들면 화면에 표시되니 복사해서 직접 전달해 주세요.
          </p>
        )}
        <ProfessorManager rows={rows} />
      </main>
    </>
  );
}

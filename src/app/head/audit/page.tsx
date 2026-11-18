import { db } from "@/lib/supabase";
import { fmtDateTime } from "@/lib/format";
import StaffHeader, { loadStaffForPage } from "@/components/StaffHeader";

export const dynamic = "force-dynamic";

const ACTIONS: Record<string, string> = {
  "staff.login": "로그인",
  "staff.invite": "교수 초대",
  "staff.bulk": "교수 CSV 일괄 등록",
  "staff.disable": "계정 비활성화",
  "staff.enable": "계정 재활성화",
  "staff.rename": "교수 이름 변경",
  "staff.section_add": "분반 배정",
  "staff.section_remove": "분반 배정 해제",
  "staff.link_invite": "초대 재발송",
  "staff.link_login": "로그인 링크 발송",
  "staff.link_reset": "비밀번호 재설정 링크 발송",
  "staff.password_set": "비밀번호 설정",
  "head.mfa_enrolled": "2차 인증 등록",
  "roster.upload": "학생 명단 CSV 반영",
  "student.add": "학생 추가",
  "student.update": "학생 정보 수정",
  "student.delete": "학생 삭제",
  "student.locked": "학생 로그인 잠김",
  "enrollment.update": "공가 주차 수정",
  "enrollment.delete": "과목에서 학생 제외",
  "submission.create": "과제 제출",
  "submission.replace": "과제 재제출",
  "submission.approve": "승인",
  "submission.reject": "반려",
  "submission.reset": "검토 되돌리기",
  "final.confirm": "최종 확인",
  "final.undo": "최종 확인 취소",
  "deadline.override": "마감 연장",
  "settings.update": "설정 변경",
  "section.update": "과제 수·제목 변경",
  "files.purge": "원본 파일 삭제",
};

export default async function AuditPage({ searchParams }: { searchParams: { page?: string; scope?: string } }) {
  const staff = await loadStaffForPage({ head: true });
  const page = Math.max(0, Number(searchParams.page ?? 0) || 0);
  const adminOnly = searchParams.scope !== "all";
  let q = db().from("audit_logs").select("*").order("created_at", { ascending: false }).range(page * 100, page * 100 + 99);
  if (adminOnly) q = q.eq("actor_type", "staff");
  const { data } = await q;

  return (
    <>
      <StaffHeader staff={staff} />
      <main className="max-w-6xl mx-auto px-4 py-6 grid gap-5">
        <div className="flex items-end gap-3">
          <h1 className="h1">작업 기록 (audit_logs)</h1>
          <div className="ml-auto flex gap-2 text-sm">
            <a className={adminOnly ? "font-semibold" : "link"} href="?scope=staff">
              교수·학과장 작업
            </a>
            <a className={!adminOnly ? "font-semibold" : "link"} href="?scope=all">
              학생 제출 포함
            </a>
          </div>
        </div>
        <section className="panel overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>일시</th>
                <th>누가</th>
                <th>작업</th>
                <th>대상</th>
                <th>내용</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((r) => (
                <tr key={r.id}>
                  <td className="text-xs whitespace-nowrap">{fmtDateTime(r.created_at)}</td>
                  <td className="whitespace-nowrap">{r.actor_label ?? r.actor_type}</td>
                  <td className="whitespace-nowrap">{ACTIONS[r.action] ?? r.action}</td>
                  <td className="text-xs">{r.target}</td>
                  <td className="text-xs font-mono text-ink-soft break-all max-w-md">{r.detail ? JSON.stringify(r.detail) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex gap-3 mt-3 text-sm">
            {page > 0 && (
              <a className="link" href={`?scope=${adminOnly ? "staff" : "all"}&page=${page - 1}`}>
                ← 최근
              </a>
            )}
            {(data?.length ?? 0) === 100 && (
              <a className="link" href={`?scope=${adminOnly ? "staff" : "all"}&page=${page + 1}`}>
                이전 기록 →
              </a>
            )}
          </div>
        </section>
      </main>
    </>
  );
}

import Link from "next/link";
import { loadEnrollments, missingSlots, unapprovedSlots, overallStatus, summarizeBySection } from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { fmtDateTime } from "@/lib/format";
import StaffHeader, { loadStaffForPage } from "@/components/StaffHeader";
import StatusBadge from "@/components/StatusBadge";
import ZipButton from "@/components/ZipButton";
import FinalConfirm from "./FinalConfirm";

export const dynamic = "force-dynamic";

export default async function HeadDashboard() {
  const staff = await loadStaffForPage({ head: true });
  const [list, settings] = await Promise.all([loadEnrollments(), getSettings()]);
  const sections = summarizeBySection(list);

  const total = list.length;
  const approved = list.filter((e) => e.allApproved).length;
  const confirmed = list.filter((e) => e.final_confirmed_at).length;
  const pending = list.reduce((a, e) => a + e.slots.filter((s) => s.status === "submitted").length, 0);
  const attention = list.filter((e) => !e.allApproved);

  // 교수별 검토 대기 건
  const byProf = new Map<string, { name: string; pending: number; sections: number }>();
  for (const s of sections) {
    for (const p of s.professors) {
      const v = byProf.get(p.id) ?? { name: p.name, pending: 0, sections: 0 };
      v.pending += s.pendingReviews;
      v.sections++;
      byProf.set(p.id, v);
    }
  }
  const profRows = Array.from(byProf.values()).sort((a, b) => b.pending - a.pending);
  const courses = Array.from(new Map(list.map((e) => [e.course.id, e.course.name])).entries());

  return (
    <>
      <StaffHeader staff={staff} />
      <main className="max-w-6xl mx-auto px-4 py-6 grid gap-5">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <h1 className="h1">전체 현황</h1>
            <p className="muted">
              마감 {settings.deadline ? fmtDateTime(settings.deadline) : "미정 — 설정에서 정해 주세요"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            ["대상 (학생·과목)", `${total}건`],
            ["승인 완료", `${approved}건`],
            ["최종 확인", `${confirmed}건`],
            ["검토 대기 과제", `${pending}건`],
            ["미제출·미승인 학생", `${attention.length}건`],
          ].map(([k, v]) => (
            <div key={k} className="panel">
              <p className="text-xs text-ink-soft">{k}</p>
              <p className="text-xl font-semibold">{v}</p>
            </div>
          ))}
        </div>

        <section className="panel">
          <h2 className="h2">보고 자료 다운로드</h2>
          <div className="flex flex-wrap gap-2">
            <a className="btn-primary" href="/api/exports/approved">
              공가 인정 엑셀 (최종 확인 {confirmed}건)
            </a>
            <a className="btn" href="/api/exports/status">
              제출 현황 자료
            </a>
            <a className="btn" href="/api/exports/missing">
              미제출·미승인 명단
            </a>
          </div>
          {courses.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3 items-center">
              <span className="text-sm text-ink-soft">과목별 ZIP:</span>
              {courses.map(([id, name]) => (
                <ZipButton key={id} query={`?courseId=${id}`} label={name} />
              ))}
            </div>
          )}
        </section>

        <section className="panel overflow-x-auto">
          <h2 className="h2">과목·분반별 승인 진행률</h2>
          <table className="tbl">
            <thead>
              <tr>
                <th>과목</th>
                <th>분반</th>
                <th>담당교수</th>
                <th className="w-48">승인 진행률</th>
                <th>검토 대기</th>
                <th>미제출 과제</th>
                <th>최종 확인</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sections.map((s) => {
                const pct = s.students ? Math.round((s.approvedStudents / s.students) * 100) : 0;
                return (
                  <tr key={s.sectionId}>
                    <td>{s.courseName}</td>
                    <td>{s.code}</td>
                    <td>{s.professors.map((p) => p.name).join(", ") || <span className="text-correction">미배정</span>}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-paper rounded overflow-hidden">
                          <div className="h-full bg-ok" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs whitespace-nowrap">
                          {s.approvedStudents}/{s.students}
                        </span>
                      </div>
                    </td>
                    <td className={s.pendingReviews ? "text-blueprint font-semibold" : ""}>{s.pendingReviews}</td>
                    <td className={s.missingSlots ? "text-correction" : ""}>{s.missingSlots}</td>
                    <td>
                      {s.confirmedStudents}/{s.students}
                    </td>
                    <td>
                      <Link className="link text-xs" href={`/prof/sections/${s.sectionId}`}>
                        상세
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="panel overflow-x-auto">
          <h2 className="h2">교수별 미승인(검토 대기) 건</h2>
          <table className="tbl">
            <thead>
              <tr>
                <th>교수</th>
                <th>담당 분반</th>
                <th>검토 대기 과제</th>
              </tr>
            </thead>
            <tbody>
              {profRows.map((p) => (
                <tr key={p.name} className={p.pending ? "bg-amber-soft/60" : ""}>
                  <td>{p.name}</td>
                  <td>{p.sections}개</td>
                  <td className={p.pending ? "font-semibold text-correction" : ""}>{p.pending}건</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <FinalConfirm
          rows={list
            .filter((e) => e.allApproved)
            .map((e) => ({
              id: e.id,
              course: e.course.name,
              section: e.section.code,
              studentNo: e.student.student_no,
              name: e.student.name,
              weeks: e.absence_weeks,
              confirmedAt: e.final_confirmed_at,
            }))}
        />

        <section className="panel overflow-x-auto">
          <h2 className="h2">미제출·미승인 학생 ({attention.length}건, 과목·분반 순)</h2>
          <table className="tbl">
            <thead>
              <tr>
                <th>과목</th>
                <th>분반</th>
                <th>담당교수</th>
                <th>학번</th>
                <th>이름</th>
                <th>미제출</th>
                <th>미승인</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {attention.map((e) => (
                <tr key={e.id}>
                  <td>{e.course.name}</td>
                  <td>{e.section.code}</td>
                  <td>{e.professors.map((p) => p.name).join(", ")}</td>
                  <td>{e.student.student_no}</td>
                  <td>{e.student.name}</td>
                  <td className="text-correction">{missingSlots(e).join(", ") || "-"}</td>
                  <td>{unapprovedSlots(e).join(", ") || "-"}</td>
                  <td>
                    <StatusBadge status={overallStatus(e)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </>
  );
}

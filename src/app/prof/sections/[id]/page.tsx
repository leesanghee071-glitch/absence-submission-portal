import { notFound } from "next/navigation";
import { db } from "@/lib/supabase";
import { assertSectionAccess } from "@/lib/auth";
import { loadEnrollments, missingSlots, unapprovedSlots, overallStatus } from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { fmtDateTime } from "@/lib/format";
import StaffHeader, { loadStaffForPage } from "@/components/StaffHeader";
import StatusBadge from "@/components/StatusBadge";
import ZipButton from "@/components/ZipButton";
import ReviewControls from "./ReviewControls";
import Announcements from "@/components/Announcements";
import { loadAnnouncements } from "@/lib/announcements";

export const dynamic = "force-dynamic";

export default async function SectionPage({ params }: { params: { id: string } }) {
  const staff = await loadStaffForPage();
  try {
    await assertSectionAccess(staff, params.id);
  } catch {
    notFound();
  }
  const { data: section } = await db().from("sections").select("id, code, course:courses(name)").eq("id", params.id).maybeSingle();
  if (!section) notFound();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const courseName = (section.course as any)?.name as string;
  const [list, settings, notices] = await Promise.all([
    loadEnrollments({ sectionIds: [params.id] }),
    getSettings(),
    loadAnnouncements({ sectionIds: [params.id] }),
  ]);
  const attention = list.filter((e) => !e.allApproved);
  // 내가 검토할 수 있는지 (학과장은 본인이 배정된 분반만)
  const { data: assigned } = await db().from("section_professors").select("section_id").eq("section_id", params.id).eq("staff_id", staff.id).maybeSingle();
  const canReview = !!assigned;
  const q = `?sectionId=${params.id}`;

  return (
    <>
      <StaffHeader staff={staff} />
      <main className="max-w-6xl mx-auto px-4 py-6 grid gap-5">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <h1 className="h1">
              {courseName} {section.code}분반
            </h1>
            <p className="muted">마감 {settings.deadline ? fmtDateTime(settings.deadline) : "미정"} · 학생 {list.length}명</p>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <a className="btn" href={`/api/exports/missing${q}`}>
              미제출·미승인 명단 엑셀
            </a>
            <a className="btn" href={`/api/exports/status${q}`}>
              제출 현황 엑셀
            </a>
            <ZipButton query={q} label="분반 ZIP 다운로드" />
          </div>
        </div>

        <Announcements
          items={notices}
          heading="과목 공지 (이 분반 학생에게 보임)"
          sectionId={params.id}
          canEdit={canReview || staff.role === "head"}
          sameCourseOption
          emptyText="아직 공지가 없습니다. 과제 안내나 제출 유의사항을 올리면 이 분반 학생 화면의 과목 카드에 보입니다."
        />

        <section className="panel">
          <h2 className="h2">미제출·미승인 학생 ({attention.length}명)</h2>
          {attention.length === 0 ? (
            <p className="muted">모든 학생의 과제가 승인되었습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>학번</th>
                    <th>이름</th>
                    <th>미제출 과제</th>
                    <th>검토 대기·반려 과제</th>
                    <th>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {attention.map((e) => (
                    <tr key={e.id}>
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
            </div>
          )}
        </section>

        <section className="panel overflow-x-auto">
          <h2 className="h2">제출 목록</h2>
          {!canReview && <p className="muted mb-3">이 분반의 담당교수가 아니므로 열람만 가능합니다.</p>}
          <table className="tbl">
            <thead>
              <tr>
                <th>학번 · 이름</th>
                <th>과제</th>
                <th>상태</th>
                <th>파일</th>
                <th>제출 일시</th>
                <th>검토</th>
              </tr>
            </thead>
            <tbody>
              {list.flatMap((e) =>
                e.slots.map((s, i) => (
                  <tr key={`${e.id}-${s.slot}`} className={i === 0 ? "border-t-2 border-line" : ""}>
                    <td>
                      {i === 0 && (
                        <>
                          <b>{e.student.student_no}</b> {e.student.name}
                          {e.final_confirmed_at && <span className="badge bg-ok text-white ml-2">최종 확인</span>}
                        </>
                      )}
                    </td>
                    <td className="whitespace-nowrap">{s.title}</td>
                    <td>
                      <StatusBadge status={s.status} />
                      {s.status === "rejected" && <p className="text-xs text-correction mt-1">{s.sub?.reject_reason}</p>}
                    </td>
                    <td>
                      {s.sub ? (
                        s.sub.storage_path ? (
                          <span className="flex flex-wrap gap-2">
                            <a className="link" href={`/api/files/${s.sub.id}`} target="_blank" rel="noreferrer">
                              보기
                            </a>
                            <a className="link" href={`/api/files/${s.sub.id}?download=1`}>
                              받기
                            </a>
                            <span className="text-xs text-ink-soft">{s.sub.file_name}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-ink-soft">원본 삭제됨</span>
                        )
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="text-xs whitespace-nowrap">{s.sub ? fmtDateTime(s.sub.submitted_at) : "-"}</td>
                    <td>
                      {s.sub && canReview && !e.final_confirmed_at ? (
                        <ReviewControls submissionId={s.sub.id} status={s.sub.status} />
                      ) : s.sub?.reviewer ? (
                        <span className="text-xs text-ink-soft">{s.sub.reviewer.name}</span>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </main>
    </>
  );
}

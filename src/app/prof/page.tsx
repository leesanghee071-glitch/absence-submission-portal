import Link from "next/link";
import { db } from "@/lib/supabase";
import { mySectionIds } from "@/lib/auth";
import { loadEnrollments, summarizeBySection } from "@/lib/data";
import StaffHeader, { loadStaffForPage } from "@/components/StaffHeader";
import Notifications from "@/components/Notifications";
import Announcements from "@/components/Announcements";
import { loadAnnouncements } from "@/lib/announcements";

export const dynamic = "force-dynamic";

export default async function ProfHome() {
  const staff = await loadStaffForPage();
  const sectionIds = await mySectionIds(staff);
  const [list, notes, sectionsRes] = await Promise.all([
    loadEnrollments({ sectionIds }),
    db()
      .from("notifications")
      .select("id, message, link, read_at, created_at")
      .eq("recipient_type", "staff")
      .eq("recipient_id", staff.id)
      .order("created_at", { ascending: false })
      .limit(30),
    sectionIds.length
      ? db().from("sections").select("id, code, course:courses(name)").in("id", sectionIds)
      : Promise.resolve({ data: [] as { id: string; code: string; course: unknown }[] }),
  ]);
  const summary = summarizeBySection(list);
  // 학생이 아직 없는 분반도 보여 준다
  for (const s of sectionsRes.data ?? []) {
    if (!summary.find((x) => x.sectionId === s.id)) {
      summary.push({
        sectionId: s.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        courseName: (s.course as any)?.name ?? "",
        code: s.code,
        professors: [],
        students: 0,
        approvedStudents: 0,
        confirmedStudents: 0,
        pendingReviews: 0,
        missingSlots: 0,
      });
    }
  }

  return (
    <>
      <StaffHeader staff={staff} />
      <main className="max-w-5xl mx-auto px-4 py-6 grid gap-5">
        <h1 className="h1">내 분반</h1>
        <Announcements items={await loadAnnouncements()} heading="전체 공지 (학과장)" />
        <Notifications items={notes.data ?? []} endpoint="/api/prof/notifications" />
        {summary.length === 0 ? (
          <div className="panel muted">배정된 분반이 없습니다. 학과장에게 분반 배정을 요청해 주세요.</div>
        ) : (
          <div className="panel overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>과목</th>
                  <th>분반</th>
                  <th>학생</th>
                  <th>검토 대기 과제</th>
                  <th>미제출 과제</th>
                  <th>승인 완료 학생</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {summary.map((s) => (
                  <tr key={s.sectionId}>
                    <td>{s.courseName}</td>
                    <td>{s.code}</td>
                    <td>{s.students}명</td>
                    <td className={s.pendingReviews ? "text-blueprint font-semibold" : ""}>{s.pendingReviews}건</td>
                    <td>{s.missingSlots}건</td>
                    <td>
                      {s.approvedStudents}/{s.students}
                    </td>
                    <td>
                      <Link className="btn-primary btn-sm" href={`/prof/sections/${s.sectionId}`}>
                        열기
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}

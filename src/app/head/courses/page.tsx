import { db } from "@/lib/supabase";
import StaffHeader, { loadStaffForPage } from "@/components/StaffHeader";
import SectionEditor from "./SectionEditor";

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const staff = await loadStaffForPage({ head: true });
  const { data } = await db()
    .from("sections")
    .select("id, code, assignment_count, assignment_titles, course:courses!inner(name), section_professors(staff(name)), enrollments(count)")
    .order("code");
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const rows = (data ?? [])
    .map((s: any) => ({
      id: s.id,
      course: s.course.name as string,
      code: s.code as string,
      count: s.assignment_count as number,
      titles: (s.assignment_titles ?? []) as string[],
      professors: (s.section_professors ?? []).map((p: any) => p.staff?.name).filter(Boolean).join(", "),
      students: s.enrollments?.[0]?.count ?? 0,
    }))
    .sort((a, b) => a.course.localeCompare(b.course, "ko") || a.code.localeCompare(b.code, "ko", { numeric: true }));
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return (
    <>
      <StaffHeader staff={staff} />
      <main className="max-w-6xl mx-auto px-4 py-6 grid gap-5">
        <div>
          <h1 className="h1">과목·분반</h1>
          <p className="muted">과목·분반은 학생 명단이나 교수 등록 때 자동으로 만들어집니다. 여기서 분반별 과제 수(최대 3개)와 과제 제목을 정합니다.</p>
        </div>
        <section className="panel overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>과목</th>
                <th>분반</th>
                <th>담당교수</th>
                <th>학생</th>
                <th>과제 수 · 제목</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.course}</td>
                  <td>{r.code}</td>
                  <td>{r.professors || <span className="text-correction">미배정</span>}</td>
                  <td>{r.students}명</td>
                  <td>
                    <SectionEditor id={r.id} count={r.count} titles={r.titles} />
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

import { db } from "@/lib/supabase";
import { loadEnrollments, overallStatus } from "@/lib/data";
import StaffHeader, { loadStaffForPage } from "@/components/StaffHeader";
import RosterUpload from "./RosterUpload";
import StudentTable, { StudentItem } from "./StudentTable";

export const dynamic = "force-dynamic";

export default async function StudentsPage() {
  const staff = await loadStaffForPage({ head: true });
  const [list, studentsRes] = await Promise.all([
    loadEnrollments(),
    db().from("students").select("id, student_no, name, department, last_login_at, locked_until").order("student_no"),
  ]);
  const items: StudentItem[] = (studentsRes.data ?? []).map((s) => ({
    id: s.id,
    studentNo: s.student_no,
    name: s.name,
    department: s.department,
    lastLogin: s.last_login_at,
    locked: !!s.locked_until && new Date(s.locked_until).getTime() > Date.now(),
    enrollments: list
      .filter((e) => e.student.id === s.id)
      .map((e) => ({
        id: e.id,
        label: `${e.course.name} ${e.section.code}분반`,
        weeks: e.required_count,
        confirmed: !!e.final_confirmed_at,
        deadlineOverride: e.deadline_override,
        status: overallStatus(e),
        progress: `${e.approvedCount}/${e.slots.length} 승인 · ${e.submittedCount}/${e.slots.length} 제출`,
      })),
  }));

  return (
    <>
      <StaffHeader staff={staff} />
      <main className="max-w-6xl mx-auto px-4 py-6 grid gap-5">
        <div>
          <h1 className="h1">학생 명단</h1>
          <p className="muted">공가 대상자만 등록합니다. 명단에 있는 학번·생년월일만 로그인할 수 있습니다.</p>
        </div>
        <RosterUpload />
        <StudentTable items={items} />
      </main>
    </>
  );
}

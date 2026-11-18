import { db } from "@/lib/supabase";

export type SubmissionRow = {
  id: string;
  slot: number;
  status: "submitted" | "approved" | "rejected";
  file_name: string;
  original_name: string;
  size_bytes: number;
  storage_path: string | null;
  reject_reason: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  reviewer: { id: string; name: string } | null;
};

export type SlotView = {
  slot: number;
  title: string;
  status: "missing" | "submitted" | "approved" | "rejected";
  sub: SubmissionRow | null;
};

export type EnrollmentView = {
  id: string;
  absence_weeks: string | null;
  deadline_override: string | null;
  final_confirmed_at: string | null;
  student: { id: string; student_no: string; name: string; department: string | null; last_login_at: string | null };
  section: { id: string; code: string; assignment_count: number; assignment_titles: string[] };
  course: { id: string; name: string };
  professors: { id: string; name: string }[];
  slots: SlotView[];
  submittedCount: number; // 제출된 슬롯 수 (승인·반려 포함)
  approvedCount: number;
  allApproved: boolean;
};

const SELECT = `
  id, absence_weeks, deadline_override, final_confirmed_at,
  student:students!inner(id, student_no, name, department, last_login_at),
  section:sections!inner(id, code, assignment_count, assignment_titles, course_id,
    course:courses!inner(id, name),
    section_professors(staff(id, name))),
  submissions(id, slot, status, file_name, original_name, size_bytes, storage_path, reject_reason,
    submitted_at, reviewed_at, reviewer:staff!submissions_reviewed_by_fkey(id, name))
`;

type Filter = { studentId?: string; sectionIds?: string[]; enrollmentIds?: string[]; courseId?: string };

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function loadEnrollments(f: Filter = {}): Promise<EnrollmentView[]> {
  if (f.sectionIds && f.sectionIds.length === 0) return [];
  if (f.enrollmentIds && f.enrollmentIds.length === 0) return [];
  const out: any[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    let q = db().from("enrollments").select(SELECT).order("id").range(from, from + PAGE - 1);
    if (f.studentId) q = q.eq("student_id", f.studentId);
    if (f.sectionIds) q = q.in("section_id", f.sectionIds);
    if (f.enrollmentIds) q = q.in("id", f.enrollmentIds);
    if (f.courseId) q = q.eq("section.course_id", f.courseId);
    const { data, error } = await q;
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out.map(toView).sort(compareEnrollment);
}

function toView(r: any): EnrollmentView {
  const section = r.section;
  const subs: SubmissionRow[] = r.submissions ?? [];
  const slots: SlotView[] = [];
  for (let i = 1; i <= section.assignment_count; i++) {
    const sub = subs.find((s) => s.slot === i) ?? null;
    slots.push({
      slot: i,
      title: section.assignment_titles?.[i - 1] || `과제 ${i}`,
      status: sub ? sub.status : "missing",
      sub,
    });
  }
  const approvedCount = slots.filter((s) => s.status === "approved").length;
  return {
    id: r.id,
    absence_weeks: r.absence_weeks,
    deadline_override: r.deadline_override,
    final_confirmed_at: r.final_confirmed_at,
    student: r.student,
    section: { id: section.id, code: section.code, assignment_count: section.assignment_count, assignment_titles: section.assignment_titles ?? [] },
    course: section.course,
    professors: (section.section_professors ?? []).map((sp: any) => sp.staff).filter(Boolean),
    slots,
    submittedCount: slots.filter((s) => s.status !== "missing").length,
    approvedCount,
    allApproved: approvedCount === slots.length,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function compareEnrollment(a: EnrollmentView, b: EnrollmentView): number {
  return (
    a.course.name.localeCompare(b.course.name, "ko") ||
    a.section.code.localeCompare(b.section.code, "ko", { numeric: true }) ||
    a.student.student_no.localeCompare(b.student.student_no)
  );
}

// 미제출 또는 미승인 과제가 있는 학생
export function needsAttention(e: EnrollmentView): boolean {
  return !e.allApproved;
}

export function missingSlots(e: EnrollmentView): number[] {
  return e.slots.filter((s) => s.status === "missing").map((s) => s.slot);
}

// 제출됐지만 아직 승인되지 않은 슬롯 (검토 대기 + 반려)
export function unapprovedSlots(e: EnrollmentView): number[] {
  return e.slots.filter((s) => s.status === "submitted" || s.status === "rejected").map((s) => s.slot);
}

export function overallStatus(e: EnrollmentView): string {
  if (e.final_confirmed_at) return "최종 확인";
  if (e.allApproved) return "승인 완료";
  if (e.slots.some((s) => s.status === "rejected")) return "반려 있음";
  if (e.submittedCount === e.slots.length) return "검토 대기";
  return "제출 중";
}

export type SectionSummary = {
  sectionId: string;
  courseName: string;
  code: string;
  professors: { id: string; name: string }[];
  students: number;
  approvedStudents: number;
  confirmedStudents: number;
  pendingReviews: number; // 검토 대기 과제 수
  missingSlots: number;
};

export function summarizeBySection(list: EnrollmentView[]): SectionSummary[] {
  const map = new Map<string, SectionSummary>();
  for (const e of list) {
    let s = map.get(e.section.id);
    if (!s) {
      s = {
        sectionId: e.section.id,
        courseName: e.course.name,
        code: e.section.code,
        professors: e.professors,
        students: 0,
        approvedStudents: 0,
        confirmedStudents: 0,
        pendingReviews: 0,
        missingSlots: 0,
      };
      map.set(e.section.id, s);
    }
    s.students++;
    if (e.allApproved) s.approvedStudents++;
    if (e.final_confirmed_at) s.confirmedStudents++;
    s.pendingReviews += e.slots.filter((x) => x.status === "submitted").length;
    s.missingSlots += e.slots.filter((x) => x.status === "missing").length;
  }
  return Array.from(map.values());
}

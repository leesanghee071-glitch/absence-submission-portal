import { db } from "@/lib/supabase";
import { HttpError } from "@/lib/auth";
import { effectiveDeadline, getSettings, isPastDeadline } from "@/lib/settings";

// 학생이 이 수강(과목·분반)의 이 슬롯에 지금 업로드할 수 있는지 확인하고 필요한 정보를 돌려준다.
export async function checkSlotWritable(studentId: string, enrollmentId: string, slot: number) {
  const { data: en } = await db()
    .from("enrollments")
    .select("id, student_id, deadline_override, final_confirmed_at, section:sections!inner(id, code, assignment_count, course:courses!inner(name))")
    .eq("id", enrollmentId)
    .maybeSingle();
  if (!en || en.student_id !== studentId) throw new HttpError(404, "수강 정보를 찾을 수 없습니다.");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const section = en.section as any;
  if (!Number.isInteger(slot) || slot < 1 || slot > section.assignment_count) throw new HttpError(400, "없는 과제 번호입니다.");
  if (en.final_confirmed_at) throw new HttpError(409, "학과장 최종 확인이 끝나 더 이상 바꿀 수 없습니다.");
  const settings = await getSettings();
  const deadline = effectiveDeadline(settings, en.deadline_override);
  if (isPastDeadline(deadline)) throw new HttpError(409, "마감일이 지나 업로드할 수 없습니다. 학과장에게 문의해 주세요.");

  const { data: existing } = await db()
    .from("submissions")
    .select("id, status, storage_path")
    .eq("enrollment_id", enrollmentId)
    .eq("slot", slot)
    .maybeSingle();
  return { en, section, courseName: section.course.name as string, settings, existing };
}

// 학생별 총량 한도 (설정된 경우) — 교체되는 슬롯의 기존 파일은 빼고 계산
export async function assertQuota(studentId: string, quotaMb: number | null, addBytes: number, replacingSubmissionId?: string) {
  if (!quotaMb) return;
  const { data: ens } = await db().from("enrollments").select("id").eq("student_id", studentId);
  const ids = (ens ?? []).map((e) => e.id);
  if (ids.length === 0) return;
  const { data: subs } = await db().from("submissions").select("id, size_bytes, storage_path").in("enrollment_id", ids);
  const used = (subs ?? [])
    .filter((s) => s.id !== replacingSubmissionId && s.storage_path)
    .reduce((a, s) => a + Number(s.size_bytes), 0);
  if (used + addBytes > quotaMb * 1024 * 1024) {
    throw new HttpError(413, `학생별 총 업로드 한도(${quotaMb}MB)를 넘습니다.`);
  }
}

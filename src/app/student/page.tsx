import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { loadEnrollments } from "@/lib/data";
import { effectiveDeadline, getSettings, isPastDeadline } from "@/lib/settings";
import { fmtDateTime } from "@/lib/format";
import Header from "@/components/Header";
import StatusBadge from "@/components/StatusBadge";
import SlotUploader from "./SlotUploader";
import Notifications from "@/components/Notifications";
import Announcements from "@/components/Announcements";
import { loadAnnouncements } from "@/lib/announcements";

export const dynamic = "force-dynamic";

export default async function StudentPage() {
  const s = await readSession();
  if (!s || s.kind !== "student") redirect("/login");
  const { data: student } = await db().from("students").select("id, student_no, name").eq("id", s.sub).maybeSingle();
  if (!student) redirect("/login");

  const list = await loadEnrollments({ studentId: student.id });
  const [settings, notes, globalNotices, courseNotices] = await Promise.all([
    getSettings(),
    db()
      .from("notifications")
      .select("id, message, read_at, created_at")
      .eq("recipient_type", "student")
      .eq("recipient_id", student.id)
      .order("created_at", { ascending: false })
      .limit(20),
    loadAnnouncements(),
    loadAnnouncements({ sectionIds: list.map((e) => e.section.id) }),
  ]);

  return (
    <>
      <Header who={`${student.student_no} ${student.name}`} nav={[]} logoutTo="/login" />
      <main className="max-w-4xl mx-auto px-4 py-6 grid gap-5">
        <div>
          <h1 className="h1">내 과제 현황 · My assignments</h1>
          <p className="muted">
            PDF, 한글(hwp, hwpx), 워드(docx) · 파일당 10MB 이하. 마감 전까지 다시 올리면 교체됩니다.
            <br />
            PDF, HWP/HWPX, DOCX only · max 10MB each. Re-upload before the deadline to replace a file.
          </p>
        </div>

        <Announcements items={globalNotices} heading="전체 공지 · Notices" />

        <Notifications items={notes.data ?? []} />

        {list.length === 0 && <div className="panel muted">등록된 과목이 없습니다. 학과 사무실에 문의해 주세요.</div>}

        {list.map((e) => {
          const deadline = effectiveDeadline(settings, e.deadline_override);
          const closed = isPastDeadline(deadline) || !!e.final_confirmed_at;
          return (
            <section key={e.id} className="panel">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
                <h2 className="text-lg font-semibold">
                  {e.course.name} <span className="text-ink-soft font-normal">{e.section.code}분반</span>
                </h2>
                <span className="text-sm text-ink-soft">담당 {e.professors.map((p) => p.name).join(", ") || "미배정"}</span>
                <span className="badge bg-blueprint-soft text-blueprint">
                  공가 {e.required_count}주 · 과제 {e.required_count}개 · {e.required_count} week{e.required_count > 1 ? "s" : ""}
                </span>
                <span className="ml-auto text-sm">
                  마감 Deadline: <b className={isPastDeadline(deadline) ? "text-correction" : ""}>{deadline ? fmtDateTime(deadline) : "미정"}</b>
                  {e.deadline_override && <span className="badge bg-amber-soft text-amber ml-2">연장됨</span>}
                </span>
              </div>
              {e.final_confirmed_at ? (
                <p className="mb-3 text-sm text-ok font-medium">✔ 공가 인정 최종 확인 완료 · Final confirmation complete ({fmtDateTime(e.final_confirmed_at)})</p>
              ) : e.allApproved ? (
                <p className="mb-3 text-sm text-ok">모든 과제가 승인되었습니다. 학과장 최종 확인을 기다리고 있습니다. · All approved, awaiting final confirmation.</p>
              ) : null}
              {courseNotices.some((a) => a.section_id === e.section.id) && (
                <div className="mb-3">
                  <Announcements compact items={courseNotices.filter((a) => a.section_id === e.section.id)} heading="과목 공지 · Course notices" />
                </div>
              )}
              <div className="grid gap-3">
                {e.slots.map((slot) => (
                  <div key={slot.slot} className="border border-line rounded p-3 bg-white">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <b className="text-sm">{slot.title}</b>
                      <StatusBadge status={slot.status} />
                      {slot.sub && (
                        <a className="link text-sm ml-auto" href={`/api/files/${slot.sub.id}`} target="_blank" rel="noreferrer">
                          {slot.sub.file_name}
                        </a>
                      )}
                    </div>
                    {slot.sub && <p className="text-xs text-ink-soft mb-2">제출 Submitted: {fmtDateTime(slot.sub.submitted_at)} · 원본 {slot.sub.original_name}</p>}
                    {slot.status === "rejected" && (
                      <p className="text-sm text-correction bg-correction-soft rounded px-2 py-1 mb-2">
                        반려 사유 · Reason: {slot.sub?.reject_reason}
                      </p>
                    )}
                    {!closed ? (
                      <SlotUploader enrollmentId={e.id} slot={slot.slot} hasFile={!!slot.sub} />
                    ) : (
                      !slot.sub && <p className="text-sm text-correction">마감되었습니다 · Closed</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </>
  );
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { assertSectionAccess, jsonError, requireStaff, HttpError } from "@/lib/auth";
import { audit, notify } from "@/lib/audit";

// 담당교수의 승인/반려. 학과장은 과제 내용을 승인하지 않는다(제출 여부 확인만).
export async function POST(req: NextRequest) {
  try {
    const staff = await requireStaff();
    if (staff.role === "head") {
      const { data: own } = await db().from("section_professors").select("section_id").eq("staff_id", staff.id).limit(1);
      if (!own?.length) throw new HttpError(403, "학과장은 과제 내용을 승인하지 않습니다. 담당교수가 승인합니다.");
    }
    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const reason = String(body.reason ?? "").trim();
    if (action !== "approve" && action !== "reject" && action !== "reset") throw new HttpError(400, "잘못된 요청입니다.");
    if (action === "reject" && !reason) throw new HttpError(400, "반려 사유를 입력해 주세요.");

    const { data: sub } = await db()
      .from("submissions")
      .select("id, slot, file_name, enrollment:enrollments!inner(id, student_id, section_id, final_confirmed_at, section:sections!inner(code, course:courses!inner(name)))")
      .eq("id", String(body.submissionId ?? ""))
      .maybeSingle();
    if (!sub) throw new HttpError(404, "제출물을 찾을 수 없습니다.");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const en = sub.enrollment as any;
    // 학과장도 본인이 배정된 분반만
    if (staff.role === "head") {
      const { data } = await db().from("section_professors").select("section_id").eq("staff_id", staff.id).eq("section_id", en.section_id).maybeSingle();
      if (!data) throw new HttpError(403, "담당 분반이 아닙니다.");
    } else {
      await assertSectionAccess(staff, en.section_id);
    }
    if (en.final_confirmed_at) throw new HttpError(409, "학과장 최종 확인이 끝난 건은 바꿀 수 없습니다.");

    const now = new Date().toISOString();
    const update =
      action === "approve"
        ? { status: "approved", reject_reason: null, reviewed_by: staff.id, reviewed_at: now }
        : action === "reject"
          ? { status: "rejected", reject_reason: reason.slice(0, 1000), reviewed_by: staff.id, reviewed_at: now }
          : { status: "submitted", reject_reason: null, reviewed_by: null, reviewed_at: null };
    const { error } = await db().from("submissions").update(update).eq("id", sub.id);
    if (error) throw error;

    const label = `${en.section.course.name} ${en.section.code}분반 과제 ${sub.slot}`;
    if (action === "reject") {
      await notify("student", [en.student_id], `${label}가 반려되었습니다. 사유: ${reason}. 마감 전까지 다시 제출해 주세요.`);
    } else if (action === "approve") {
      await notify("student", [en.student_id], `${label}가 승인되었습니다.`);
    }
    await audit({ type: "staff", id: staff.id, label: staff.name }, `submission.${action}`, sub.file_name, { reason: reason || undefined });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}

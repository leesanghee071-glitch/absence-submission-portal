import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { jsonError, requireStaff, HttpError } from "@/lib/auth";
import { loadEnrollments } from "@/lib/data";
import { audit, notify } from "@/lib/audit";

// 학과장 최종 확인 / 취소. 모든 과제가 승인된 건만 확인할 수 있다.
export async function POST(req: NextRequest) {
  try {
    const head = await requireStaff({ head: true });
    const body = await req.json().catch(() => ({}));
    const undo = body.undo === true;
    const ids: string[] = Array.isArray(body.enrollmentIds) ? body.enrollmentIds.map(String) : [];
    if (!body.allApproved && ids.length === 0) throw new HttpError(400, "확인할 대상을 골라 주세요.");

    const list = await loadEnrollments(body.allApproved ? {} : { enrollmentIds: ids });
    const now = new Date().toISOString();
    if (undo) {
      const targets = list.filter((e) => e.final_confirmed_at).map((e) => e.id);
      if (targets.length) await db().from("enrollments").update({ final_confirmed_at: null, final_confirmed_by: null }).in("id", targets);
      await audit({ type: "staff", id: head.id, label: head.name }, "final.undo", null, { count: targets.length, enrollmentIds: targets });
      return NextResponse.json({ ok: true, count: targets.length });
    }
    const targets = list.filter((e) => e.allApproved && !e.final_confirmed_at);
    const skipped = body.allApproved ? 0 : list.filter((e) => !e.allApproved).length;
    if (targets.length) {
      await db().from("enrollments").update({ final_confirmed_at: now, final_confirmed_by: head.id }).in("id", targets.map((e) => e.id));
      for (const e of targets) {
        await notify("student", [e.student.id], `${e.course.name} ${e.section.code}분반 공가 대체 과제가 최종 확인되었습니다.`);
      }
    }
    await audit({ type: "staff", id: head.id, label: head.name }, "final.confirm", null, {
      count: targets.length,
      enrollmentIds: targets.map((e) => e.id),
    });
    return NextResponse.json({ ok: true, count: targets.length, skipped });
  } catch (e) {
    return jsonError(e);
  }
}

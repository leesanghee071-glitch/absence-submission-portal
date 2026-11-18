import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { jsonError, requireStaff, HttpError } from "@/lib/auth";
import { audit } from "@/lib/audit";

// 마감 후 예외 허용: 학생·과목(수강)별 개별 마감 연장. until = null 이면 해제
export async function POST(req: NextRequest) {
  try {
    const head = await requireStaff({ head: true });
    const body = await req.json().catch(() => ({}));
    const enrollmentId = String(body.enrollmentId ?? "");
    const until = body.until ? new Date(body.until) : null;
    if (until && isNaN(until.getTime())) throw new HttpError(400, "날짜 형식이 올바르지 않습니다.");
    const { error, data } = await db()
      .from("enrollments")
      .update({ deadline_override: until?.toISOString() ?? null })
      .eq("id", enrollmentId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, "대상을 찾을 수 없습니다.");
    await audit({ type: "staff", id: head.id, label: head.name }, "deadline.override", enrollmentId, { until: until?.toISOString() ?? null });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}

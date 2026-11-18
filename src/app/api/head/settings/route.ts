import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { jsonError, requireStaff, HttpError } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const head = await requireStaff({ head: true });
    const b = await req.json().catch(() => ({}));
    const deadline = b.deadline ? new Date(b.deadline) : null;
    if (deadline && isNaN(deadline.getTime())) throw new HttpError(400, "마감일 형식이 올바르지 않습니다.");
    const days = Number(b.staff_session_days);
    if (!Number.isInteger(days) || days < 1 || days > 180) throw new HttpError(400, "로그인 유지 기간은 1~180일로 정해 주세요.");
    const quota = b.student_quota_mb === null || b.student_quota_mb === "" ? null : Number(b.student_quota_mb);
    if (quota !== null && (!Number.isInteger(quota) || quota < 10)) throw new HttpError(400, "총량 한도는 10MB 이상 정수로 정해 주세요.");
    const row = { deadline: deadline?.toISOString() ?? null, staff_session_days: days, student_quota_mb: quota, updated_at: new Date().toISOString() };
    const { error } = await db().from("app_settings").update(row).eq("id", 1);
    if (error) throw error;
    await audit({ type: "staff", id: head.id, label: head.name }, "settings.update", null, row);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}

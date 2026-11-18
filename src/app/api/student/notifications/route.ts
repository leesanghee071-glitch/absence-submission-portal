import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { jsonError, requireStudent } from "@/lib/auth";

// 알림 모두 읽음
export async function POST() {
  try {
    const student = await requireStudent();
    await db()
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_type", "student")
      .eq("recipient_id", student.id)
      .is("read_at", null);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}

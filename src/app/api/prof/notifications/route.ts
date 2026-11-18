import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { jsonError, requireStaff } from "@/lib/auth";

export async function POST() {
  try {
    const staff = await requireStaff();
    await db()
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_type", "staff")
      .eq("recipient_id", staff.id)
      .is("read_at", null);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}

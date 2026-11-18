import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/supabase";
import { jsonError, requireStaff, HttpError } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const staff = await requireStaff();
    const password = String((await req.json().catch(() => ({}))).password ?? "");
    if (password.length < 10) throw new HttpError(400, "비밀번호는 10자 이상으로 정해 주세요.");
    await db().from("staff").update({ password_hash: await bcrypt.hash(password, 10) }).eq("id", staff.id);
    await audit({ type: "staff", id: staff.id, label: staff.name }, "staff.password_set", staff.email);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}

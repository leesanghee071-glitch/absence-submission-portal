import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { jsonError, requireStaff } from "@/lib/auth";
import { audit } from "@/lib/audit";

// 분반별 과제 1~3번 제목. 학생마다 몇 개를 낼지는 수강(학생 명단)의 공가 주차로 정한다.
export async function PATCH(req: NextRequest) {
  try {
    const head = await requireStaff({ head: true });
    const b = await req.json().catch(() => ({}));
    const titles: string[] = [0, 1, 2].map((i) => String((Array.isArray(b.assignment_titles) ? b.assignment_titles[i] : "") ?? "").trim().slice(0, 100));
    const { error } = await db().from("sections").update({ assignment_titles: titles }).eq("id", String(b.sectionId));
    if (error) throw error;
    await audit({ type: "staff", id: head.id, label: head.name }, "section.update", String(b.sectionId), { titles });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}

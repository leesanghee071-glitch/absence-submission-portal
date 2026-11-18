import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { jsonError, requireStaff, HttpError } from "@/lib/auth";
import { audit } from "@/lib/audit";

// 분반별 과제 수(1~3)와 과제 제목
export async function PATCH(req: NextRequest) {
  try {
    const head = await requireStaff({ head: true });
    const b = await req.json().catch(() => ({}));
    const count = Number(b.assignment_count);
    if (!Number.isInteger(count) || count < 1 || count > 3) throw new HttpError(400, "과제 수는 1~3개입니다.");
    const titles: string[] = (Array.isArray(b.assignment_titles) ? b.assignment_titles : []).slice(0, 3).map((t: unknown) => String(t ?? "").trim().slice(0, 100));
    // 줄이려는 슬롯에 이미 제출물이 있으면 막는다
    const { data: subs } = await db()
      .from("submissions")
      .select("slot, enrollment:enrollments!inner(section_id)")
      .eq("enrollment.section_id", String(b.sectionId))
      .gt("slot", count)
      .limit(1);
    if (subs?.length) throw new HttpError(409, `과제 ${count + 1}번 이후에 이미 제출된 파일이 있어 줄일 수 없습니다.`);
    const { error } = await db().from("sections").update({ assignment_count: count, assignment_titles: titles }).eq("id", String(b.sectionId));
    if (error) throw error;
    await audit({ type: "staff", id: head.id, label: head.name }, "section.update", String(b.sectionId), { count, titles });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}

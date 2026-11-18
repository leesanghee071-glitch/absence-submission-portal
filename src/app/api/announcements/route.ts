import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { assertSectionAccess, jsonError, requireStaff, HttpError, StaffRow } from "@/lib/auth";
import { audit } from "@/lib/audit";

// 전체 공지(section_id 없음)는 학과장, 과목 공지는 그 분반 담당교수 또는 학과장
async function assertCanWrite(staff: StaffRow, sectionId: string | null) {
  if (!sectionId) {
    if (staff.role !== "head") throw new HttpError(403, "전체 공지는 학과장만 쓸 수 있습니다.");
    return;
  }
  await assertSectionAccess(staff, sectionId);
}

function readFields(b: Record<string, unknown>) {
  const title = String(b.title ?? "").trim().slice(0, 200);
  const body = String(b.body ?? "").trim().slice(0, 5000);
  if (!title) throw new HttpError(400, "제목을 입력해 주세요.");
  return { title, body };
}

export async function POST(req: NextRequest) {
  try {
    const staff = await requireStaff();
    const b = await req.json().catch(() => ({}));
    const { title, body } = readFields(b);
    const sectionId = b.sectionId ? String(b.sectionId) : null;
    await assertCanWrite(staff, sectionId);

    // 같은 과목의 내 다른 분반에도 함께 올리기
    let targets: (string | null)[] = [sectionId];
    if (sectionId && b.sameCourse) {
      const { data: sec } = await db().from("sections").select("course_id").eq("id", sectionId).single();
      let q = db().from("sections").select("id").eq("course_id", sec!.course_id);
      if (staff.role !== "head") {
        const { data: mine } = await db().from("section_professors").select("section_id").eq("staff_id", staff.id);
        q = q.in("id", (mine ?? []).map((m) => m.section_id));
      }
      const { data: secs } = await q;
      targets = Array.from(new Set([sectionId, ...(secs ?? []).map((s) => s.id as string)]));
    }
    const { error } = await db()
      .from("announcements")
      .insert(targets.map((t) => ({ section_id: t, title, body, author_id: staff.id })));
    if (error) throw error;
    await audit({ type: "staff", id: staff.id, label: staff.name }, "announcement.create", title, { sections: targets });
    return NextResponse.json({ ok: true, count: targets.length });
  } catch (e) {
    return jsonError(e);
  }
}

async function loadOwned(staff: StaffRow, id: string) {
  const { data } = await db().from("announcements").select("id, section_id, title").eq("id", id).maybeSingle();
  if (!data) throw new HttpError(404, "공지를 찾을 수 없습니다.");
  await assertCanWrite(staff, data.section_id);
  return data;
}

export async function PATCH(req: NextRequest) {
  try {
    const staff = await requireStaff();
    const b = await req.json().catch(() => ({}));
    const a = await loadOwned(staff, String(b.id ?? ""));
    const { title, body } = readFields(b);
    const { error } = await db().from("announcements").update({ title, body, updated_at: new Date().toISOString() }).eq("id", a.id);
    if (error) throw error;
    await audit({ type: "staff", id: staff.id, label: staff.name }, "announcement.update", title);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const staff = await requireStaff();
    const b = await req.json().catch(() => ({}));
    const a = await loadOwned(staff, String(b.id ?? ""));
    const { error } = await db().from("announcements").delete().eq("id", a.id);
    if (error) throw error;
    await audit({ type: "staff", id: staff.id, label: staff.name }, "announcement.delete", a.title);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}

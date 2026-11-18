import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { jsonError, requireStaff, HttpError } from "@/lib/auth";
import { ensureSection } from "@/lib/sections";
import { sendStaffLink } from "@/lib/staffTokens";
import { audit } from "@/lib/audit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 교수 등록 + 초대
export async function POST(req: NextRequest) {
  try {
    const head = await requireStaff({ head: true });
    const b = await req.json().catch(() => ({}));
    const name = String(b.name ?? "").trim();
    const email = String(b.email ?? "").trim().toLowerCase();
    if (!name) throw new HttpError(400, "이름을 입력해 주세요.");
    if (!EMAIL_RE.test(email)) throw new HttpError(400, "이메일 형식이 올바르지 않습니다.");
    const { data: dup } = await db().from("staff").select("id").eq("email", email).maybeSingle();
    if (dup) throw new HttpError(409, "이미 등록된 이메일입니다.");

    const { data: st, error } = await db()
      .from("staff")
      .insert({ name, email, role: "professor", status: "invited", invited_at: new Date().toISOString() })
      .select("id, name, email")
      .single();
    if (error) throw error;
    if (b.course && b.section) {
      const sectionId = await ensureSection(String(b.course), String(b.section));
      await db().from("section_professors").upsert({ section_id: sectionId, staff_id: st.id });
    }
    const r = await sendStaffLink(st, "invite", req.nextUrl.origin);
    await audit({ type: "staff", id: head.id, label: head.name }, "staff.invite", email, { emailed: r.sent });
    return NextResponse.json({ ok: true, link: r.link, sent: r.sent, emailError: r.error });
  } catch (e) {
    return jsonError(e);
  }
}

// 상태 변경, 이름 수정, 분반 배정/해제
export async function PATCH(req: NextRequest) {
  try {
    const head = await requireStaff({ head: true });
    const b = await req.json().catch(() => ({}));
    const { data: st } = await db().from("staff").select("id, email, role, status, last_login_at").eq("id", String(b.staffId ?? "")).maybeSingle();
    if (!st) throw new HttpError(404, "교수를 찾을 수 없습니다.");
    const label = { type: "staff" as const, id: head.id, label: head.name };

    if (b.status === "disabled" || b.status === "active") {
      if (st.role === "head") throw new HttpError(400, "학과장 계정은 여기서 비활성화할 수 없습니다.");
      // 재활성화: 아직 한 번도 로그인하지 않았다면 초대 중 상태로 되돌린다.
      const next = b.status === "disabled" ? "disabled" : st.last_login_at ? "active" : "invited";
      await db().from("staff").update({ status: next }).eq("id", st.id);
      await audit(label, b.status === "disabled" ? "staff.disable" : "staff.enable", st.email);
    }
    if (b.name) {
      await db().from("staff").update({ name: String(b.name).trim() }).eq("id", st.id);
      await audit(label, "staff.rename", st.email, { name: b.name });
    }
    if (b.addSection?.course && b.addSection?.section) {
      const sectionId = await ensureSection(String(b.addSection.course), String(b.addSection.section));
      await db().from("section_professors").upsert({ section_id: sectionId, staff_id: st.id });
      await audit(label, "staff.section_add", st.email, { sectionId, ...b.addSection });
    }
    if (b.removeSectionId) {
      await db().from("section_professors").delete().eq("section_id", String(b.removeSectionId)).eq("staff_id", st.id);
      await audit(label, "staff.section_remove", st.email, { sectionId: b.removeSectionId });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}

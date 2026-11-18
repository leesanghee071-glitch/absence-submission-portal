import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { jsonError, requireStaff, HttpError } from "@/lib/auth";
import { parseTable, pick } from "@/lib/csv";
import { ensureSection, normalizeCode } from "@/lib/sections";
import { sendStaffLink } from "@/lib/staffTokens";
import { audit } from "@/lib/audit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// CSV 일괄 등록 (이름, 이메일, 과목, 분반). preview=true면 점검만 한다.
export async function POST(req: NextRequest) {
  try {
    const head = await requireStaff({ head: true });
    const b = await req.json().catch(() => ({}));
    if (!b.text && !b.base64) throw new HttpError(400, "파일 내용이 없습니다.");
    const raw = parseTable({ text: b.text, base64: b.base64 });
    const rows = raw.map((r, i) => {
      const row = {
        line: i + 2,
        name: pick(r, ["이름", "성명", "name"]),
        email: pick(r, ["이메일", "email"]).toLowerCase(),
        course: pick(r, ["과목", "과목명", "course"]),
        section: normalizeCode(pick(r, ["분반", "section"])),
        errors: [] as string[],
      };
      if (!row.name) row.errors.push("이름 빈 칸");
      if (!EMAIL_RE.test(row.email)) row.errors.push("이메일 형식 오류");
      if (!row.course) row.errors.push("과목 빈 칸");
      if (!row.section) row.errors.push("분반 빈 칸");
      return row;
    });
    const emails = Array.from(new Set(rows.map((r) => r.email).filter(Boolean)));
    const { data: existing } = emails.length ? await db().from("staff").select("id, email, name").in("email", emails) : { data: [] };
    const known = new Map((existing ?? []).map((s) => [s.email, s]));
    if (b.preview) {
      return NextResponse.json({
        rows: rows.map((r) => ({ ...r, existing: known.has(r.email) })),
      });
    }

    const ok = rows.filter((r) => r.errors.length === 0);
    const invites: { email: string; link: string; sent: boolean }[] = [];
    for (const r of ok) {
      let st = known.get(r.email);
      if (!st) {
        const { data, error } = await db()
          .from("staff")
          .insert({ name: r.name, email: r.email, role: "professor", status: "invited", invited_at: new Date().toISOString() })
          .select("id, email, name")
          .single();
        if (error) throw error;
        st = data;
        known.set(r.email, data);
        const sent = await sendStaffLink(data, "invite", req.nextUrl.origin);
        invites.push({ email: r.email, link: sent.link, sent: sent.sent });
      }
      const sectionId = await ensureSection(r.course, r.section);
      await db().from("section_professors").upsert({ section_id: sectionId, staff_id: st!.id });
    }
    await audit({ type: "staff", id: head.id, label: head.name }, "staff.bulk", null, {
      rows: ok.length,
      invited: invites.length,
      skipped: rows.length - ok.length,
    });
    return NextResponse.json({ ok: true, invites, assigned: ok.length, skipped: rows.length - ok.length });
  } catch (e) {
    return jsonError(e);
  }
}

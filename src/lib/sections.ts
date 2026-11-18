import { db } from "@/lib/supabase";

// 과목명 + 분반으로 분반을 찾고, 없으면 만든다.
export async function ensureSection(courseName: string, code: string): Promise<string> {
  const name = courseName.trim();
  const c = normalizeCode(code);
  let { data: course } = await db().from("courses").select("id").eq("name", name).maybeSingle();
  if (!course) {
    const r = await db().from("courses").upsert({ name }, { onConflict: "name" }).select("id").single();
    if (r.error) throw r.error;
    course = r.data;
  }
  let { data: sec } = await db().from("sections").select("id").eq("course_id", course!.id).eq("code", c).maybeSingle();
  if (!sec) {
    const r = await db().from("sections").upsert({ course_id: course!.id, code: c }, { onConflict: "course_id,code" }).select("id").single();
    if (r.error) throw r.error;
    sec = r.data;
  }
  return sec!.id;
}

// "1", "01", "1분반" → "01"
export function normalizeCode(code: string): string {
  const s = String(code).trim().replace(/분반$/, "").trim();
  return /^\d$/.test(s) ? `0${s}` : s;
}

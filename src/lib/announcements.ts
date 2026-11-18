import { db } from "@/lib/supabase";

export type Announcement = {
  id: string;
  section_id: string | null;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
  author: { name: string } | null;
};

// sectionIds가 없으면 전체 공지만, 있으면 그 분반들의 과목 공지만
export async function loadAnnouncements(opts: { sectionIds?: string[] } = {}): Promise<Announcement[]> {
  let q = db()
    .from("announcements")
    .select("id, section_id, title, body, created_at, updated_at, author:staff(name)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (opts.sectionIds) {
    if (opts.sectionIds.length === 0) return [];
    q = q.in("section_id", opts.sectionIds);
  } else {
    q = q.is("section_id", null);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as Announcement[];
}

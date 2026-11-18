"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/api";
import { fmtDateTime } from "@/lib/format";
import type { Announcement } from "@/lib/announcements";

type Props = {
  items: Announcement[];
  heading: string;
  sectionId?: string | null; // 없으면 전체 공지
  canEdit?: boolean;
  sameCourseOption?: boolean; // "같은 과목의 내 다른 분반에도" 체크박스
  emptyText?: string;
  compact?: boolean; // 학생 과목 카드 안처럼 작게
};

export default function Announcements({ items, heading, sectionId = null, canEdit = false, sameCourseOption = false, emptyText, compact = false }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState({ title: "", body: "", sameCourse: false });
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  if (!canEdit && items.length === 0 && !emptyText) return null;

  async function save() {
    setBusy(true);
    try {
      if (editing === "new") await api("/api/announcements", "POST", { sectionId, ...form });
      else await api("/api/announcements", "PATCH", { id: editing, ...form });
      setEditing(null);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setBusy(false);
    }
  }

  async function remove(a: Announcement) {
    if (!confirm(`'${a.title}' 공지를 삭제할까요?`)) return;
    setBusy(true);
    try {
      await api("/api/announcements", "DELETE", { id: a.id });
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "삭제 실패");
    } finally {
      setBusy(false);
    }
  }

  const editor = (
    <div className="grid gap-2 border border-line rounded p-3 bg-white">
      <input className="input" placeholder="제목" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <textarea className="input" rows={5} placeholder="내용 (줄바꿈 그대로 보입니다)" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
      {editing === "new" && sameCourseOption && (
        <label className="text-sm flex items-center gap-1">
          <input type="checkbox" checked={form.sameCourse} onChange={(e) => setForm({ ...form, sameCourse: e.target.checked })} />
          같은 과목의 내가 맡은 다른 분반에도 올리기
        </label>
      )}
      <div className="flex gap-2">
        <button className="btn-primary btn-sm" disabled={busy || !form.title.trim()} onClick={save}>
          {editing === "new" ? "올리기" : "저장"}
        </button>
        <button className="btn btn-sm" onClick={() => setEditing(null)}>
          취소
        </button>
      </div>
    </div>
  );

  return (
    <section className={compact ? "grid gap-2" : "panel grid gap-3"}>
      <div className="flex items-center gap-2">
        <h2 className={compact ? "text-sm font-semibold" : "h2 mb-0"}>{heading}</h2>
        {canEdit && editing === null && (
          <button
            className="btn btn-sm ml-auto"
            onClick={() => {
              setForm({ title: "", body: "", sameCourse: false });
              setEditing("new");
            }}
          >
            + 공지 쓰기
          </button>
        )}
      </div>
      {editing === "new" && editor}
      {items.length === 0 && editing !== "new" && <p className="muted">{emptyText ?? "아직 공지가 없습니다."}</p>}
      <ul className="grid gap-2">
        {items.map((a, i) => {
          const expanded = open[a.id] ?? i === 0;
          return (
            <li key={a.id} className={`border border-line rounded bg-white ${compact ? "px-3 py-2" : "px-3 py-2.5"}`}>
              {editing === a.id ? (
                editor
              ) : (
                <>
                  <button className="w-full text-left flex flex-wrap items-baseline gap-x-2" onClick={() => setOpen({ ...open, [a.id]: !expanded })}>
                    <b className="text-sm">{a.title}</b>
                    <span className="text-xs text-ink-soft">
                      {fmtDateTime(a.created_at)}
                      {a.author?.name ? ` · ${a.author.name}` : ""}
                    </span>
                  </button>
                  {expanded && a.body && <p className="text-sm whitespace-pre-wrap mt-1.5">{a.body}</p>}
                  {canEdit && (
                    <div className="flex gap-2 mt-2">
                      <button
                        className="link text-xs"
                        onClick={() => {
                          setForm({ title: a.title, body: a.body, sameCourse: false });
                          setEditing(a.id);
                        }}
                      >
                        수정
                      </button>
                      <button className="text-xs text-correction underline" disabled={busy} onClick={() => remove(a)}>
                        삭제
                      </button>
                    </div>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

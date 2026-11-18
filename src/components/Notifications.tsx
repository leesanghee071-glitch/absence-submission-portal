"use client";

import { useState } from "react";
import { fmtDateTime } from "@/lib/format";
import { api } from "@/components/api";

type Note = { id: string; message: string; read_at: string | null; created_at: string; link?: string | null };

export default function Notifications({ items, endpoint = "/api/student/notifications" }: { items: Note[]; endpoint?: string }) {
  const [notes, setNotes] = useState(items);
  const unread = notes.filter((n) => !n.read_at).length;
  if (notes.length === 0) return null;
  return (
    <details className="panel" open={unread > 0}>
      <summary className="cursor-pointer font-medium">
        알림 · Notifications {unread > 0 && <span className="badge bg-correction text-white ml-1">{unread}</span>}
      </summary>
      <ul className="mt-3 grid gap-2">
        {notes.map((n) => (
          <li key={n.id} className={`text-sm ${n.read_at ? "text-ink-soft" : ""}`}>
            <span className="text-xs text-ink-soft mr-2">{fmtDateTime(n.created_at)}</span>
            {n.link ? (
              <a className="link" href={n.link}>
                {n.message}
              </a>
            ) : (
              n.message
            )}
          </li>
        ))}
      </ul>
      {unread > 0 && (
        <button
          className="btn btn-sm mt-3"
          onClick={async () => {
            await api(endpoint, "POST");
            setNotes(notes.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
          }}
        >
          모두 읽음 · Mark all read
        </button>
      )}
    </details>
  );
}

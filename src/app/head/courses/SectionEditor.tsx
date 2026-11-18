"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/api";

export default function SectionEditor({ id, count, titles }: { id: string; count: number; titles: string[] }) {
  const router = useRouter();
  const [n, setN] = useState(count);
  const [t, setT] = useState([0, 1, 2].map((i) => titles[i] ?? ""));
  const [busy, setBusy] = useState(false);
  const dirty = n !== count || t.some((v, i) => v !== (titles[i] ?? ""));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className="input w-auto py-1" value={n} onChange={(e) => setN(Number(e.target.value))}>
        {[1, 2, 3].map((v) => (
          <option key={v} value={v}>
            {v}개
          </option>
        ))}
      </select>
      {Array.from({ length: n }, (_, i) => (
        <input
          key={i}
          className="input py-1 w-40 text-xs"
          placeholder={`과제 ${i + 1} 제목`}
          value={t[i]}
          onChange={(e) => setT(t.map((v, j) => (j === i ? e.target.value : v)))}
        />
      ))}
      <button
        className="btn-primary btn-sm"
        disabled={!dirty || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api("/api/head/sections", "PATCH", { sectionId: id, assignment_count: n, assignment_titles: t.slice(0, n) });
            router.refresh();
          } catch (e) {
            alert(e instanceof Error ? e.message : "저장 실패");
          } finally {
            setBusy(false);
          }
        }}
      >
        저장
      </button>
    </div>
  );
}

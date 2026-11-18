"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/api";

export default function SectionEditor({ id, titles }: { id: string; titles: string[] }) {
  const router = useRouter();
  const [t, setT] = useState([0, 1, 2].map((i) => titles[i] ?? ""));
  const [busy, setBusy] = useState(false);
  const dirty = t.some((v, i) => v !== (titles[i] ?? ""));

  return (
    <div className="flex flex-wrap items-center gap-2">
      {t.map((v, i) => (
        <input
          key={i}
          className="input py-1 w-40 text-xs"
          placeholder={`과제 ${i + 1} 제목`}
          value={v}
          onChange={(e) => setT(t.map((x, j) => (j === i ? e.target.value : x)))}
        />
      ))}
      <button
        className="btn-primary btn-sm"
        disabled={!dirty || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api("/api/head/sections", "PATCH", { sectionId: id, assignment_titles: t });
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

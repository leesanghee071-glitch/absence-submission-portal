"use client";

import { useState } from "react";
import JSZip from "jszip";
import { api } from "@/components/api";

// 서버에서 서명 링크 목록을 받아 브라우저에서 ZIP으로 묶는다.
export default function ZipButton({ query, label = "ZIP 다운로드" }: { query: string; label?: string }) {
  const [progress, setProgress] = useState<string | null>(null);

  async function run() {
    try {
      setProgress("목록 준비 중…");
      const { zipName, files } = await api<{ zipName: string; files: { path: string; url: string }[] }>(`/api/exports/zip${query}`, "GET");
      if (files.length === 0) {
        alert("내려받을 파일이 없습니다.");
        return;
      }
      const zip = new JSZip();
      let done = 0;
      const queue = [...files];
      const failed: string[] = [];
      async function worker() {
        for (let f = queue.shift(); f; f = queue.shift()) {
          const res = await fetch(f.url);
          if (res.ok) zip.file(f.path, await res.blob());
          else failed.push(f.path);
          done++;
          setProgress(`파일 받는 중 ${done}/${files.length}`);
        }
      }
      await Promise.all(Array.from({ length: 4 }, worker));
      setProgress("압축 중…");
      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = zipName;
      a.click();
      URL.revokeObjectURL(a.href);
      if (failed.length) alert(`${failed.length}개 파일을 받지 못했습니다:\n${failed.slice(0, 10).join("\n")}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "다운로드 실패");
    } finally {
      setProgress(null);
    }
  }

  return (
    <button className="btn" onClick={run} disabled={!!progress}>
      {progress ?? label}
    </button>
  );
}

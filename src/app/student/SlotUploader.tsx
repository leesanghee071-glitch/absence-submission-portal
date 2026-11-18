"use client";

import { useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { api } from "@/components/api";
import { ACCEPT_ATTR, contentTypeFor, extOf, isAllowedFile, MAX_FILE_BYTES } from "@/lib/files";

const BUCKET = "assignments";

export default function SlotUploader({ enrollmentId, slot, hasFile }: { enrollmentId: string; slot: number; hasFile: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function upload(file: File) {
    setError("");
    if (!isAllowedFile(file.name)) return setError("PDF, hwp, hwpx, docx 파일만 올릴 수 있습니다. · Only PDF/HWP/HWPX/DOCX.");
    if (file.size > MAX_FILE_BYTES) return setError("파일이 10MB를 넘습니다. · File exceeds 10MB.");
    if (hasFile && !confirm("기존 파일을 새 파일로 바꿀까요? 승인 상태는 다시 '제출 완료'가 됩니다.\nReplace the existing file?")) return;
    try {
      setBusy("업로드 링크 확인 중…");
      const t = await api<{ ticketId: string; path: string; token: string }>("/api/student/upload-url", "POST", {
        enrollmentId,
        slot,
        fileName: file.name,
        size: file.size,
      });
      setBusy("업로드 중 · Uploading…");
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const { error: upErr } = await sb.storage.from(BUCKET).uploadToSignedUrl(t.path, t.token, file, {
        contentType: contentTypeFor(extOf(file.name)),
      });
      if (upErr) throw new Error(`업로드 실패: ${upErr.message}`);
      setBusy("확인 중…");
      await api("/api/student/finalize", "POST", { ticketId: t.ticketId });
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "업로드 실패");
      setBusy(null);
    }
  }

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) upload(f);
        }}
      />
      <button className={hasFile ? "btn btn-sm" : "btn-primary btn-sm"} disabled={!!busy} onClick={() => input.current?.click()}>
        {busy ?? (hasFile ? "파일 교체 · Replace" : "파일 올리기 · Upload")}
      </button>
      {error && <p className="text-sm text-correction mt-2">{error}</p>}
    </div>
  );
}

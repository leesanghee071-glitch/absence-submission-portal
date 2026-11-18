"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/api";

export default function ReviewControls({ submissionId, status }: { submissionId: string; status: string }) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function act(action: "approve" | "reject" | "reset") {
    setBusy(true);
    try {
      await api("/api/prof/review", "POST", { submissionId, action, reason });
      setRejecting(false);
      setReason("");
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "처리 실패");
    } finally {
      setBusy(false);
    }
  }

  if (rejecting)
    return (
      <div className="grid gap-1 min-w-[220px]">
        <textarea className="input text-xs" rows={2} placeholder="반려 사유 (학생에게 보입니다)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="flex gap-1">
          <button className="btn-danger btn-sm" disabled={busy || !reason.trim()} onClick={() => act("reject")}>
            반려
          </button>
          <button className="btn btn-sm" onClick={() => setRejecting(false)}>
            취소
          </button>
        </div>
      </div>
    );

  return (
    <div className="flex gap-1">
      {status !== "approved" && (
        <button className="btn-primary btn-sm" disabled={busy} onClick={() => act("approve")}>
          승인
        </button>
      )}
      {status !== "rejected" && (
        <button className="btn-danger btn-sm" disabled={busy} onClick={() => setRejecting(true)}>
          반려
        </button>
      )}
      {status !== "submitted" && (
        <button className="btn btn-sm" disabled={busy} onClick={() => act("reset")} title="검토 전 상태로 되돌리기">
          되돌리기
        </button>
      )}
    </div>
  );
}

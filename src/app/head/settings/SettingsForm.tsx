"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/api";
import type { Settings } from "@/lib/settings";

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 16);
}

export default function SettingsForm({ settings }: { settings: Settings }) {
  const router = useRouter();
  const [deadline, setDeadline] = useState(toLocalInput(settings.deadline));
  const [days, setDays] = useState(String(settings.staff_session_days));
  const [quota, setQuota] = useState(settings.student_quota_mb ? String(settings.student_quota_mb) : "");
  const [purge, setPurge] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <>
      <form
        className="panel grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api("/api/head/settings", "POST", {
              deadline: deadline ? new Date(`${deadline}:00+09:00`).toISOString() : null,
              staff_session_days: Number(days),
              student_quota_mb: quota ? Number(quota) : null,
            });
            alert("저장했습니다.");
            router.refresh();
          } catch (err) {
            alert(err instanceof Error ? err.message : "저장 실패");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="grid gap-1 text-sm">
          공통 마감일 (한국 시간) — 전 과목 동일. 마감 후에는 업로드가 막히고, 학생 명단에서 학생·과목별로 예외 연장할 수 있습니다.
          <input type="datetime-local" className="input w-auto" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          교수·학과장 로그인 유지 기간 (일) — 다음 로그인부터 적용
          <input type="number" min={1} max={180} className="input w-32" value={days} onChange={(e) => setDays(e.target.value)} required />
        </label>
        <label className="grid gap-1 text-sm">
          학생별 총 업로드 한도 (MB) — 비우면 제한 없음 (파일당 10MB는 항상 적용)
          <input type="number" min={10} className="input w-32" value={quota} onChange={(e) => setQuota(e.target.value)} placeholder="제한 없음" />
        </label>
        <button className="btn-primary w-fit" disabled={busy}>
          저장
        </button>
      </form>

      <section className="panel grid gap-3 border-correction/40">
        <h2 className="h2 text-correction">보관 기간 종료 — 원본 파일 삭제</h2>
        <p className="text-sm">
          모든 과제 원본 파일을 스토리지에서 지웁니다. 공가 인정 엑셀에 필요한 제출 기록(파일명, 제출 일시, 승인 상태, 최종 확인일)은 남습니다. 되돌릴 수 없으니 필요한 ZIP을 먼저 받아 두세요.
        </p>
        <div className="flex gap-2">
          <input className="input max-w-xs" placeholder="'원본 삭제'라고 입력" value={purge} onChange={(e) => setPurge(e.target.value)} />
          <button
            className="btn-danger"
            disabled={busy || purge !== "원본 삭제"}
            onClick={async () => {
              if (!confirm("정말 모든 원본 파일을 삭제할까요?")) return;
              setBusy(true);
              try {
                const r = await api<{ removed: number }>("/api/head/purge-files", "POST", { confirm: purge });
                alert(`${r.removed}개 파일을 삭제했습니다.`);
                setPurge("");
              } catch (err) {
                alert(err instanceof Error ? err.message : "삭제 실패");
              } finally {
                setBusy(false);
              }
            }}
          >
            원본 파일 모두 삭제
          </button>
        </div>
      </section>
    </>
  );
}

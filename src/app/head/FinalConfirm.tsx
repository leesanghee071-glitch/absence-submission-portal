"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/api";
import { fmtDate } from "@/lib/format";

type Row = { id: string; course: string; section: string; studentNo: string; name: string; weeks: string | null; confirmedAt: string | null };

export default function FinalConfirm({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const waiting = rows.filter((r) => !r.confirmedAt);
  const done = rows.filter((r) => r.confirmedAt);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [showDone, setShowDone] = useState(false);

  async function confirm(ids: string[] | "all", undo = false) {
    const n = ids === "all" ? waiting.length : ids.length;
    if (!window.confirm(undo ? `${n}건의 최종 확인을 취소할까요?` : `${n}건을 최종 확인할까요? 확인 후에는 학생·교수가 내용을 바꿀 수 없습니다.`)) return;
    setBusy(true);
    try {
      const r = await api<{ count: number }>("/api/head/confirm", "POST", ids === "all" ? { allApproved: true } : { enrollmentIds: ids, undo });
      alert(`${r.count}건 처리했습니다.`);
      setSel(new Set());
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "처리 실패");
    } finally {
      setBusy(false);
    }
  }

  const toggle = (id: string) => {
    const n = new Set(sel);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setSel(n);
  };

  return (
    <section className="panel overflow-x-auto">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <h2 className="h2 mb-0">최종 확인 대기 ({waiting.length}건)</h2>
        <span className="muted">모든 과제가 승인된 건만 표시됩니다.</span>
        <div className="ml-auto flex gap-2">
          <button className="btn" disabled={busy || sel.size === 0} onClick={() => confirm(Array.from(sel))}>
            선택 {sel.size}건 최종 확인
          </button>
          <button className="btn-primary" disabled={busy || waiting.length === 0} onClick={() => confirm("all")}>
            승인 완료 건 모두 최종 확인
          </button>
        </div>
      </div>
      {waiting.length > 0 && (
        <table className="tbl">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={sel.size === waiting.length}
                  onChange={(e) => setSel(e.target.checked ? new Set(waiting.map((w) => w.id)) : new Set())}
                />
              </th>
              <th>과목</th>
              <th>분반</th>
              <th>학번</th>
              <th>이름</th>
              <th>공가 인정 주차</th>
            </tr>
          </thead>
          <tbody>
            {waiting.map((r) => (
              <tr key={r.id}>
                <td>
                  <input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} />
                </td>
                <td>{r.course}</td>
                <td>{r.section}</td>
                <td>{r.studentNo}</td>
                <td>{r.name}</td>
                <td>{r.weeks ?? <span className="text-amber">미입력</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button className="text-sm link mt-3" onClick={() => setShowDone(!showDone)}>
        최종 확인 완료 {done.length}건 {showDone ? "접기" : "보기"}
      </button>
      {showDone && done.length > 0 && (
        <table className="tbl mt-2">
          <tbody>
            {done.map((r) => (
              <tr key={r.id}>
                <td>{r.course}</td>
                <td>{r.section}</td>
                <td>{r.studentNo}</td>
                <td>{r.name}</td>
                <td>{fmtDate(r.confirmedAt)}</td>
                <td>
                  <button className="btn btn-sm" disabled={busy} onClick={() => confirm([r.id], true)}>
                    확인 취소
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

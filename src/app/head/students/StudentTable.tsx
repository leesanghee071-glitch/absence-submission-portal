"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/api";
import { fmtDateTime } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";

export type StudentItem = {
  id: string;
  studentNo: string;
  name: string;
  department: string | null;
  lastLogin: string | null;
  locked: boolean;
  enrollments: { id: string; label: string; weeks: number; confirmed: boolean; deadlineOverride: string | null; status: string; progress: string }[];
};

// datetime-local 입력값 ↔ ISO (한국 시간 기준으로 입력받음)
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  return d.toISOString().slice(0, 16);
}
function fromLocalInput(v: string): string | null {
  return v ? new Date(`${v}:00+09:00`).toISOString() : null;
}

export default function StudentTable({ items }: { items: StudentItem[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "nologin" | "pending">("all");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [edit, setEdit] = useState({ name: "", department: "", birth: "" });

  const shown = useMemo(
    () =>
      items.filter((s) => {
        if (q && !`${s.studentNo} ${s.name} ${s.department ?? ""} ${s.enrollments.map((e) => e.label).join(" ")}`.toLowerCase().includes(q.toLowerCase())) return false;
        if (filter === "nologin" && s.lastLogin) return false;
        if (filter === "pending" && s.enrollments.every((e) => e.status === "승인 완료" || e.status === "최종 확인")) return false;
        return true;
      }),
    [items, q, filter]
  );

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      router.refresh();
      return true;
    } catch (e) {
      alert(e instanceof Error ? e.message : "처리 실패");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel overflow-x-auto">
      <div className="flex flex-wrap gap-2 items-center mb-3">
        <h2 className="h2 mb-0">등록 학생 ({items.length}명)</h2>
        <input className="input max-w-xs ml-auto" placeholder="학번·이름·과목 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input w-auto" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="all">전체</option>
          <option value="nologin">로그인한 적 없음</option>
          <option value="pending">미완료 과목 있음</option>
        </select>
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <th>학번</th>
            <th>이름 · 학과</th>
            <th>로그인</th>
            <th>과목·분반 / 제출 현황 / 공가 주차 / 마감 연장</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {shown.map((s) => (
            <tr key={s.id}>
              <td className="whitespace-nowrap">{s.studentNo}</td>
              <td>
                {editing === s.id ? (
                  <div className="grid gap-1 min-w-[180px]">
                    <input className="input text-xs py-1" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="이름" />
                    <input className="input text-xs py-1" value={edit.department} onChange={(e) => setEdit({ ...edit, department: e.target.value })} placeholder="학과" />
                    <input className="input text-xs py-1" value={edit.birth} onChange={(e) => setEdit({ ...edit, birth: e.target.value })} placeholder="생년월일 변경 시만 입력" />
                    <div className="flex gap-1">
                      <button
                        className="btn-primary btn-sm"
                        disabled={busy}
                        onClick={async () => {
                          if (await run(() => api("/api/head/students", "PATCH", { studentId: s.id, ...edit, birth: edit.birth || undefined }))) setEditing(null);
                        }}
                      >
                        저장
                      </button>
                      <button className="btn btn-sm" onClick={() => setEditing(null)}>
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {s.name}
                    <p className="text-xs text-ink-soft">{s.department}</p>
                  </>
                )}
              </td>
              <td className="text-xs whitespace-nowrap">
                {s.lastLogin ? fmtDateTime(s.lastLogin) : <span className="text-amber">로그인 안 함</span>}
                {s.locked && (
                  <div>
                    <span className="badge bg-correction-soft text-correction">잠김</span>{" "}
                    <button className="link" disabled={busy} onClick={() => run(() => api("/api/head/students", "PATCH", { studentId: s.id, unlock: true }))}>
                      해제
                    </button>
                  </div>
                )}
              </td>
              <td>
                <ul className="grid gap-2">
                  {s.enrollments.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-center gap-2 text-xs">
                      <b className="text-sm font-medium">{e.label}</b>
                      <StatusBadge status={e.status} />
                      <span className="text-ink-soft">{e.progress}</span>
                      <label className="flex items-center gap-1" title="공가 주차 = 제출할 과제 수">
                        공가
                        <select
                          className="input text-xs py-0.5 w-auto"
                          value={e.weeks}
                          disabled={busy || e.confirmed}
                          onChange={(ev) => run(() => api("/api/head/students", "PATCH", { enrollmentId: e.id, requiredCount: Number(ev.target.value) }))}
                        >
                          {[1, 2, 3].map((n) => (
                            <option key={n} value={n}>
                              {n}주 (과제 {n}개)
                            </option>
                          ))}
                        </select>
                      </label>
                      <input
                        type="datetime-local"
                        className="input text-xs py-0.5 w-auto"
                        defaultValue={toLocalInput(e.deadlineOverride)}
                        title="이 학생·과목만 마감 연장 (비우면 공통 마감)"
                        onBlur={(ev) => {
                          const v = fromLocalInput(ev.target.value);
                          if (v !== (e.deadlineOverride ? new Date(e.deadlineOverride).toISOString() : null)) run(() => api("/api/head/extend", "POST", { enrollmentId: e.id, until: v }));
                        }}
                      />
                      <button
                        className="text-correction"
                        title="이 과목에서 제외"
                        disabled={busy}
                        onClick={() => confirm(`${s.name} 학생을 ${e.label}에서 제외할까요? 제출 파일도 삭제됩니다.`) && run(() => api("/api/head/students", "DELETE", { enrollmentId: e.id }))}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              </td>
              <td className="whitespace-nowrap">
                <div className="grid gap-1">
                  <button
                    className="btn btn-sm"
                    onClick={() => {
                      setEditing(s.id);
                      setEdit({ name: s.name, department: s.department ?? "", birth: "" });
                    }}
                  >
                    수정
                  </button>
                  <button
                    className="btn-danger btn-sm"
                    disabled={busy}
                    onClick={() => confirm(`${s.studentNo} ${s.name} 학생을 명단에서 삭제할까요? 제출 기록과 파일도 모두 삭제됩니다.`) && run(() => api("/api/head/students", "DELETE", { studentId: s.id }))}
                  >
                    삭제
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, readTableFile } from "@/components/api";
import { fmtDateTime } from "@/lib/format";

export type ProfRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "invited" | "active" | "disabled";
  lastLogin: string | null;
  invitedAt: string | null;
  hasPassword: boolean;
  sections: { id: string; label: string }[];
};

const STATUS: Record<string, [string, string]> = {
  invited: ["초대 중", "bg-amber-soft text-amber"],
  active: ["활성", "bg-ok-soft text-ok"],
  disabled: ["비활성", "bg-paper text-ink-soft border border-line"],
};

type LinkResult = { link: string; sent: boolean; emailError?: string };

export default function ProfessorManager({ rows }: { rows: ProfRow[] }) {
  const router = useRouter();
  const [onlyInvited, setOnlyInvited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<{ who: string; r: LinkResult } | null>(null);
  const [form, setForm] = useState({ name: "", email: "", course: "", section: "" });
  const [addSec, setAddSec] = useState<Record<string, { course: string; section: string }>>({});
  const [bulk, setBulk] = useState<{ payload: { text?: string; base64?: string }; rows: BulkRow[] } | null>(null);

  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(true);
    try {
      const r = await fn();
      router.refresh();
      return r;
    } catch (e) {
      alert(e instanceof Error ? e.message : "처리 실패");
    } finally {
      setBusy(false);
    }
  }

  const visible = rows.filter((r) => !onlyInvited || r.status === "invited");

  return (
    <>
      {link && (
        <div className="panel border-blueprint">
          <p className="text-sm mb-2">
            <b>{link.who}</b> —{" "}
            {link.r.sent ? "메일을 보냈습니다. 필요하면 아래 링크를 직접 전달해도 됩니다." : `메일을 보내지 못했습니다 (${link.r.emailError ?? "미설정"}). 아래 링크를 복사해 직접 전달해 주세요.`}
          </p>
          <div className="flex gap-2">
            <input className="input font-mono text-xs" readOnly value={link.r.link} onFocus={(e) => e.target.select()} />
            <button className="btn" onClick={() => navigator.clipboard.writeText(link.r.link)}>
              복사
            </button>
            <button className="btn" onClick={() => setLink(null)}>
              닫기
            </button>
          </div>
        </div>
      )}

      <section className="panel">
        <h2 className="h2">교수 등록 · 초대</h2>
        <form
          className="grid md:grid-cols-5 gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await run(() => api<LinkResult>("/api/head/staff", "POST", form));
            if (r) {
              setLink({ who: `${form.name} (${form.email})`, r });
              setForm({ name: "", email: "", course: "", section: "" });
            }
          }}
        >
          <input className="input" placeholder="이름" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="input" type="email" placeholder="이메일 (개인 이메일 가능)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <input className="input" placeholder="과목 (선택)" value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} />
          <input className="input" placeholder="분반 (선택, 예: 01)" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} />
          <button className="btn-primary" disabled={busy}>
            등록하고 초대 보내기
          </button>
        </form>
        <div className="mt-4 border-t border-line pt-4">
          <p className="text-sm mb-2">
            CSV 일괄 등록 — 열: <code>이름, 이메일, 과목, 분반</code> (교수 한 명이 여러 분반이면 행을 여러 개)
          </p>
          <input
            type="file"
            accept=".csv,.xlsx"
            className="text-sm"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              const payload = await readTableFile(f);
              const r = await run(() => api<{ rows: BulkRow[] }>("/api/head/staff/bulk", "POST", { ...payload, preview: true }));
              if (r) setBulk({ payload, rows: r.rows });
            }}
          />
          {bulk && <BulkPreview bulk={bulk} busy={busy} onCancel={() => setBulk(null)} onCommit={async () => {
            const r = await run(() => api<{ invites: { email: string; link: string; sent: boolean }[]; assigned: number; skipped: number }>("/api/head/staff/bulk", "POST", bulk.payload));
            if (r) {
              setBulk(null);
              const unsent = r.invites.filter((i) => !i.sent);
              alert(`분반 배정 ${r.assigned}건, 새 초대 ${r.invites.length}명, 건너뜀 ${r.skipped}행` + (unsent.length ? `\n\n메일을 보내지 못한 초대 링크:\n${unsent.map((i) => `${i.email}: ${i.link}`).join("\n")}` : ""));
            }
          }} />}
        </div>
      </section>

      <section className="panel overflow-x-auto">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="h2 mb-0">교수 목록 ({visible.length})</h2>
          <label className="text-sm flex items-center gap-1 ml-auto">
            <input type="checkbox" checked={onlyInvited} onChange={(e) => setOnlyInvited(e.target.checked)} />
            초대를 아직 수락하지 않은 교수만
          </label>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>이름</th>
              <th>이메일</th>
              <th>담당 분반</th>
              <th>최근 로그인</th>
              <th>상태</th>
              <th>링크 발송</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => {
              const [label, cls] = STATUS[p.status];
              const as = addSec[p.id] ?? { course: "", section: "" };
              const sendLink = async (purpose: "invite" | "login" | "reset") => {
                const r = await run(() => api<LinkResult>("/api/head/staff/link", "POST", { staffId: p.id, purpose }));
                if (r) setLink({ who: `${p.name} (${p.email})`, r });
              };
              return (
                <tr key={p.id} className={p.status === "disabled" ? "opacity-60" : ""}>
                  <td className="whitespace-nowrap">
                    {p.name}
                    {p.role === "head" && <span className="badge bg-blueprint text-white ml-1">학과장</span>}
                  </td>
                  <td className="text-xs">{p.email}</td>
                  <td className="min-w-[220px]">
                    <ul className="grid gap-1">
                      {p.sections.map((s) => (
                        <li key={s.id} className="flex items-center gap-1 text-xs">
                          {s.label}
                          <button
                            className="text-correction"
                            title="배정 해제"
                            disabled={busy}
                            onClick={() => confirm(`${p.name} 교수에게서 ${s.label}을 해제할까요?`) && run(() => api("/api/head/staff", "PATCH", { staffId: p.id, removeSectionId: s.id }))}
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="flex gap-1 mt-1">
                      <input className="input text-xs py-1" placeholder="과목" value={as.course} onChange={(e) => setAddSec({ ...addSec, [p.id]: { ...as, course: e.target.value } })} />
                      <input className="input text-xs py-1 w-16" placeholder="분반" value={as.section} onChange={(e) => setAddSec({ ...addSec, [p.id]: { ...as, section: e.target.value } })} />
                      <button
                        className="btn btn-sm"
                        disabled={busy || !as.course || !as.section}
                        onClick={async () => {
                          await run(() => api("/api/head/staff", "PATCH", { staffId: p.id, addSection: as }));
                          setAddSec({ ...addSec, [p.id]: { course: "", section: "" } });
                        }}
                      >
                        추가
                      </button>
                    </div>
                  </td>
                  <td className="text-xs whitespace-nowrap">{p.lastLogin ? fmtDateTime(p.lastLogin) : "-"}</td>
                  <td>
                    <span className={`badge ${cls}`}>{label}</span>
                    {p.hasPassword && <p className="text-xs text-ink-soft mt-1">비밀번호 설정됨</p>}
                  </td>
                  <td>
                    {p.status !== "disabled" && (
                      <div className="grid gap-1">
                        {p.status === "invited" && (
                          <button className="btn btn-sm" disabled={busy} onClick={() => sendLink("invite")}>
                            초대 재발송
                          </button>
                        )}
                        <button className="btn btn-sm" disabled={busy} onClick={() => sendLink("login")}>
                          로그인 링크
                        </button>
                        <button className="btn btn-sm" disabled={busy} onClick={() => sendLink("reset")}>
                          비밀번호 재설정
                        </button>
                      </div>
                    )}
                  </td>
                  <td>
                    {p.role !== "head" &&
                      (p.status === "disabled" ? (
                        <button className="btn btn-sm" disabled={busy} onClick={() => run(() => api("/api/head/staff", "PATCH", { staffId: p.id, status: "active" }))}>
                          재활성화
                        </button>
                      ) : (
                        <button
                          className="btn-danger btn-sm"
                          disabled={busy}
                          onClick={() => confirm(`${p.name} 교수 계정을 비활성화할까요? 로그인할 수 없게 됩니다.`) && run(() => api("/api/head/staff", "PATCH", { staffId: p.id, status: "disabled" }))}
                        >
                          비활성화
                        </button>
                      ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}

type BulkRow = { line: number; name: string; email: string; course: string; section: string; errors: string[]; existing: boolean };

function BulkPreview({ bulk, busy, onCancel, onCommit }: { bulk: { rows: BulkRow[] }; busy: boolean; onCancel: () => void; onCommit: () => void }) {
  const bad = bulk.rows.filter((r) => r.errors.length).length;
  return (
    <div className="mt-3 overflow-x-auto">
      <p className="text-sm mb-2">
        {bulk.rows.length}행 중 오류 {bad}행 (오류 행은 건너뜁니다)
      </p>
      <table className="tbl">
        <thead>
          <tr>
            <th>행</th>
            <th>이름</th>
            <th>이메일</th>
            <th>과목</th>
            <th>분반</th>
            <th>점검</th>
          </tr>
        </thead>
        <tbody>
          {bulk.rows.map((r) => (
            <tr key={r.line} className={r.errors.length ? "bg-correction-soft" : ""}>
              <td>{r.line}</td>
              <td>{r.name}</td>
              <td>{r.email}</td>
              <td>{r.course}</td>
              <td>{r.section}</td>
              <td className="text-xs">{r.errors.length ? r.errors.join(", ") : r.existing ? "기존 교수 — 분반만 추가" : "새로 초대"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-2 mt-2">
        <button className="btn-primary" disabled={busy || bad === bulk.rows.length} onClick={onCommit}>
          확인 — {bulk.rows.length - bad}행 반영
        </button>
        <button className="btn" onClick={onCancel}>
          취소
        </button>
      </div>
    </div>
  );
}

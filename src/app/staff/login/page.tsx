"use client";

import { useState } from "react";
import { api } from "@/components/api";

export default function StaffLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ next: string }>("/api/auth/staff-login", "POST", { email, password });
      window.location.href = r.next;
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : "로그인 실패" });
      setBusy(false);
    }
  }

  async function requestLink(purpose: "login" | "reset") {
    if (!email) return setMsg({ text: "이메일을 먼저 입력해 주세요." });
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ message: string }>("/api/auth/staff-request-link", "POST", { email, purpose });
      setMsg({ text: r.message, ok: true });
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : "요청 실패" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="max-w-sm mx-auto px-4 py-16">
      <h1 className="h1">교수 · 학과장 로그인</h1>
      <p className="muted mb-6">비밀번호를 설정하지 않았다면 이메일로 로그인 링크를 받으세요.</p>
      <form onSubmit={login} className="panel grid gap-4">
        <label className="grid gap-1 text-sm">
          이메일
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
        </label>
        <label className="grid gap-1 text-sm">
          비밀번호 (설정한 경우)
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
        {msg && <p className={`text-sm ${msg.ok ? "text-ok" : "text-correction"}`}>{msg.text}</p>}
        <button className="btn-primary" disabled={busy || !password}>
          비밀번호로 로그인
        </button>
        <div className="border-t border-line pt-4 grid gap-2">
          <button type="button" className="btn" disabled={busy} onClick={() => requestLink("login")}>
            이메일로 로그인 링크 받기
          </button>
          <button type="button" className="text-sm text-ink-soft underline" disabled={busy} onClick={() => requestLink("reset")}>
            비밀번호를 잊으셨나요?
          </button>
        </div>
      </form>
    </main>
  );
}

"use client";

import { useState } from "react";
import { api } from "@/components/api";

export default function StudentLogin() {
  const [studentNo, setStudentNo] = useState("");
  const [birth, setBirth] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/student-login", "POST", { studentNo, birth });
      window.location.href = "/student";
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인 실패");
      setBusy(false);
    }
  }

  return (
    <main className="max-w-sm mx-auto px-4 py-16">
      <h1 className="h1">학생 로그인</h1>
      <p className="muted mb-6">Student login — 공가 대상 명단에 있는 학생만 로그인할 수 있습니다.</p>
      <form onSubmit={submit} className="panel grid gap-4">
        <label className="grid gap-1 text-sm">
          학번 · Student ID
          <input className="input" value={studentNo} onChange={(e) => setStudentNo(e.target.value)} autoComplete="username" inputMode="numeric" required />
        </label>
        <label className="grid gap-1 text-sm">
          생년월일 · Date of birth (YYYYMMDD)
          <input
            className="input"
            value={birth}
            onChange={(e) => setBirth(e.target.value)}
            placeholder="20030507"
            inputMode="numeric"
            autoComplete="bday"
            required
          />
        </label>
        {error && <p className="text-sm text-correction">{error}</p>}
        <button className="btn-primary" disabled={busy}>
          {busy ? "확인 중…" : "로그인 · Log in"}
        </button>
      </form>
    </main>
  );
}

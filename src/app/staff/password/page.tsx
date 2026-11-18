"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/components/api";

function PasswordForm() {
  const first = useSearchParams().get("first") === "1";
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (pw !== pw2) return setError("두 비밀번호가 다릅니다.");
    try {
      await api("/api/auth/password", "POST", { password: pw });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    }
  }

  if (done)
    return (
      <div className="panel grid gap-3">
        <p className="text-ok">비밀번호를 저장했습니다. 다음부터 이메일과 비밀번호로 로그인할 수 있습니다.</p>
        <a className="btn-primary" href="/">
          계속하기
        </a>
      </div>
    );

  return (
    <form onSubmit={save} className="panel grid gap-3">
      <p className="text-sm">
        {first
          ? "환영합니다. 비밀번호를 설정해 두면 다음부터 메일 없이 로그인할 수 있습니다. 설정하지 않아도 매번 이메일 링크로 로그인할 수 있습니다."
          : "새 비밀번호를 정해 주세요."}
      </p>
      <input className="input" type="password" placeholder="비밀번호 (10자 이상)" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" minLength={10} required />
      <input className="input" type="password" placeholder="비밀번호 확인" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" required />
      {error && <p className="text-sm text-correction">{error}</p>}
      <button className="btn-primary">저장</button>
      {first && (
        <a className="btn" href="/">
          건너뛰기 (이메일 링크로만 로그인)
        </a>
      )}
    </form>
  );
}

export default function PasswordPage() {
  return (
    <main className="max-w-sm mx-auto px-4 py-16">
      <h1 className="h1 mb-4">비밀번호 설정</h1>
      <Suspense>
        <PasswordForm />
      </Suspense>
    </main>
  );
}

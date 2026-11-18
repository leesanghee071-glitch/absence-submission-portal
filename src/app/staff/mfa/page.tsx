"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/components/api";

function Mfa() {
  const params = useSearchParams();
  const [info, setInfo] = useState<{ enabled: boolean; qr?: string; secret?: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ enabled: boolean; qr?: string; secret?: string }>("/api/auth/mfa", "GET")
      .then(setInfo)
      .catch((e) => setError(e instanceof Error ? e.message : "불러오기 실패"));
  }, []);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/mfa", "POST", { code });
      const then = params.get("then");
      window.location.replace(then && then.startsWith("/staff/password") ? then : "/head");
    } catch (err) {
      setError(err instanceof Error ? err.message : "인증 실패");
      setBusy(false);
    }
  }

  return (
    <>
      {info && !info.enabled && (
        <div className="panel mb-4 grid gap-3">
          <p className="text-sm">
            학과장 계정은 2차 인증이 필수입니다. Google Authenticator, Microsoft Authenticator 등 인증 앱으로 아래 QR 코드를 찍어 등록한 뒤 6자리 코드를 입력하세요.
          </p>
          {info.qr && <img src={info.qr} alt="2차 인증 QR 코드" className="w-48 h-48 mx-auto" />}
          <p className="text-xs text-ink-soft break-all">QR을 찍을 수 없으면 직접 입력: {info.secret}</p>
        </div>
      )}
      <form onSubmit={verify} className="panel grid gap-3">
        <label className="grid gap-1 text-sm">
          인증 앱의 6자리 코드
          <input className="input tracking-widest text-center text-lg" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={6} required />
        </label>
        {error && <p className="text-sm text-correction">{error}</p>}
        <button className="btn-primary" disabled={busy}>
          확인
        </button>
      </form>
    </>
  );
}

export default function MfaPage() {
  return (
    <main className="max-w-sm mx-auto px-4 py-16">
      <h1 className="h1 mb-4">2차 인증</h1>
      <Suspense>
        <Mfa />
      </Suspense>
    </main>
  );
}

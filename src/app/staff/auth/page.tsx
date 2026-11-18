"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/components/api";

function Consume() {
  const params = useSearchParams();
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = params.get("t");
    if (!token) {
      setError("링크가 올바르지 않습니다.");
      return;
    }
    api<{ next: string }>("/api/auth/staff-token", "POST", { token })
      .then((r) => window.location.replace(r.next))
      .catch((e) => setError(e instanceof Error ? e.message : "로그인 실패"));
  }, [params]);

  return error ? (
    <>
      <p className="text-correction mb-4">{error}</p>
      <a className="link" href="/staff/login">
        로그인 화면으로
      </a>
    </>
  ) : (
    <p className="muted">로그인 중…</p>
  );
}

export default function StaffAuth() {
  return (
    <main className="max-w-sm mx-auto px-4 py-16">
      <h1 className="h1 mb-4">링크로 로그인</h1>
      <Suspense>
        <Consume />
      </Suspense>
    </main>
  );
}

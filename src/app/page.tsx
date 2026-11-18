import Link from "next/link";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";

export default async function Home() {
  const s = await readSession();
  if (s?.kind === "student") redirect("/student");
  if (s?.kind === "staff") redirect(s.role === "head" ? "/head" : "/prof");

  return (
    <main className="max-w-md mx-auto px-4 py-16">
      <h1 className="h1">유학생 공가 대체 과제 제출</h1>
      <p className="muted mb-8">
        입국이 늦어져 출석이 어려운 학생이 과제물을 제출해 공가를 인정받는 사이트입니다.
        <br />
        Late-arrival students submit assignments here for excused absence.
      </p>
      <div className="grid gap-3">
        <Link href="/login" className="btn-primary py-3">
          학생 로그인 · Student login
        </Link>
        <Link href="/staff/login" className="btn py-3">
          교수 · 학과장 로그인
        </Link>
      </div>
    </main>
  );
}

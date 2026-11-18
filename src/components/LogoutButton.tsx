"use client";

export default function LogoutButton({ to }: { to: string }) {
  return (
    <button
      className="text-sm text-ink-soft hover:text-ink underline underline-offset-2"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = to;
      }}
    >
      로그아웃
    </button>
  );
}

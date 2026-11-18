import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";

type Nav = { href: string; label: string };

export default function Header({ who, nav, logoutTo }: { who: string; nav: Nav[]; logoutTo: string }) {
  return (
    <header className="bg-sheet border-b border-line">
      <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <Link href="/" className="font-semibold">
          공가 대체 과제 제출
        </Link>
        <nav className="flex flex-wrap gap-4 text-sm">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="text-ink-soft hover:text-ink">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="text-ink-soft">{who}</span>
          <LogoutButton to={logoutTo} />
        </div>
      </div>
    </header>
  );
}

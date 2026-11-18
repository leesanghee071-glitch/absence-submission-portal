// 브라우저·서버 공용 포맷 헬퍼

// "2003-05-07", "2003.5.7", "20030507", 엑셀 날짜 일련번호 → "20030507". 실패 시 null
export function normalizeBirth(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "number" && raw > 10000 && raw < 80000) {
    const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
    return toBirth8(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  const s = String(raw).trim();
  let m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!m) m = s.match(/^(\d{4})[-./\s]+(\d{1,2})[-./\s]+(\d{1,2})\.?$/);
  if (!m) return null;
  return toBirth8(Number(m[1]), Number(m[2]), Number(m[3]));
}

function toBirth8(y: number, mo: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  if (y < 1940 || y > new Date().getFullYear()) return null;
  return `${y}${String(mo).padStart(2, "0")}${String(d).padStart(2, "0")}`;
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}

export const STATUS_LABEL: Record<string, string> = {
  missing: "미제출",
  submitted: "제출 완료",
  approved: "승인 완료",
  rejected: "반려",
};

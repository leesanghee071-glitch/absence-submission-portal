const STYLE: Record<string, string> = {
  missing: "bg-paper text-ink-soft border border-line",
  submitted: "bg-blueprint-soft text-blueprint",
  approved: "bg-ok-soft text-ok",
  rejected: "bg-correction-soft text-correction",
  "최종 확인": "bg-ok text-white",
  "승인 완료": "bg-ok-soft text-ok",
  "반려 있음": "bg-correction-soft text-correction",
  "검토 대기": "bg-blueprint-soft text-blueprint",
  "제출 중": "bg-amber-soft text-amber",
};
const LABEL: Record<string, string> = { missing: "미제출", submitted: "제출 완료", approved: "승인 완료", rejected: "반려" };

export default function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STYLE[status] ?? "bg-paper"}`}>{LABEL[status] ?? status}</span>;
}

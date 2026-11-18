import * as XLSX from "xlsx";

// CSV 문자열(또는 xlsx base64)을 헤더 기준 행 목록으로 바꾼다.
export function parseTable(input: { text?: string; base64?: string }): Record<string, unknown>[] {
  const wb = input.base64 ? XLSX.read(input.base64, { type: "base64" }) : XLSX.read(input.text ?? "", { type: "string", raw: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: true });
  return rows.map((r) => {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) o[k.replace(/^﻿/, "").replace(/\s+/g, "").toLowerCase()] = typeof v === "string" ? v.trim() : v;
    return o;
  });
}

export function pick(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k.toLowerCase()];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

export function pickRaw(row: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    const v = row[k.toLowerCase()];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return "";
}

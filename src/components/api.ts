"use client";

export async function api<T = Record<string, unknown>>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string }).message ?? `요청 실패 (${res.status})`);
  return data as T;
}

// CSV(UTF-8 또는 엑셀의 EUC-KR) / xlsx 파일을 서버로 보낼 형태로 읽는다.
export async function readTableFile(file: File): Promise<{ text?: string; base64?: string }> {
  const buf = await file.arrayBuffer();
  if (/\.xlsx?$/i.test(file.name)) {
    let bin = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { base64: btoa(bin) };
  }
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(buf) };
  } catch {
    return { text: new TextDecoder("euc-kr").decode(buf) };
  }
}

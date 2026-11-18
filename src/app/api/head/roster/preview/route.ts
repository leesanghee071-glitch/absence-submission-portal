import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireStaff, HttpError } from "@/lib/auth";
import { analyzeRoster } from "@/lib/roster";

// 업로드 전 점검 — 아무것도 저장하지 않는다.
export async function POST(req: NextRequest) {
  try {
    await requireStaff({ head: true });
    const b = await req.json().catch(() => ({}));
    if (!b.text && !b.base64) throw new HttpError(400, "파일 내용이 없습니다.");
    const result = await analyzeRoster({ text: b.text, base64: b.base64 });
    return NextResponse.json(result);
  } catch (e) {
    return jsonError(e);
  }
}

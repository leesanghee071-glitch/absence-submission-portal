import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { jsonError } from "@/lib/auth";
import { emailConfigured } from "@/lib/email";
import { sendStaffLink } from "@/lib/staffTokens";

// 등록 여부를 드러내지 않도록 항상 같은 응답을 준다.
export async function POST(req: NextRequest) {
  try {
    if (!emailConfigured()) {
      return NextResponse.json(
        { message: "메일 발송이 아직 설정되지 않았습니다. 학과장에게 로그인 링크를 요청해 주세요." },
        { status: 503 }
      );
    }
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();
    const purpose = body.purpose === "reset" ? "reset" : "login";
    if (email) {
      const { data: st } = await db().from("staff").select("id, name, email, status").eq("email", email).maybeSingle();
      if (st && st.status !== "disabled") await sendStaffLink(st, purpose, req.nextUrl.origin);
    }
    return NextResponse.json({ message: "등록된 이메일이라면 링크를 보냈습니다. 메일함을 확인해 주세요." });
  } catch (e) {
    return jsonError(e);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { birthHash, safeEqualHex } from "@/lib/crypto";
import { normalizeBirth } from "@/lib/format";
import { jsonError, setStudentSession } from "@/lib/auth";
import { audit } from "@/lib/audit";

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;
const FAIL = "학번 또는 생년월일이 맞지 않거나 공가 대상 명단에 없습니다.";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const studentNo = String(body.studentNo ?? "").trim();
    const birth = normalizeBirth(body.birth);
    if (!studentNo || !birth) {
      return NextResponse.json({ message: "학번과 생년월일(예: 20030507)을 입력해 주세요." }, { status: 400 });
    }
    const { data: st } = await db()
      .from("students")
      .select("id, name, birth_hash, failed_attempts, locked_until")
      .eq("student_no", studentNo)
      .maybeSingle();
    if (!st) return NextResponse.json({ message: FAIL }, { status: 401 });

    if (st.locked_until && new Date(st.locked_until).getTime() > Date.now()) {
      return NextResponse.json({ message: `로그인 실패가 많아 ${LOCK_MINUTES}분간 잠겼습니다. 잠시 후 다시 시도해 주세요.` }, { status: 429 });
    }
    if (!safeEqualHex(birthHash(studentNo, birth), st.birth_hash)) {
      const fails = (st.failed_attempts ?? 0) + 1;
      const lock = fails >= MAX_FAILS;
      await db()
        .from("students")
        .update({
          failed_attempts: lock ? 0 : fails,
          locked_until: lock ? new Date(Date.now() + LOCK_MINUTES * 60000).toISOString() : null,
        })
        .eq("id", st.id);
      if (lock) await audit({ type: "student", id: st.id, label: studentNo }, "student.locked", studentNo);
      return NextResponse.json({ message: FAIL }, { status: 401 });
    }
    await db().from("students").update({ failed_attempts: 0, locked_until: null, last_login_at: new Date().toISOString() }).eq("id", st.id);
    const res = NextResponse.json({ ok: true });
    await setStudentSession(res, st.id);
    return res;
  } catch (e) {
    return jsonError(e);
  }
}

// 첫 학과장 계정을 만들고 초대 링크를 출력합니다.
// 사용법: npm run create-head -- 이메일 이름
//   (.env.local 의 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, APP_URL 사용)
import { readFileSync, existsSync } from "fs";
import { createHash, randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";

for (const f of [".env.local", ".env"]) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const [email, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(" ");
if (!email || !name) {
  console.error("사용법: npm run create-head -- 이메일 이름");
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 를 .env.local 에 넣어 주세요.");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const lower = email.trim().toLowerCase();
let { data: st } = await db.from("staff").select("id, role").eq("email", lower).maybeSingle();
if (st) {
  await db.from("staff").update({ role: "head", status: st.role === "head" ? undefined : "invited" }).eq("id", st.id);
} else {
  const r = await db.from("staff").insert({ name, email: lower, role: "head", status: "invited", invited_at: new Date().toISOString() }).select("id").single();
  if (r.error) throw r.error;
  st = r.data;
}
const token = randomBytes(32).toString("base64url");
const { error } = await db.from("staff_tokens").insert({
  staff_id: st.id,
  purpose: "invite",
  token_hash: createHash("sha256").update(token).digest("hex"),
  expires_at: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
});
if (error) throw error;
await db.from("audit_logs").insert({ actor_type: "system", action: "staff.invite", target: lower, detail: { role: "head", via: "create-head script" } });

const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
console.log(`\n학과장 계정: ${name} <${lower}>`);
console.log(`초대 링크 (7일 유효, 1회용):\n${base}/staff/auth?t=${encodeURIComponent(token)}\n`);
console.log("링크로 들어가 비밀번호를 정하면, 다음부터 이메일과 비밀번호로 로그인합니다. 비밀번호를 잊었을 때도 이 명령으로 새 링크를 만듭니다.");

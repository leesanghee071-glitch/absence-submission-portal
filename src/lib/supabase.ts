import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const BUCKET = "assignments";

let cached: SupabaseClient | null = null;

// 서버(API route, server component)에서만 사용 — service role 키는 브라우저에 절대 보내지 않는다.
export function db(): SupabaseClient {
  if (!cached) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase 환경변수가 설정되지 않았습니다.");
    cached = createClient(url, key, { auth: { persistSession: false } });
  }
  return cached;
}

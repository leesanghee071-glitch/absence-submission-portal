import { db } from "@/lib/supabase";

export type Settings = {
  deadline: string | null;
  staff_session_days: number;
  student_quota_mb: number | null;
};

export async function getSettings(): Promise<Settings> {
  const { data } = await db().from("app_settings").select("deadline, staff_session_days, student_quota_mb").eq("id", 1).maybeSingle();
  return (data as Settings) ?? { deadline: null, staff_session_days: 30, student_quota_mb: null };
}

export function effectiveDeadline(settings: Settings, override: string | null): string | null {
  return override ?? settings.deadline;
}

export function isPastDeadline(deadline: string | null): boolean {
  return !!deadline && Date.now() > new Date(deadline).getTime();
}

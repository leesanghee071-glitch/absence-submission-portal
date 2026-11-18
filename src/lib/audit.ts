import { db } from "@/lib/supabase";

type Actor = { type: "staff" | "student" | "system"; id?: string | null; label?: string | null };

export async function audit(actor: Actor, action: string, target?: string | null, detail?: Record<string, unknown>) {
  const { error } = await db().from("audit_logs").insert({
    actor_type: actor.type,
    actor_id: actor.id ?? null,
    actor_label: actor.label ?? null,
    action,
    target: target ?? null,
    detail: detail ?? null,
  });
  if (error) console.error("audit log 실패", error);
}

export async function notify(recipientType: "student" | "staff", recipientIds: string[], message: string, link?: string) {
  if (recipientIds.length === 0) return;
  const { error } = await db()
    .from("notifications")
    .insert(recipientIds.map((id) => ({ recipient_type: recipientType, recipient_id: id, message, link: link ?? null })));
  if (error) console.error("알림 저장 실패", error);
}

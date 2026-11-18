// 메일 발송 — RESEND_API_KEY/EMAIL_FROM이 없으면 보내지 않고 sent:false를 돌려준다.
// (그때는 학과장 화면에 링크를 보여 주어 직접 전달)

export function emailConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(to: string, subject: string, text: string): Promise<{ sent: boolean; error?: string }> {
  if (!emailConfigured()) return { sent: false, error: "메일 발송이 설정되지 않았습니다." };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text }),
    });
    if (!res.ok) return { sent: false, error: `메일 발송 실패 (${res.status})` };
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "메일 발송 실패" };
  }
}

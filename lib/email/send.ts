export interface EmailPayload {
  to: string[];
  from: string;
  subject: string;
  html: string;
}

export async function sendEmail(payload: EmailPayload): Promise<{ ok: boolean; message: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, message: "RESEND_API_KEY not set" };
  if (!payload.to.length) return { ok: false, message: "No recipients" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: payload.from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { ok: false, message: `Resend ${res.status}: ${err.slice(0, 100)}` };
    }
    return { ok: true, message: `ส่งอีเมลไป ${payload.to.length} ผู้รับ` };
  } catch {
    return { ok: false, message: "ส่งอีเมลไม่สำเร็จ (network)" };
  }
}

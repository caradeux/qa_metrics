import { Resend } from "resend";

export interface MailPayload {
  to: string;
  cc?: string[];
  subject: string;
  html: string;
  replyTo?: string;
}

let client: Resend | null = null;
function getClient(): Resend {
  if (!client) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY is not set");
    client = new Resend(key);
  }
  return client;
}

export async function sendMail(payload: MailPayload): Promise<void> {
  const email = process.env.ALERT_FROM_EMAIL;
  if (!email) throw new Error("ALERT_FROM_EMAIL is not set");
  const fromName = process.env.ALERT_FROM_NAME?.trim() || "QA Metrics";
  const from = `${fromName} <${email}>`;

  const { data, error } = await getClient().emails.send({
    from,
    to: [payload.to],
    cc: payload.cc && payload.cc.length ? payload.cc : undefined,
    subject: payload.subject,
    html: payload.html,
    replyTo: payload.replyTo,
  });

  if (error) throw new Error(error.message ?? "Resend error");
  if (!data?.id) throw new Error("Resend returned no message id");
}

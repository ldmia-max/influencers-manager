import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  // Emails desactivados temporalmente
  if (process.env.ENABLE_EMAILS !== "true") {
    return { success: false, error: "Emails disabled" };
  }

  if (!resend) {
    console.warn("RESEND_API_KEY not set, skipping email");
    return { success: false, error: "No API key" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });

    if (error) {
      console.error("Error sending email:", error);
      return { success: false, error };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.error("Resend error:", err);
    return { success: false, error: err };
  }
}

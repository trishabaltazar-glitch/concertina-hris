type InviteEmailInput = {
  to: string;
  name: string;
  inviteUrl: string;
};

export async function sendInviteEmail({ to, name, inviteUrl }: InviteEmailInput) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATION_EMAIL_FROM || process.env.PASSWORD_RESET_EMAIL_FROM;

  if (!resendApiKey || !from) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[invite-email] Setup link for ${to}: ${inviteUrl}`);
    }
    return { sent: false, reason: "missing-config" as const };
  }

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: "Set up your Concertina HR account",
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#13233f">
            <h2 style="margin:0 0 12px">Welcome to Concertina HR</h2>
            <p>Hi ${name},</p>
            <p>Your HR portal account has been created. Use the secure one-time link below to set your password.</p>
            <p>
              <a href="${inviteUrl}" style="display:inline-block;background:#253368;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:600">
                Set up account
              </a>
            </p>
            <p>This setup link expires in 48 hours.</p>
          </div>
        `,
        text: `Hi ${name},\n\nYour Concertina HR account has been created. Set your password here: ${inviteUrl}\n\nThis setup link expires in 48 hours.`,
      }),
    });
  } catch (error) {
    console.error("Failed to send invite email:", error);
    return { sent: false, reason: "network-error" as const };
  }

  if (!response.ok) {
    console.error("Failed to send invite email:", await response.text());
    return { sent: false, reason: "resend-error" as const };
  }

  return { sent: true, reason: "sent" as const };
}

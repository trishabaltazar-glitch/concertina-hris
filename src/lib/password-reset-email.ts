type PasswordResetEmailInput = {
  to: string;
  resetUrl: string;
};

export async function sendPasswordResetEmail({ to, resetUrl }: PasswordResetEmailInput) {
  const from = process.env.PASSWORD_RESET_EMAIL_FROM || "Concertina HR <no-reply@concertinahr.com>";
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[password-reset] Reset link for ${to}: ${resetUrl}`);
      return { sent: true, mode: "development-log" as const };
    }

    console.warn("Password reset email was requested, but RESEND_API_KEY is not configured.");
    return { sent: false, mode: "not-configured" as const };
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
        subject: "Reset your Concertina HR password",
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#13233f">
            <h2 style="margin:0 0 12px">Reset your password</h2>
            <p>We received a request to reset your Concertina HR password.</p>
            <p>
              <a href="${resetUrl}" style="display:inline-block;background:#d2202b;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:600">
                Reset password
              </a>
            </p>
            <p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
          </div>
        `,
        text: `Reset your Concertina HR password: ${resetUrl}\n\nThis link expires in 1 hour. If you did not request this, ignore this email.`,
      }),
    });
  } catch (error) {
    console.error("Failed to send password reset email:", error);
    return { sent: false, mode: "network-error" as const };
  }

  if (!response.ok) {
    const details = await response.text();
    console.error("Failed to send password reset email:", details);
    return { sent: false, mode: "resend" as const };
  }

  return { sent: true, mode: "resend" as const };
}

type LeaveNotificationEmailInput = {
  to: string[];
  subject: string;
  heading: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
};

export async function sendLeaveNotificationEmail({
  to,
  subject,
  heading,
  message,
  actionUrl,
  actionLabel = "Open Concertina HR",
}: LeaveNotificationEmailInput) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATION_EMAIL_FROM || process.env.PASSWORD_RESET_EMAIL_FROM;

  if (!resendApiKey || !from || to.length === 0) {
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
        subject,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#13233f">
            <h2 style="margin:0 0 12px">${heading}</h2>
            <p>${message}</p>
            ${
              actionUrl
                ? `<p><a href="${actionUrl}" style="display:inline-block;background:#253368;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:600">${actionLabel}</a></p>`
                : ""
            }
            <p style="color:#5c6678;font-size:13px">This is an automated Concertina HR notification.</p>
          </div>
        `,
        text: `${heading}\n\n${message}${actionUrl ? `\n\n${actionLabel}: ${actionUrl}` : ""}\n\nThis is an automated Concertina HR notification.`,
      }),
    });
  } catch (error) {
    console.error("Failed to send leave notification email:", error);
    return { sent: false, reason: "network-error" as const };
  }

  if (!response.ok) {
    console.error("Failed to send leave notification email:", await response.text());
    return { sent: false, reason: "resend-error" as const };
  }

  return { sent: true, reason: "sent" as const };
}

"use server";

import bcrypt from "bcryptjs";
import { randomBytes, randomUUID } from "crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import prisma from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/password-reset-email";
import { hashPasswordResetToken } from "@/lib/password-reset-token";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

async function getBaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");

  const headerList = await headers();
  const host = headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") || "http";

  return host ? `${protocol}://${host}` : "http://localhost:3000";
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();

  if (!email) {
    redirect("/forgot-password?sent=1");
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, isActive: true },
    });

    if (user?.isActive) {
      const token = randomBytes(32).toString("hex");
      const tokenHash = hashPasswordResetToken(token);
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

      await prisma.$transaction([
        prisma.$executeRaw`DELETE FROM "PasswordResetToken" WHERE "userId" = ${user.id}`,
        prisma.$executeRaw`
          INSERT INTO "PasswordResetToken" ("id", "userId", "tokenHash", "expiresAt", "createdAt")
          VALUES (${randomUUID()}, ${user.id}, ${tokenHash}, ${expiresAt}, ${new Date()})
        `,
      ]);

      const resetUrl = `${await getBaseUrl()}/reset-password?token=${token}`;
      await sendPasswordResetEmail({ to: user.email, resetUrl });
    }
  } catch (error) {
    console.error("Failed to request password reset:", error);
  }

  redirect("/forgot-password?sent=1");
}

export async function resetPassword(formData: FormData) {
  const token = String(formData.get("token") || "");
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (!token || !password || !confirmPassword) {
    redirect(`/reset-password?token=${encodeURIComponent(token)}&error=missing`);
  }

  if (password !== confirmPassword) {
    redirect(`/reset-password?token=${encodeURIComponent(token)}&error=mismatch`);
  }

  if (password.length < 8) {
    redirect(`/reset-password?token=${encodeURIComponent(token)}&error=short`);
  }

  const tokenHash = hashPasswordResetToken(token);
  let redirectTo = "/login?reset=success";

  try {
    const tokens = await prisma.$queryRaw<{ userId: string; expiresAt: Date }[]>`
      DELETE FROM "PasswordResetToken"
      WHERE "tokenHash" = ${tokenHash}
      RETURNING "userId", "expiresAt"
    `;
    const resetToken = tokens[0];

    if (!resetToken || resetToken.expiresAt < new Date()) {
      redirectTo = "/reset-password?error=invalid";
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);

      await prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword, isActive: true, activatedAt: new Date() },
      });
    }
  } catch (error) {
    console.error("Failed to reset password:", error);
    redirect(`/reset-password?token=${encodeURIComponent(token)}&error=system`);
  }

  redirect(redirectTo);
}

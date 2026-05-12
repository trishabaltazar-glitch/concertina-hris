import { NextResponse } from "next/server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { requestId } = await params;
  const rows = await prisma.$queryRaw<{
    userId: string;
    attachmentName: string | null;
    attachmentType: string | null;
    attachmentData: Uint8Array | null;
  }[]>`
    SELECT "userId", "attachmentName", "attachmentType", "attachmentData"
    FROM "LeaveRequest"
    WHERE "id" = ${requestId}
    LIMIT 1
  `;

  const attachment = rows[0];
  if (!attachment?.attachmentData || !attachment.attachmentName || !attachment.attachmentType) {
    return new NextResponse("Attachment not found", { status: 404 });
  }

  const role = (session.user as { role?: string }).role;
  const canView = attachment.userId === session.user.id || role === "ADMIN" || role === "MANAGER";
  if (!canView) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const body = Buffer.from(attachment.attachmentData);

  return new NextResponse(body, {
    headers: {
      "Content-Type": attachment.attachmentType,
      "Content-Disposition": `attachment; filename="${attachment.attachmentName.replace(/"/g, "")}"`,
    },
  });
}

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { ensureOvertimeRequestTable } from "@/lib/overtime-requests";

export async function GET(_request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  await ensureOvertimeRequestTable();
  const { requestId } = await params;
  const rows = await prisma.$queryRaw<{
    userId: string;
    userRole: string;
    managerId: string | null;
    attachmentName: string;
    attachmentType: string;
    attachmentData: Uint8Array;
  }[]>`
    SELECT ot."userId", u."role" as "userRole", u."managerId", ot."attachmentName", ot."attachmentType", ot."attachmentData"
    FROM "OvertimeRequest" ot
    INNER JOIN "User" u ON u."id" = ot."userId"
    WHERE ot."id" = ${requestId}
    LIMIT 1
  `;
  const attachment = rows[0];
  if (!attachment) return new NextResponse("Attachment not found", { status: 404 });

  const role = (session.user as { role?: string }).role;
  const canView =
    attachment.userId === session.user.id ||
    role === "ADMIN" ||
    (role === "MANAGER" && attachment.userRole === "EMPLOYEE" && attachment.managerId === session.user.id);

  if (!canView) return new NextResponse("Forbidden", { status: 403 });

  return new NextResponse(Buffer.from(attachment.attachmentData), {
    headers: {
      "Content-Type": attachment.attachmentType,
      "Content-Disposition": `attachment; filename="${attachment.attachmentName.replace(/"/g, "")}"`,
    },
  });
}

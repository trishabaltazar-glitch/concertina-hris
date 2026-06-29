import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { OvertimeApprovalsClient, type OvertimeApprovalRow } from "@/app/admin/overtime/overtime-approvals-client";
import prisma from "@/lib/prisma";
import { ensureOvertimeRequestTable } from "@/lib/overtime-requests";

export const dynamic = "force-dynamic";

type OvertimeRequestRow = {
  id: string;
  startAt: Date;
  endAt: Date;
  reason: string;
  attachmentName: string;
  status: string;
  createdAt: Date;
  reviewedAt: Date | null;
  userName: string;
  userEmail: string;
};

export default async function AdminOvertimePage() {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || (user.role !== "ADMIN" && user.role !== "MANAGER")) redirect("/");

  await ensureOvertimeRequestTable();

  const requests = user.role === "ADMIN"
    ? await prisma.$queryRaw<OvertimeRequestRow[]>`
        SELECT ot."id", ot."startAt", ot."endAt", ot."reason", ot."attachmentName", ot."status", ot."createdAt", ot."reviewedAt", u."name" as "userName", u."email" as "userEmail"
        FROM "OvertimeRequest" ot
        INNER JOIN "User" u ON u."id" = ot."userId"
        ORDER BY CASE WHEN ot."status" = 'PENDING' THEN 0 ELSE 1 END, ot."createdAt" DESC
        LIMIT 100
      `
    : await prisma.$queryRaw<OvertimeRequestRow[]>`
        SELECT ot."id", ot."startAt", ot."endAt", ot."reason", ot."attachmentName", ot."status", ot."createdAt", ot."reviewedAt", u."name" as "userName", u."email" as "userEmail"
        FROM "OvertimeRequest" ot
        INNER JOIN "User" u ON u."id" = ot."userId"
        WHERE u."managerId" = ${user.id}
          AND u."role" = 'EMPLOYEE'
        ORDER BY CASE WHEN ot."status" = 'PENDING' THEN 0 ELSE 1 END, ot."createdAt" DESC
        LIMIT 100
      `;
  const clientRows: OvertimeApprovalRow[] = requests.map((request) => ({
    id: request.id,
    startAt: request.startAt.toISOString(),
    endAt: request.endAt.toISOString(),
    reason: request.reason,
    attachmentName: request.attachmentName,
    status: request.status,
    createdAt: request.createdAt.toISOString(),
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
    userName: request.userName,
    userEmail: request.userEmail,
  }));

  return <OvertimeApprovalsClient initialRequests={clientRows} />;
}

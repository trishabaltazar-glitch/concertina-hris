import prisma from "@/lib/prisma";

export async function ensureOvertimeRequestTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "OvertimeRequest" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "startAt" TIMESTAMP(3) NOT NULL,
      "endAt" TIMESTAMP(3) NOT NULL,
      "reason" TEXT NOT NULL,
      "attachmentName" TEXT NOT NULL,
      "attachmentType" TEXT NOT NULL,
      "attachmentData" BYTEA NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "reviewedById" TEXT,
      "reviewedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "OvertimeRequest_pkey" PRIMARY KEY ("id")
    )
  `);

  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "OvertimeRequest_userId_status_idx" ON "OvertimeRequest"("userId", "status")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "OvertimeRequest_status_createdAt_idx" ON "OvertimeRequest"("status", "createdAt")`);
}

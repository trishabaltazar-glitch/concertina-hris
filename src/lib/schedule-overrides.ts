import prisma from "@/lib/prisma";

export async function ensureScheduleOverrideTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ScheduleOverride" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "assignedById" TEXT NOT NULL,
      "date" TIMESTAMP(3) NOT NULL,
      "startTime" TEXT NOT NULL,
      "endTime" TEXT NOT NULL,
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ScheduleOverride_pkey" PRIMARY KEY ("id")
    )
  `);

  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "ScheduleOverride_userId_date_key" ON "ScheduleOverride"("userId", "date")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ScheduleOverride_userId_date_idx" ON "ScheduleOverride"("userId", "date")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ScheduleOverride_assignedById_date_idx" ON "ScheduleOverride"("assignedById", "date")`);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ScheduleOverride_userId_fkey'
      ) THEN
        ALTER TABLE "ScheduleOverride"
        ADD CONSTRAINT "ScheduleOverride_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      END IF;
    END $$
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ScheduleOverride_assignedById_fkey'
      ) THEN
        ALTER TABLE "ScheduleOverride"
        ADD CONSTRAINT "ScheduleOverride_assignedById_fkey"
        FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      END IF;
    END $$
  `);
}

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
);

CREATE UNIQUE INDEX IF NOT EXISTS "ScheduleOverride_userId_date_key" ON "ScheduleOverride"("userId", "date");
CREATE INDEX IF NOT EXISTS "ScheduleOverride_userId_date_idx" ON "ScheduleOverride"("userId", "date");
CREATE INDEX IF NOT EXISTS "ScheduleOverride_assignedById_date_idx" ON "ScheduleOverride"("assignedById", "date");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ScheduleOverride_userId_fkey'
  ) THEN
    ALTER TABLE "ScheduleOverride"
    ADD CONSTRAINT "ScheduleOverride_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ScheduleOverride_assignedById_fkey'
  ) THEN
    ALTER TABLE "ScheduleOverride"
    ADD CONSTRAINT "ScheduleOverride_assignedById_fkey"
    FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

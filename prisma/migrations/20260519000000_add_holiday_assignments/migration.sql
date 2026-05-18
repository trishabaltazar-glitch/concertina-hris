CREATE TABLE IF NOT EXISTS "HolidayAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HolidayAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HolidayAssignment_userId_date_name_key" ON "HolidayAssignment"("userId", "date", "name");
CREATE INDEX IF NOT EXISTS "HolidayAssignment_userId_date_idx" ON "HolidayAssignment"("userId", "date");
CREATE INDEX IF NOT EXISTS "HolidayAssignment_assignedById_date_idx" ON "HolidayAssignment"("assignedById", "date");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'HolidayAssignment_userId_fkey'
  ) THEN
    ALTER TABLE "HolidayAssignment"
    ADD CONSTRAINT "HolidayAssignment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'HolidayAssignment_assignedById_fkey'
  ) THEN
    ALTER TABLE "HolidayAssignment"
    ADD CONSTRAINT "HolidayAssignment_assignedById_fkey"
    FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

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
);

CREATE INDEX IF NOT EXISTS "OvertimeRequest_userId_status_idx" ON "OvertimeRequest"("userId", "status");
CREATE INDEX IF NOT EXISTS "OvertimeRequest_status_createdAt_idx" ON "OvertimeRequest"("status", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OvertimeRequest_userId_fkey'
  ) THEN
    ALTER TABLE "OvertimeRequest"
    ADD CONSTRAINT "OvertimeRequest_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OvertimeRequest_reviewedById_fkey'
  ) THEN
    ALTER TABLE "OvertimeRequest"
    ADD CONSTRAINT "OvertimeRequest_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AlterTable
ALTER TABLE "TimeLog" ADD COLUMN "projectName" TEXT;
ALTER TABLE "TimeLog" ADD COLUMN "notes" TEXT;

-- CreateTable
CREATE TABLE "TimeBreak" (
    "id" TEXT NOT NULL,
    "timeLogId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeBreak_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TimeBreak" ADD CONSTRAINT "TimeBreak_timeLogId_fkey" FOREIGN KEY ("timeLogId") REFERENCES "TimeLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

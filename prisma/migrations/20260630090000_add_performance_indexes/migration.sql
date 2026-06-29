-- Performance indexes for authenticated workspace and admin pages.
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

CREATE INDEX "TimeLog_userId_clockIn_idx" ON "TimeLog"("userId", "clockIn");
CREATE INDEX "TimeLog_userId_clockOut_clockIn_idx" ON "TimeLog"("userId", "clockOut", "clockIn");
CREATE INDEX "TimeLog_clockIn_idx" ON "TimeLog"("clockIn");
CREATE INDEX "TimeLog_status_clockIn_idx" ON "TimeLog"("status", "clockIn");

CREATE INDEX "LeaveRequest_userId_status_idx" ON "LeaveRequest"("userId", "status");
CREATE INDEX "LeaveRequest_status_createdAt_idx" ON "LeaveRequest"("status", "createdAt");

CREATE INDEX "Announcement_createdAt_idx" ON "Announcement"("createdAt");

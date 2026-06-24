import prisma from "@/lib/prisma";

function getStartOfToday(referenceDate = new Date()) {
  return new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    0,
    0,
    0,
    0
  );
}

function getEndOfClockInDay(clockIn: Date) {
  const endOfDay = new Date(clockIn);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay;
}

export async function closeStaleOpenTimeLogs(userScope?: string | string[]) {
  if (Array.isArray(userScope) && userScope.length === 0) {
    return 0;
  }

  const staleLogs = await prisma.timeLog.findMany({
    where: {
      ...(Array.isArray(userScope)
        ? { userId: { in: userScope } }
        : userScope
          ? { userId: userScope }
          : {}),
      clockOut: null,
      clockIn: {
        lt: getStartOfToday(),
      },
    },
    select: {
      id: true,
      userId: true,
      clockIn: true,
    },
  });

  if (staleLogs.length === 0) {
    return 0;
  }

  await prisma.$transaction(
    staleLogs.flatMap((log) => [
      prisma.timeLog.update({
        where: { id: log.id },
        data: {
          clockOut: getEndOfClockInDay(log.clockIn),
          status: "FORCED_CHECKOUT",
        },
      }),
      prisma.auditLog.create({
        data: {
          action: "FORCED_CLOCK_OUT",
          userId: log.userId,
          details: `System automatically closed stale time log from ${log.clockIn.toISOString()}.`,
        },
      }),
    ])
  );

  return staleLogs.length;
}

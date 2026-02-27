import { AlertLevel, CheckStatus, NotificationChannel, NotificationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function parseChannels(raw: string) {
  return raw
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter((value) =>
      value === NotificationChannel.IN_APP ||
      value === NotificationChannel.EMAIL ||
      value === NotificationChannel.SMS,
    ) as NotificationChannel[];
}

async function getActivePolicy() {
  const policy = await prisma.escalationPolicy.findFirst({
    where: {
      isActive: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
  if (policy) {
    return policy;
  }
  return prisma.escalationPolicy.create({
    data: {},
  });
}

function levelForOverdueDays(days: number, thresholds: [number, number, number]) {
  if (days >= thresholds[2]) {
    return 3;
  }
  if (days >= thresholds[1]) {
    return 2;
  }
  if (days >= thresholds[0]) {
    return 1;
  }
  return 0;
}

export async function runEscalationSweep(triggeredByUserId?: string) {
  const policy = await getActivePolicy();
  const now = new Date();
  const checksheets = await prisma.checkSheet.findMany({
    where: {
      status: {
        in: [CheckStatus.OVERDUE, CheckStatus.ISSUE_REQUIRED, CheckStatus.NEAR_DUE],
      },
      dueDate: {
        lt: now,
      },
    },
    include: {
      equipment: true,
    },
    orderBy: {
      dueDate: "asc",
    },
  });

  const recipients = await prisma.user.findMany({
    where: {
      isActive: true,
      role: {
        in: ["ADMIN", "SUPERADMIN"],
      },
    },
    select: {
      id: true,
      email: true,
    },
  });

  let notificationsCreated = 0;
  let alertsCreated = 0;
  let checksEscalated = 0;

  for (const sheet of checksheets) {
    const overdueDays = Math.max(
      1,
      Math.floor((now.getTime() - sheet.dueDate.getTime()) / (1000 * 60 * 60 * 24)),
    );
    const level = levelForOverdueDays(overdueDays, [
      policy.level1Days,
      policy.level2Days,
      policy.level3Days,
    ]);
    if (level === 0) {
      continue;
    }

    const selectedChannels =
      level === 1
        ? parseChannels(policy.level1Channels)
        : level === 2
          ? parseChannels(policy.level2Channels)
          : parseChannels(policy.level3Channels);
    if (selectedChannels.length === 0) {
      continue;
    }

    checksEscalated += 1;
    const alertMessage = `${sheet.checkCode} check overdue by ${overdueDays} day(s)`;
    const existingAlert = await prisma.alert.findFirst({
      where: {
        equipmentId: sheet.equipmentId,
        checkSheetId: sheet.id,
        message: `${alertMessage} [L${level}]`,
        acknowledged: false,
      },
      select: {
        id: true,
      },
    });

    let alertId: string | undefined = existingAlert?.id;
    if (!existingAlert) {
      const created = await prisma.alert.create({
        data: {
          equipmentId: sheet.equipmentId,
          checkSheetId: sheet.id,
          level: AlertLevel.OVERDUE,
          message: `${alertMessage} [L${level}]`,
        },
        select: {
          id: true,
        },
      });
      alertId = created.id;
      alertsCreated += 1;
    }

    for (const channel of selectedChannels) {
      if (channel === NotificationChannel.IN_APP) {
        for (const recipient of recipients) {
          const dedupeKey = `escalation-${sheet.id}-${level}-${channel}-${recipient.id}`;
          const existing = await prisma.notification.findUnique({
            where: {
              dedupeKey,
            },
            select: {
              id: true,
            },
          });
          if (existing) {
            continue;
          }
          await prisma.notification.create({
            data: {
              userId: recipient.id,
              alertId,
              equipmentId: sheet.equipmentId,
              channel,
              status: NotificationStatus.SENT,
              title: `Overdue Check Escalation L${level}`,
              message: `${sheet.equipment.equipmentNumber} ${sheet.checkCode} check is overdue by ${overdueDays} day(s)`,
              dedupeKey,
              sentAt: now,
              metadata: {
                level,
                overdueDays,
                checkSheetId: sheet.id,
                triggeredByUserId: triggeredByUserId ?? null,
              },
            },
          });
          notificationsCreated += 1;
        }
      } else {
        for (const recipient of recipients) {
          const dedupeKey = `escalation-${sheet.id}-${level}-${channel}-${recipient.id}`;
          const existing = await prisma.notification.findUnique({
            where: {
              dedupeKey,
            },
            select: {
              id: true,
            },
          });
          if (existing) {
            continue;
          }
          await prisma.notification.create({
            data: {
              userId: recipient.id,
              alertId,
              equipmentId: sheet.equipmentId,
              channel,
              status: NotificationStatus.PENDING,
              title: `Overdue Check Escalation L${level}`,
              message: `${sheet.equipment.equipmentNumber} ${sheet.checkCode} check is overdue by ${overdueDays} day(s)`,
              targetAddress: channel === NotificationChannel.EMAIL ? recipient.email : null,
              dedupeKey,
              metadata: {
                level,
                overdueDays,
                checkSheetId: sheet.id,
                triggeredByUserId: triggeredByUserId ?? null,
              },
            },
          });
          notificationsCreated += 1;
        }
      }
    }
  }

  return {
    checksEscalated,
    alertsCreated,
    notificationsCreated,
  };
}

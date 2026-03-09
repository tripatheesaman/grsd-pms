import { requireAccess } from "@/lib/api/guard";
import { fail, ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";
import { CheckStatus } from "@prisma/client";
import { getEmailReminderDaysBefore, sendCheckEmail } from "@/lib/email";

export async function POST() {
  const access = await requireAccess({
    minRole: "ADMIN",
    requiredPermission: permissionKeys.dashboardRead,
  });
  if ("error" in access) {
    return access.error;
  }

  const daysBefore = await getEmailReminderDaysBefore();
  if (daysBefore <= 0) {
    return ok({ remindersSent: 0 });
  }

  const today = new Date();
  const fromDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
  const toDateBase = new Date(fromDate);
  toDateBase.setDate(toDateBase.getDate() + daysBefore);
  const toDate = new Date(
    toDateBase.getFullYear(),
    toDateBase.getMonth(),
    toDateBase.getDate(),
    23,
    59,
    59,
    999,
  );

  const candidates = await prisma.checkSheet.findMany({
    where: {
      status: {
        in: [CheckStatus.PREDICTED, CheckStatus.ISSUE_REQUIRED, CheckStatus.NEAR_DUE],
      },
      dueDate: {
        gte: fromDate,
        lte: toDate,
      },
    },
    include: {
      equipment: true,
    },
  });

  let sent = 0;
  for (const sheet of candidates) {
    try {
      await sendCheckEmail({ type: "reminder", check: sheet });
      sent += 1;
    } catch (error) {}
  }

  return ok({ remindersSent: sent });
}


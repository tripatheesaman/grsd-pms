import { EntryStatus } from "@prisma/client";
import { z } from "zod";
import { parseBody, requireAccess } from "@/lib/api/guard";
import { fail, ok } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/log";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";

const rejectDaySchema = z.object({
  entryDate: z.string().date(),
});

export async function POST(request: Request) {
  const access = await requireAccess({
    minRole: "ADMIN",
    requiredPermission: permissionKeys.entryApprove,
  });
  if ("error" in access) {
    return access.error;
  }

  const parsed = await parseBody(request, rejectDaySchema);
  if ("error" in parsed) {
    return parsed.error;
  }

  const day = new Date(parsed.data.entryDate);
  day.setHours(0, 0, 0, 0);
  const nextDay = new Date(day);
  nextDay.setDate(day.getDate() + 1);

  const pending = await prisma.dailyEntry.findMany({
    where: {
      status: EntryStatus.PENDING,
      entryDate: {
        gte: day,
        lt: nextDay,
      },
    },
    select: {
      id: true,
    },
  });

  if (pending.length === 0) {
    return fail("NOT_FOUND", "No pending entries found for this date", 404);
  }

  const rejectedAt = new Date();
  const ids = pending.map((e) => e.id);

  await prisma.dailyEntry.updateMany({
    where: { id: { in: ids } },
    data: {
      status: EntryStatus.REJECTED,
      rejectedById: access.user.id,
      rejectedAt,
    },
  });

  writeAuditLog({
    userId: access.user.id,
    action: "equipment.entry.reject.batch",
    entityType: "DailyEntry",
    entityId: null,
    payload: {
      batchDate: day.toISOString(),
      rejectedCount: ids.length,
    },
    request,
  }).catch(() => null);

  return ok({
    rejectedCount: ids.length,
    date: day.toISOString(),
  });
}


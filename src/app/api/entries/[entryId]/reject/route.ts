import { z } from "zod";
import { EntryStatus } from "@prisma/client";
import { parseBody, requireAccess } from "@/lib/api/guard";
import { fail, ok } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/log";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";

const rejectSchema = z.object({
  reason: z.string().optional(),
});

type RouteContext = {
  params: Promise<{ entryId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireAccess({
    minRole: "ADMIN",
    requiredPermission: permissionKeys.entryApprove,
  });
  if ("error" in access) {
    return access.error;
  }

  const parsed = await parseBody(request, rejectSchema);
  if ("error" in parsed) {
    return parsed.error;
  }

  const { entryId } = await context.params;

  const entry = await prisma.dailyEntry.findUnique({
    where: { id: entryId },
  });

  if (!entry) {
    return fail("NOT_FOUND", "Entry not found", 404);
  }

  if (entry.status !== EntryStatus.PENDING) {
    return fail("BAD_REQUEST", "Entry is not pending approval", 400);
  }

  await prisma.dailyEntry.update({
    where: { id: entryId },
    data: {
      status: EntryStatus.REJECTED,
      rejectedById: access.user.id,
      rejectedAt: new Date(),
    },
  });

  await writeAuditLog({
    userId: access.user.id,
    action: "equipment.entry.reject",
    entityType: "DailyEntry",
    entityId: entryId,
    payload: {
      entryDate: entry.entryDate.toISOString(),
      hoursRun: Number(entry.hoursRun),
      reason: parsed.data.reason,
    },
    request,
  });

  return ok({
    id: entryId,
    status: EntryStatus.REJECTED,
  });
}

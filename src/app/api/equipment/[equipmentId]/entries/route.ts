import { z } from "zod";
import { EntryStatus } from "@prisma/client";
import { parseBody, requireAccess } from "@/lib/api/guard";
import { fail, ok } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/log";
import { deriveForecastAverageHoursPerDay } from "@/lib/planning/engine";
import { syncEquipmentPlan } from "@/lib/planning/sync";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";

const entrySchema = z.object({
  entryDate: z.string().datetime(),
  hoursRun: z.number().positive(),
});

type RouteContext = {
  params: Promise<{ equipmentId: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  const access = await requireAccess({
    minRole: "USER",
    requiredPermission: permissionKeys.entryRead,
  });
  if ("error" in access) {
    return access.error;
  }

  const { equipmentId } = await context.params;
  const entries = await prisma.dailyEntry.findMany({
    where: {
      equipmentId,
    },
    orderBy: {
      entryDate: "desc",
    },
    take: 30,
  });

  return ok(
    entries.map((entry) => ({
      id: entry.id,
      entryDate: entry.entryDate.toISOString(),
      hoursRun: Number(entry.hoursRun),
    })),
  );
}

export async function POST(request: Request, context: RouteContext) {
  const access = await requireAccess({
    minRole: "USER",
    requiredPermission: permissionKeys.entryCreate,
  });
  if ("error" in access) {
    return access.error;
  }

  const parsed = await parseBody(request, entrySchema);
  if ("error" in parsed) {
    return parsed.error;
  }

  const { equipmentId } = await context.params;
  const equipment = await prisma.equipment.findUnique({
    where: {
      id: equipmentId,
    },
  });
  if (!equipment) {
    return fail("NOT_FOUND", "Equipment not found", 404);
  }

  const entryDate = new Date(parsed.data.entryDate);
  const day = new Date(entryDate);
  day.setHours(0, 0, 0, 0);

  const existing = await prisma.dailyEntry.findFirst({
    where: {
      equipmentId,
      entryDate: day,
      status: EntryStatus.PENDING,
    },
  });
  if (existing) {
    return fail("CONFLICT", "Pending entry already exists for this day", 409);
  }

  const entry = await prisma.dailyEntry.create({
    data: {
      equipmentId,
      entryDate: day,
      hoursRun: parsed.data.hoursRun,
      status: EntryStatus.PENDING,
      createdById: access.user.id,
    },
  });

  await writeAuditLog({
    userId: access.user.id,
    action: "equipment.entry.create",
    entityType: "DailyEntry",
    entityId: entry.id,
    payload: {
      entryDate: day.toISOString(),
      hoursRun: parsed.data.hoursRun,
      status: EntryStatus.PENDING,
    },
    request,
  });

  return ok({
    id: entry.id,
    equipmentId,
    entryDate: entry.entryDate.toISOString(),
    hoursRun: Number(entry.hoursRun),
    status: entry.status,
  });
}

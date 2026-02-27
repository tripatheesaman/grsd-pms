import { z } from "zod";
import { requireAccess, parseBody } from "@/lib/api/guard";
import { fail, ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";

const createGroundingSchema = z.object({
  fromDate: z.string().datetime(),
  reason: z.string().min(1).max(255),
});

type RouteContext = {
  params: Promise<{ equipmentId: string }>;
};

function toProperCase(value: string) {
  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function GET(_: Request, context: RouteContext) {
  const access = await requireAccess({
    minRole: "ADMIN",
    requiredPermission: permissionKeys.equipmentManage,
  });
  if ("error" in access) {
    return access.error;
  }

  const { equipmentId } = await context.params;

  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
    select: { id: true },
  });

  if (!equipment) {
    return fail("NOT_FOUND", "Equipment not found", 404);
  }

  const periods = await (prisma as any).groundingPeriod.findMany({
    where: { equipmentId },
    orderBy: { fromDate: "desc" },
  });

  const mapped = periods.map((p: any) => ({
    id: p.id,
    fromDate: p.fromDate.toISOString(),
    toDate: p.toDate ? p.toDate.toISOString() : null,
    reason: p.reason,
  }));

  return ok(mapped);
}

export async function POST(request: Request, context: RouteContext) {
  const access = await requireAccess({
    minRole: "ADMIN",
    requiredPermission: permissionKeys.equipmentManage,
  });
  if ("error" in access) {
    return access.error;
  }

  const parsed = await parseBody(request, createGroundingSchema);
  if ("error" in parsed) {
    return parsed.error;
  }

  const { equipmentId } = await context.params;

  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
    select: { id: true },
  });

  if (!equipment) {
    return fail("NOT_FOUND", "Equipment not found", 404);
  }

  const fromDate = new Date(parsed.data.fromDate);

  const overlapping = await (prisma as any).groundingPeriod.findFirst({
    where: {
      equipmentId,
      fromDate: { lte: fromDate },
      OR: [{ toDate: null }, { toDate: { gte: fromDate } }],
    },
  });

  if (overlapping) {
    return fail("BAD_REQUEST", "Equipment is already grounded during this period", 400);
  }

  const period = await (prisma as any).groundingPeriod.create({
    data: {
      equipmentId,
      fromDate,
      reason: toProperCase(parsed.data.reason),
    },
  });

  return ok({
    id: period.id,
    fromDate: period.fromDate.toISOString(),
    toDate: period.toDate ? period.toDate.toISOString() : null,
    reason: period.reason,
  });
}


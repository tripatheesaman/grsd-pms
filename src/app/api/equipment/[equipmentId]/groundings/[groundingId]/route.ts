import { z } from "zod";
import { requireAccess, parseBody } from "@/lib/api/guard";
import { fail, ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";

const endGroundingSchema = z.object({
  toDate: z.string().datetime(),
});

type RouteContext = {
  params: Promise<{ equipmentId: string; groundingId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireAccess({
    minRole: "ADMIN",
    requiredPermission: permissionKeys.equipmentManage,
  });
  if ("error" in access) {
    return access.error;
  }

  const parsed = await parseBody(request, endGroundingSchema);
  if ("error" in parsed) {
    return parsed.error;
  }

  const { equipmentId, groundingId } = await context.params;

  const period = await (prisma as any).groundingPeriod.findFirst({
    where: { id: groundingId, equipmentId },
  });

  if (!period) {
    return fail("NOT_FOUND", "Grounding period not found", 404);
  }

  const toDate = new Date(parsed.data.toDate);
  if (toDate < period.fromDate) {
    return fail("BAD_REQUEST", "End date cannot be before start date", 400);
  }

  const updated = await (prisma as any).groundingPeriod.update({
    where: { id: groundingId },
    data: { toDate },
  });

  return ok({
    id: updated.id,
    fromDate: updated.fromDate.toISOString(),
    toDate: updated.toDate ? updated.toDate.toISOString() : null,
    reason: updated.reason,
  });
}


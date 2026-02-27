import { Role } from "@prisma/client";
import { z } from "zod";
import { parseBody, requireAccess } from "@/lib/api/guard";
import { fail, ok } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/log";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";

const updateUserSchema = z.object({
  fullName: z.string().min(2).max(80).optional(),
  role: z.nativeEnum(Role).optional(),
  isActive: z.boolean().optional(),
});

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireAccess({
    minRole: "SUPERADMIN",
    requiredPermission: permissionKeys.usersManage,
  });
  if ("error" in access) {
    return access.error;
  }

  const parsed = await parseBody(request, updateUserSchema);
  if ("error" in parsed) {
    return parsed.error;
  }

  const { userId } = await context.params;
  const existing = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
    },
  });
  if (!existing) {
    return fail("NOT_FOUND", "User not found", 404);
  }

  const user = await prisma.user.update({
    where: {
      id: userId,
    },
    data: parsed.data,
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
    },
  });

  await writeAuditLog({
    userId: access.user.id,
    action: "user.update",
    entityType: "User",
    entityId: user.id,
    payload: parsed.data,
    request,
  });

  return ok(user);
}

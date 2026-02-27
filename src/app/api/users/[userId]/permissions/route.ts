import { z } from "zod";
import { parseBody, requireAccess } from "@/lib/api/guard";
import { fail, ok } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/log";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";

const permissionsSchema = z.object({
  permissions: z
    .array(
      z.object({
        key: z.string().min(2).max(80),
        name: z.string().min(2).max(120),
        description: z.string().max(240).optional(),
        allowed: z.boolean(),
      }),
    )
    .max(200),
});

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireAccess({
    minRole: "SUPERADMIN",
    requiredPermission: permissionKeys.permissionsManage,
  });
  if ("error" in access) {
    return access.error;
  }

  const parsed = await parseBody(request, permissionsSchema);
  if ("error" in parsed) {
    return parsed.error;
  }

  const { userId } = await context.params;
  const targetUser = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
    },
  });
  if (!targetUser) {
    return fail("NOT_FOUND", "User not found", 404);
  }

  for (const permission of parsed.data.permissions) {
    const permissionRecord = await prisma.permission.upsert({
      where: {
        key: permission.key,
      },
      create: {
        key: permission.key,
        name: permission.name,
        description: permission.description,
      },
      update: {
        name: permission.name,
        description: permission.description,
      },
    });

    await prisma.userPermission.upsert({
      where: {
        userId_permissionId: {
          userId,
          permissionId: permissionRecord.id,
        },
      },
      create: {
        userId,
        permissionId: permissionRecord.id,
        allowed: permission.allowed,
      },
      update: {
        allowed: permission.allowed,
      },
    });
  }

  await writeAuditLog({
    userId: access.user.id,
    action: "user.permissions.update",
    entityType: "User",
    entityId: userId,
    payload: {
      updates: parsed.data.permissions.length,
    },
    request,
  });

  return ok({ success: true });
}

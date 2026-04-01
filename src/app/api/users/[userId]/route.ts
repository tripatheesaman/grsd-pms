import { Role } from "@prisma/client";
import { z } from "zod";
import { parseBody, requireAccess } from "@/lib/api/guard";
import { fail, ok } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/log";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/security/auth";
import { permissionKeys } from "@/lib/security/permissions";

const updateUserSchema = z.object({
  fullName: z.string().min(2).max(80).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).max(120).optional(),
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
      role: true,
      email: true,
    },
  });
  if (!existing) {
    return fail("NOT_FOUND", "User not found", 404);
  }
  if (existing.id === access.user.id && parsed.data.isActive === false) {
    return fail("BAD_REQUEST", "You cannot deactivate your own account", 400);
  }

  if (parsed.data.email) {
    const emailLower = parsed.data.email.toLowerCase();
    const emailOwner = await prisma.user.findUnique({
      where: { email: emailLower },
      select: { id: true },
    });
    if (emailOwner && emailOwner.id !== userId) {
      return fail("CONFLICT", "Email already exists", 409);
    }
  }

  if (existing.role === Role.SUPERADMIN && ((parsed.data.role && parsed.data.role !== Role.SUPERADMIN) || parsed.data.isActive === false)) {
    const activeSuperadmins = await prisma.user.count({
      where: {
        role: Role.SUPERADMIN,
        isActive: true,
      },
    });
    if (activeSuperadmins <= 1) {
      return fail("BAD_REQUEST", "Cannot remove or deactivate the last active superadmin", 400);
    }
  }

  const data: {
    fullName?: string;
    email?: string;
    role?: Role;
    isActive?: boolean;
    passwordHash?: string;
  } = {};
  if (parsed.data.fullName !== undefined) data.fullName = parsed.data.fullName;
  if (parsed.data.email !== undefined) data.email = parsed.data.email.toLowerCase();
  if (parsed.data.role !== undefined) data.role = parsed.data.role;
  if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;
  if (parsed.data.password !== undefined) {
    data.passwordHash = await hashPassword(parsed.data.password);
  }

  const user = await prisma.user.update({
    where: {
      id: userId,
    },
    data,
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
    },
  });

  if (parsed.data.password !== undefined || parsed.data.isActive === false) {
    await prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

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

export async function DELETE(request: Request, context: RouteContext) {
  const access = await requireAccess({
    minRole: "SUPERADMIN",
    requiredPermission: permissionKeys.usersManage,
  });
  if ("error" in access) {
    return access.error;
  }

  const { userId } = await context.params;
  if (userId === access.user.id) {
    return fail("BAD_REQUEST", "You cannot delete your own account", 400);
  }

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, email: true },
  });
  if (!existing) {
    return fail("NOT_FOUND", "User not found", 404);
  }

  if (existing.role === Role.SUPERADMIN) {
    const activeSuperadmins = await prisma.user.count({
      where: {
        role: Role.SUPERADMIN,
        isActive: true,
      },
    });
    if (activeSuperadmins <= 1) {
      return fail("BAD_REQUEST", "Cannot delete the last active superadmin", 400);
    }
  }

  await prisma.user.delete({
    where: { id: userId },
  });

  await writeAuditLog({
    userId: access.user.id,
    action: "user.delete",
    entityType: "User",
    entityId: userId,
    payload: {
      email: existing.email,
    },
    request,
  });

  return ok({ id: userId });
}

import { Role } from "@prisma/client";
import { z } from "zod";
import { parseBody, requireAccess } from "@/lib/api/guard";
import { fail, ok } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/log";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/security/auth";
import { permissionKeys } from "@/lib/security/permissions";

const createUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2).max(80),
  password: z.string().min(8).max(120),
  role: z.nativeEnum(Role),
});

export async function GET() {
  const access = await requireAccess({
    minRole: "SUPERADMIN",
    requiredPermission: permissionKeys.usersRead,
  });
  if ("error" in access) {
    return access.error;
  }

  const users = await prisma.user.findMany({
    include: {
      permissions: {
        include: {
          permission: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return ok(
    users.map((user) => ({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      permissions: user.permissions.map((item) => ({
        key: item.permission.key,
        allowed: item.allowed,
      })),
    })),
  );
}

export async function POST(request: Request) {
  const access = await requireAccess({
    minRole: "SUPERADMIN",
    requiredPermission: permissionKeys.usersManage,
  });
  if ("error" in access) {
    return access.error;
  }

  const parsed = await parseBody(request, createUserSchema);
  if ("error" in parsed) {
    return parsed.error;
  }

  const existing = await prisma.user.findUnique({
    where: {
      email: parsed.data.email.toLowerCase(),
    },
  });
  if (existing) {
    return fail("CONFLICT", "Email already exists", 409);
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await prisma.user.create({
    data: {
      email: parsed.data.email.toLowerCase(),
      fullName: parsed.data.fullName,
      passwordHash,
      role: parsed.data.role,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
    },
  });

  await writeAuditLog({
    userId: access.user.id,
    action: "user.create",
    entityType: "User",
    entityId: user.id,
    payload: {
      email: user.email,
      role: user.role,
    },
    request,
  });

  return ok(user, 201);
}

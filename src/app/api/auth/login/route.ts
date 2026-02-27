import { z } from "zod";
import { parseBody } from "@/lib/api/guard";
import { fail, ok } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/log";
import { prisma } from "@/lib/prisma";
import { createSession, verifyPassword } from "@/lib/security/auth";
import { ensurePermissionCatalog } from "@/lib/security/permission-sync";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(120),
});

export async function POST(request: Request) {
  await ensurePermissionCatalog();

  const parsed = await parseBody(request, loginSchema);
  if ("error" in parsed) {
    return parsed.error;
  }

  const user = await prisma.user.findUnique({
    where: {
      email: parsed.data.email.toLowerCase(),
    },
  });

  if (!user || !user.isActive) {
    await writeAuditLog({
      action: "auth.login.failed",
      entityType: "User",
      payload: {
        email: parsed.data.email.toLowerCase(),
      },
      request,
    });
    return fail("UNAUTHORIZED", "Invalid credentials", 401);
  }

  const isValid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!isValid) {
    await writeAuditLog({
      userId: user.id,
      action: "auth.login.failed",
      entityType: "User",
      entityId: user.id,
      request,
    });
    return fail("UNAUTHORIZED", "Invalid credentials", 401);
  }

  await createSession(user.id);
  await writeAuditLog({
    userId: user.id,
    action: "auth.login.success",
    entityType: "User",
    entityId: user.id,
    request,
  });

  return ok(
    {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    },
    200,
  );
}

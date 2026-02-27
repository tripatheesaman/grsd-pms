import { Role } from "@prisma/client";
import { z } from "zod";
import { parseBody } from "@/lib/api/guard";
import { fail, ok } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/log";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/security/auth";
import { ensurePermissionCatalog } from "@/lib/security/permission-sync";

const bootstrapSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2).max(80),
  password: z.string().min(8).max(120),
});

export async function POST(request: Request) {
  await ensurePermissionCatalog();

  const existingUsers = await prisma.user.count();
  const configuredToken = process.env.BOOTSTRAP_TOKEN;
  const requestToken = request.headers.get("x-bootstrap-token");

  if (existingUsers > 0 && (!configuredToken || configuredToken !== requestToken)) {
    return fail("FORBIDDEN", "Bootstrap is locked", 403);
  }

  const parsed = await parseBody(request, bootstrapSchema);
  if ("error" in parsed) {
    return parsed.error;
  }

  const found = await prisma.user.findUnique({
    where: {
      email: parsed.data.email.toLowerCase(),
    },
  });
  if (found) {
    return fail("CONFLICT", "User already exists", 409);
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await prisma.user.create({
    data: {
      email: parsed.data.email.toLowerCase(),
      fullName: parsed.data.fullName,
      passwordHash,
      role: Role.SUPERADMIN,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
    },
  });

  await writeAuditLog({
    userId: user.id,
    action: "auth.bootstrap.superadmin",
    entityType: "User",
    entityId: user.id,
    payload: {
      email: user.email,
    },
    request,
  });

  return ok(user, 201);
}

import { Role } from "@prisma/client";
import { ZodSchema } from "zod";
import { fail } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/security/auth";
import { hasPermission, hasRequiredRole } from "@/lib/security/authorization";

type GuardOptions = {
  minRole?: Role;
  requiredPermission?: string;
};

export async function requireAccess(options?: GuardOptions) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: fail("UNAUTHORIZED", "Authentication required", 401) };
  }

  if (options?.minRole && !hasRequiredRole(user.role, options.minRole)) {
    return { error: fail("FORBIDDEN", "Insufficient role", 403) };
  }

  if (
    options?.requiredPermission &&
    user.role !== Role.SUPERADMIN &&
    !hasPermission(user.role, user.permissions, options.requiredPermission)
  ) {
    return { error: fail("FORBIDDEN", "Missing permission", 403) };
  }

  return { user };
}

export async function parseBody<T>(
  request: Request,
  schema: ZodSchema<T>,
): Promise<{ data: T } | { error: ReturnType<typeof fail> }> {
  const payload = await request.json().catch(() => null);
  const result = schema.safeParse(payload);
  if (!result.success) {
    return { error: fail("BAD_REQUEST", "Invalid request payload", 400) };
  }
  return { data: result.data };
}

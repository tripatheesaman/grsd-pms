import { fail, ok } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/security/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return fail("UNAUTHORIZED", "Authentication required", 401);
  }

  return ok({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    permissions: user.permissions.map((permission) => ({
      key: permission.permission.key,
      allowed: permission.allowed,
    })),
  });
}

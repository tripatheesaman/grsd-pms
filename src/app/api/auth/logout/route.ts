import { ok } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/log";
import { destroySession, getCurrentUser } from "@/lib/security/auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  await destroySession();
  await writeAuditLog({
    userId: user?.id ?? null,
    action: "auth.logout",
    entityType: "User",
    entityId: user?.id ?? null,
    request,
  });
  return ok({ success: true });
}

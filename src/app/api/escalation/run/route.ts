import { requireAccess } from "@/lib/api/guard";
import { ok } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/log";
import { runEscalationSweep } from "@/lib/notifications/escalation";
import { permissionKeys } from "@/lib/security/permissions";

export async function POST(request: Request) {
  const access = await requireAccess({
    minRole: "ADMIN",
    requiredPermission: permissionKeys.escalationRun,
  });
  if ("error" in access) {
    return access.error;
  }

  const result = await runEscalationSweep(access.user.id);
  await writeAuditLog({
    userId: access.user.id,
    action: "escalation.run",
    entityType: "EscalationPolicy",
    payload: result,
    request,
  });

  return ok(result, 200);
}

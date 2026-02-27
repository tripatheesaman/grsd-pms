import { requireAccess } from "@/lib/api/guard";
import { ok } from "@/lib/api/response";
import { permissionCatalog, permissionKeys } from "@/lib/security/permissions";

export async function GET() {
  const access = await requireAccess({
    minRole: "SUPERADMIN",
    requiredPermission: permissionKeys.permissionsManage,
  });
  if ("error" in access) {
    return access.error;
  }

  return ok(permissionCatalog);
}

import { Role } from "@prisma/client";
import { roleDefaultPermissions } from "@/lib/security/permissions";

const roleRank: Record<Role, number> = {
  USER: 1,
  ADMIN: 2,
  SUPERADMIN: 3,
};

export function hasRequiredRole(current: Role, minimum: Role) {
  return roleRank[current] >= roleRank[minimum];
}

export function hasPermission(
  role: Role,
  permissions: Array<{ allowed: boolean; permission: { key: string } }>,
  key: string,
) {
  const selected = permissions.find((permission) => permission.permission.key === key);
  if (selected) {
    return selected.allowed;
  }
  return roleDefaultPermissions[role].includes(key);
}

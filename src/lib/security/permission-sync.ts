import { prisma } from "@/lib/prisma";
import { permissionCatalog } from "@/lib/security/permissions";

export async function ensurePermissionCatalog() {
  await Promise.all(
    permissionCatalog.map((permission) =>
      prisma.permission.upsert({
        where: {
          key: permission.key,
        },
        create: {
          key: permission.key,
          name: permission.name,
        },
        update: {
          name: permission.name,
        },
      }),
    ),
  );
}

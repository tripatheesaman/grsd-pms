import { z } from "zod";
import { parseBody, requireAccess } from "@/lib/api/guard";
import { fail, ok } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/log";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";

const createTechnicianSchema = z.object({
  name: z.string().min(1).max(200),
  staffId: z.string().min(1).max(50),
  designation: z.string().min(1).max(200),
});

const updateTechnicianSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  staffId: z.string().min(1).max(50).optional(),
  designation: z.string().min(1).max(200).optional(),
  isActive: z.boolean().optional(),
});

export async function GET() {
  const access = await requireAccess({
    minRole: "ADMIN",
    requiredPermission: permissionKeys.equipmentManage,
  });
  if ("error" in access) {
    return access.error;
  }

  const technicians = await prisma.technician.findMany({
    orderBy: { name: "asc" },
  });

  return ok(
    technicians.map((t) => ({
      id: t.id,
      name: t.name,
      staffId: t.staffId,
      designation: t.designation,
      isActive: t.isActive,
    }))
  );
}

export async function POST(request: Request) {
  const access = await requireAccess({
    minRole: "ADMIN",
    requiredPermission: permissionKeys.equipmentManage,
  });
  if ("error" in access) {
    return access.error;
  }

  const parsed = await parseBody(request, createTechnicianSchema);
  if ("error" in parsed) {
    return parsed.error;
  }

  try {
    const technician = await prisma.technician.create({
      data: {
        name: parsed.data.name,
        staffId: parsed.data.staffId,
        designation: parsed.data.designation,
      },
    });

    await writeAuditLog({
      userId: access.user.id,
      action: "technician.create",
      entityType: "Technician",
      entityId: technician.id,
      payload: {
        name: technician.name,
        staffId: technician.staffId,
        designation: technician.designation,
      },
      request,
    });

    return ok({
      id: technician.id,
      name: technician.name,
      staffId: technician.staffId,
      designation: technician.designation,
      isActive: technician.isActive,
    });
  } catch (error: any) {
    if (error.code === "P2002") {
      return fail("DUPLICATE", "A technician with this staff ID already exists", 400);
    }
    return fail("INTERNAL_ERROR", "Failed to create technician", 500);
  }
}

export async function PATCH(request: Request) {
  const access = await requireAccess({
    minRole: "ADMIN",
    requiredPermission: permissionKeys.equipmentManage,
  });
  if ("error" in access) {
    return access.error;
  }

  const parsed = await parseBody(request, updateTechnicianSchema.extend({ id: z.string() }));
  if ("error" in parsed) {
    return parsed.error;
  }

  const { id, ...data } = parsed.data;

  const existing = await prisma.technician.findUnique({
    where: { id },
  });

  if (!existing) {
    return fail("NOT_FOUND", "Technician not found", 404);
  }

  try {
    const technician = await prisma.technician.update({
      where: { id },
      data,
    });

    await writeAuditLog({
      userId: access.user.id,
      action: "technician.update",
      entityType: "Technician",
      entityId: technician.id,
      payload: data,
      request,
    });

    return ok({
      id: technician.id,
      name: technician.name,
      staffId: technician.staffId,
      designation: technician.designation,
      isActive: technician.isActive,
    });
  } catch (error: any) {
    if (error.code === "P2002") {
      return fail("DUPLICATE", "A technician with this staff ID already exists", 400);
    }
    return fail("INTERNAL_ERROR", "Failed to update technician", 500);
  }
}

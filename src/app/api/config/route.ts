import { z } from "zod";
import { parseBody, requireAccess } from "@/lib/api/guard";
import { fail, ok } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/log";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";

export async function GET() {
  const access = await requireAccess({
    minRole: "ADMIN",
    requiredPermission: permissionKeys.dashboardRead,
  });
  if ("error" in access) {
    return access.error;
  }

  try {
    const [reminderHours, approachingHours, issueHours, nearHours] = await Promise.all([
      (prisma as any).systemConfig?.findUnique({ where: { key: "reminder_hours_before" } }),
      (prisma as any).systemConfig?.findUnique({ where: { key: "approaching_offset_hours" } }),
      (prisma as any).systemConfig?.findUnique({ where: { key: "issue_offset_hours" } }),
      (prisma as any).systemConfig?.findUnique({ where: { key: "near_offset_hours" } }),
    ]);

    return ok({
      reminderHoursBefore: reminderHours ? Number(reminderHours.value) : 120,
      approachingOffsetHours: approachingHours ? Number(approachingHours.value) : 120,
      issueOffsetHours: issueHours ? Number(issueHours.value) : 40,
      nearOffsetHours: nearHours ? Number(nearHours.value) : 10,
    });
  } catch (error) {
    return ok({
      reminderHoursBefore: 120,
      approachingOffsetHours: 120,
      issueOffsetHours: 40,
      nearOffsetHours: 10,
    });
  }
}

const updateConfigSchema = z.object({
  reminderHoursBefore: z.number().int().positive().max(10000).optional(),
  approachingOffsetHours: z.number().int().nonnegative().max(10000).optional(),
  issueOffsetHours: z.number().int().nonnegative().max(10000).optional(),
  nearOffsetHours: z.number().int().nonnegative().max(10000).optional(),
});

export async function PATCH(request: Request) {
  const access = await requireAccess({
    minRole: "ADMIN",
    requiredPermission: permissionKeys.equipmentManage,
  });
  if ("error" in access) {
    return access.error;
  }

  const parsed = await parseBody(request, updateConfigSchema);
  if ("error" in parsed) {
    return parsed.error;
  }

  try {
    const configs: Array<{ key: string; value: string; description: string }> = [];

    if (parsed.data.reminderHoursBefore !== undefined) {
      configs.push({
        key: "reminder_hours_before",
        value: String(parsed.data.reminderHoursBefore),
        description: "Hours before maintenance check due date to start showing reminders",
      });
    }

    if (parsed.data.approachingOffsetHours !== undefined) {
      configs.push({
        key: "approaching_offset_hours",
        value: String(parsed.data.approachingOffsetHours),
        description: "Hours before due date when check status becomes 'Approaching'",
      });
    }

    if (parsed.data.issueOffsetHours !== undefined) {
      configs.push({
        key: "issue_offset_hours",
        value: String(parsed.data.issueOffsetHours),
        description: "Hours before due date when check status becomes 'Issue Required'",
      });
    }

    if (parsed.data.nearOffsetHours !== undefined) {
      configs.push({
        key: "near_offset_hours",
        value: String(parsed.data.nearOffsetHours),
        description: "Hours before due date when check status becomes 'Critical'",
      });
    }

    const results: Record<string, number> = {};

    for (const config of configs) {
      const result = await (prisma as any).systemConfig?.upsert({
        where: { key: config.key },
        update: {
          value: config.value,
          updatedByUserId: access.user.id,
        },
        create: {
          key: config.key,
          value: config.value,
          description: config.description,
          updatedByUserId: access.user.id,
        },
      });

      if (!result) {
        return fail("CONFIG_ERROR", "SystemConfig model not available. Please regenerate Prisma client.", 500);
      }

      results[config.key] = Number(result.value);

      await writeAuditLog({
        userId: access.user.id,
        action: "config.update",
        entityType: "SystemConfig",
        entityId: result.id,
        payload: {
          key: result.key,
          value: result.value,
        },
        request,
      });
    }

    const [reminderHours, approachingHours, issueHours, nearHours] = await Promise.all([
      (prisma as any).systemConfig?.findUnique({ where: { key: "reminder_hours_before" } }),
      (prisma as any).systemConfig?.findUnique({ where: { key: "approaching_offset_hours" } }),
      (prisma as any).systemConfig?.findUnique({ where: { key: "issue_offset_hours" } }),
      (prisma as any).systemConfig?.findUnique({ where: { key: "near_offset_hours" } }),
    ]);

    return ok({
      reminderHoursBefore: reminderHours ? Number(reminderHours.value) : 120,
      approachingOffsetHours: approachingHours ? Number(approachingHours.value) : 120,
      issueOffsetHours: issueHours ? Number(issueHours.value) : 40,
      nearOffsetHours: nearHours ? Number(nearHours.value) : 10,
    });
  } catch (error) {
    return fail("CONFIG_ERROR", "Failed to update configuration. Please ensure Prisma client is regenerated.", 500);
  }
}

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
    const [
      reminderHours,
      approachingHours,
      issueHours,
      nearHours,
      sectionCode,
      emailEnabled,
      emailSendOnIssue,
      emailAttachChecksheet,
      emailHost,
      emailPort,
      emailUser,
      emailPassword,
      emailRecipients,
      emailCcs,
      emailTemplateSubject,
      emailTemplateBody,
      emailReminderDaysBefore,
    ] = await Promise.all([
      (prisma as any).systemConfig?.findUnique({ where: { key: "reminder_hours_before" } }),
      (prisma as any).systemConfig?.findUnique({ where: { key: "approaching_offset_hours" } }),
      (prisma as any).systemConfig?.findUnique({ where: { key: "issue_offset_hours" } }),
      (prisma as any).systemConfig?.findUnique({ where: { key: "near_offset_hours" } }),
      (prisma as any).systemConfig?.findUnique({ where: { key: "section_code" } }),
      (prisma as any).systemConfig?.findUnique({ where: { key: "email_enabled" } }),
      (prisma as any).systemConfig?.findUnique({ where: { key: "email_send_on_issue" } }),
      (prisma as any).systemConfig?.findUnique({ where: { key: "email_attach_checksheet" } }),
      (prisma as any).systemConfig?.findUnique({ where: { key: "email_smtp_host" } }),
      (prisma as any).systemConfig?.findUnique({ where: { key: "email_smtp_port" } }),
      (prisma as any).systemConfig?.findUnique({ where: { key: "email_smtp_username" } }),
      (prisma as any).systemConfig?.findUnique({ where: { key: "email_smtp_password" } }),
      (prisma as any).systemConfig?.findUnique({ where: { key: "email_recipients" } }),
      (prisma as any).systemConfig?.findUnique({ where: { key: "email_ccs" } }),
      (prisma as any).systemConfig?.findUnique({ where: { key: "email_template_subject" } }),
      (prisma as any).systemConfig?.findUnique({ where: { key: "email_template_body" } }),
      (prisma as any).systemConfig?.findUnique({ where: { key: "email_reminder_days_before" } }),
    ]);

    return ok({
      reminderHoursBefore: reminderHours ? Number(reminderHours.value) : 120,
      approachingOffsetHours: approachingHours ? Number(approachingHours.value) : 120,
      issueOffsetHours: issueHours ? Number(issueHours.value) : 40,
      nearOffsetHours: nearHours ? Number(nearHours.value) : 10,
      sectionCode: sectionCode ? sectionCode.value : "",
      emailEnabled: emailEnabled ? emailEnabled.value === "true" : false,
      emailSendOnIssue: emailSendOnIssue ? emailSendOnIssue.value !== "false" : true,
      emailAttachChecksheet: emailAttachChecksheet ? emailAttachChecksheet.value === "true" : false,
      emailSmtpHost: emailHost ? emailHost.value : "",
      emailSmtpPort: emailPort ? Number(emailPort.value) : 587,
      emailSmtpUsername: emailUser ? emailUser.value : "",
      emailSmtpPassword: emailPassword ? emailPassword.value : "",
      emailRecipients: emailRecipients ? emailRecipients.value : "",
      emailCcs: emailCcs ? emailCcs.value : "",
      emailTemplateSubject: emailTemplateSubject ? emailTemplateSubject.value : "",
      emailTemplateBody: emailTemplateBody ? emailTemplateBody.value : "",
      emailReminderDaysBefore: emailReminderDaysBefore ? Number(emailReminderDaysBefore.value) : 3,
    });
  } catch (error) {
    return ok({
      reminderHoursBefore: 120,
      approachingOffsetHours: 120,
      issueOffsetHours: 40,
      nearOffsetHours: 10,
      sectionCode: "",
      emailEnabled: false,
      emailSendOnIssue: true,
      emailAttachChecksheet: false,
      emailSmtpHost: "",
      emailSmtpPort: 587,
      emailSmtpUsername: "",
      emailSmtpPassword: "",
      emailRecipients: "",
      emailCcs: "",
      emailTemplateSubject: "",
      emailTemplateBody: "",
      emailReminderDaysBefore: 3,
    });
  }
}

const updateConfigSchema = z.object({
  reminderHoursBefore: z.number().int().positive().max(10000).optional(),
  approachingOffsetHours: z.number().int().nonnegative().max(10000).optional(),
  issueOffsetHours: z.number().int().nonnegative().max(10000).optional(),
  nearOffsetHours: z.number().int().nonnegative().max(10000).optional(),
  sectionCode: z.string().max(50).optional(),
  emailEnabled: z.boolean().optional(),
  emailSendOnIssue: z.boolean().optional(),
  emailAttachChecksheet: z.boolean().optional(),
  emailSmtpHost: z.string().max(255).optional(),
  emailSmtpPort: z.number().int().positive().max(65535).optional(),
  emailSmtpUsername: z.string().max(255).optional(),
  emailSmtpPassword: z.string().max(255).optional(),
  emailRecipients: z.string().max(2000).optional(),
  emailCcs: z.string().max(2000).optional(),
  emailTemplateSubject: z.string().max(500).optional(),
  emailTemplateBody: z.string().max(10000).optional(),
  emailReminderDaysBefore: z.number().int().positive().max(365).optional(),
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

    if (parsed.data.sectionCode !== undefined) {
      configs.push({
        key: "section_code",
        value: parsed.data.sectionCode,
        description: "Section code for equipment history report forms",
      });
    }

    if (parsed.data.emailEnabled !== undefined) {
      configs.push({
        key: "email_enabled",
        value: parsed.data.emailEnabled ? "true" : "false",
        description: "Whether email notifications are enabled globally",
      });
    }

    if (parsed.data.emailAttachChecksheet !== undefined) {
      configs.push({
        key: "email_attach_checksheet",
        value: parsed.data.emailAttachChecksheet ? "true" : "false",
        description: "Whether to attach the checksheet PDF when a check is issued",
      });
    }

    if (parsed.data.emailSendOnIssue !== undefined) {
      configs.push({
        key: "email_send_on_issue",
        value: parsed.data.emailSendOnIssue ? "true" : "false",
        description: "Whether to send email notifications when a check is issued",
      });
    }

    if (parsed.data.emailSmtpHost !== undefined) {
      configs.push({
        key: "email_smtp_host",
        value: parsed.data.emailSmtpHost,
        description: "SMTP host for outgoing email",
      });
    }

    if (parsed.data.emailSmtpPort !== undefined) {
      configs.push({
        key: "email_smtp_port",
        value: String(parsed.data.emailSmtpPort),
        description: "SMTP port for outgoing email",
      });
    }

    if (parsed.data.emailSmtpUsername !== undefined) {
      configs.push({
        key: "email_smtp_username",
        value: parsed.data.emailSmtpUsername,
        description: "SMTP username for outgoing email",
      });
    }

    if (parsed.data.emailSmtpPassword !== undefined) {
      configs.push({
        key: "email_smtp_password",
        value: parsed.data.emailSmtpPassword,
        description: "SMTP password for outgoing email",
      });
    }

    if (parsed.data.emailRecipients !== undefined) {
      configs.push({
        key: "email_recipients",
        value: parsed.data.emailRecipients,
        description: "Comma- or semicolon-separated list of primary email recipients",
      });
    }

    if (parsed.data.emailCcs !== undefined) {
      configs.push({
        key: "email_ccs",
        value: parsed.data.emailCcs,
        description: "Comma- or semicolon-separated list of CC recipients",
      });
    }

    if (parsed.data.emailTemplateSubject !== undefined) {
      configs.push({
        key: "email_template_subject",
        value: parsed.data.emailTemplateSubject,
        description: "Subject template for check notification emails",
      });
    }

    if (parsed.data.emailTemplateBody !== undefined) {
      configs.push({
        key: "email_template_body",
        value: parsed.data.emailTemplateBody,
        description: "Body template for check notification emails",
      });
    }

    if (parsed.data.emailReminderDaysBefore !== undefined) {
      configs.push({
        key: "email_reminder_days_before",
        value: String(parsed.data.emailReminderDaysBefore),
        description: "Number of days before due date to send email reminders",
      });
    }

    const results: Record<string, number | string> = {};

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

      if (config.key === "section_code") {
        results[config.key] = result.value;
      } else {
        results[config.key] = Number(result.value);
      }

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

    const [
      reminderHours,
      approachingHours,
      issueHours,
      nearHours,
      sectionCode,
      emailEnabled,
      emailSendOnIssue,
      emailAttachChecksheet,
      emailHost,
      emailPort,
      emailUser,
      emailPassword,
      emailRecipients,
      emailCcs,
      emailTemplateSubject,
      emailTemplateBody,
      emailReminderDaysBefore,
    ] = await Promise.all([
      (prisma as any).systemConfig?.findUnique({ where: { key: "reminder_hours_before" } }),
      (prisma as any).systemConfig?.findUnique({ where: { key: "approaching_offset_hours" } }),
      (prisma as any).systemConfig?.findUnique({ where: { key: "issue_offset_hours" } }),
      (prisma as any).systemConfig?.findUnique({ where: { key: "near_offset_hours" } }),
      (prisma as any).systemConfig?.findUnique({ where: { key: "section_code" } }),
      (prisma as any).systemConfig?.findUnique({ where: { key: "email_enabled" } }),
      (prisma as any).systemConfig?.findUnique({ where: { key: "email_send_on_issue" } }),
      (prisma as any).systemConfig?.findUnique({ where: { key: "email_attach_checksheet" } }),
      (prisma as any).systemConfig?.findUnique({ where: { key: "email_smtp_host" } }),
      (prisma as any).systemConfig?.findUnique({ where: { key: "email_smtp_port" } }),
      (prisma as any).systemConfig?.findUnique({ where: { key: "email_smtp_username" } }),
      (prisma as any).systemConfig?.findUnique({ where: { key: "email_smtp_password" } }),
      (prisma as any).systemConfig?.findUnique({ where: { key: "email_recipients" } }),
      (prisma as any).systemConfig?.findUnique({ where: { key: "email_ccs" } }),
      (prisma as any).systemConfig?.findUnique({ where: { key: "email_template_subject" } }),
      (prisma as any).systemConfig?.findUnique({ where: { key: "email_template_body" } }),
      (prisma as any).systemConfig?.findUnique({ where: { key: "email_reminder_days_before" } }),
    ]);

    return ok({
      reminderHoursBefore: reminderHours ? Number(reminderHours.value) : 120,
      approachingOffsetHours: approachingHours ? Number(approachingHours.value) : 120,
      issueOffsetHours: issueHours ? Number(issueHours.value) : 40,
      nearOffsetHours: nearHours ? Number(nearHours.value) : 10,
      sectionCode: sectionCode ? sectionCode.value : "",
      emailEnabled: emailEnabled ? emailEnabled.value === "true" : false,
      emailSendOnIssue: emailSendOnIssue ? emailSendOnIssue.value !== "false" : true,
      emailAttachChecksheet: emailAttachChecksheet ? emailAttachChecksheet.value === "true" : false,
      emailSmtpHost: emailHost ? emailHost.value : "",
      emailSmtpPort: emailPort ? Number(emailPort.value) : 587,
      emailSmtpUsername: emailUser ? emailUser.value : "",
      emailSmtpPassword: emailPassword ? emailPassword.value : "",
      emailRecipients: emailRecipients ? emailRecipients.value : "",
      emailCcs: emailCcs ? emailCcs.value : "",
      emailTemplateSubject: emailTemplateSubject ? emailTemplateSubject.value : "",
      emailTemplateBody: emailTemplateBody ? emailTemplateBody.value : "",
      emailReminderDaysBefore: emailReminderDaysBefore ? Number(emailReminderDaysBefore.value) : 3,
    });
  } catch (error) {
    return fail("CONFIG_ERROR", "Failed to update configuration. Please ensure Prisma client is regenerated.", 500);
  }
}

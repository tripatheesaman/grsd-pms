import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { CheckSheet, Equipment } from "@prisma/client";

type EmailConfig = {
  enabled: boolean;
  sendOnIssue: boolean;
  host: string | null;
  port: number | null;
  username: string | null;
  password: string | null;
  recipients: string[];
  ccs: string[];
  templateSubject: string;
  templateBody: string;
  reminderDaysBefore: number;
};

const CONFIG_KEYS = [
  "email_enabled",
  "email_send_on_issue",
  "email_smtp_host",
  "email_smtp_port",
  "email_smtp_username",
  "email_smtp_password",
  "email_recipients",
  "email_ccs",
  "email_template_subject",
  "email_template_body",
  "email_reminder_days_before",
] as const;

async function loadEmailConfig(): Promise<EmailConfig> {
  const configs = await (prisma as any).systemConfig?.findMany({
    where: { key: { in: CONFIG_KEYS as unknown as string[] } },
  });

  const map: Record<string, string> = {};
  for (const cfg of configs || []) {
    if (cfg.key && typeof cfg.value === "string") {
      map[cfg.key] = cfg.value;
    }
  }

  const enabled = map["email_enabled"] === "true";
  const sendOnIssue = map["email_send_on_issue"] !== "false"; // default true
  const host = map["email_smtp_host"] ?? null;
  const port = map["email_smtp_port"] ? Number(map["email_smtp_port"]) : null;
  const username = map["email_smtp_username"] ?? null;
  const password = map["email_smtp_password"] ?? null;
  const recipients = (map["email_recipients"] ?? "")
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const ccs = (map["email_ccs"] ?? "")
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const templateSubject =
    map["email_template_subject"] ??
    "Maintenance Check {{type}} for {{equipmentNumber}} (Check {{checkCode}})";
  const templateBody =
    map["email_template_body"] ??
    [
      "Dear Team,",
      "",
      "A maintenance check has been {{type}}.",
      "",
      "Equipment: {{equipmentNumber}} - {{equipmentName}}",
      "Check Code: {{checkCode}}",
      "Due Date: {{dueDate}}",
      "Due Hours: {{dueHours}} {{usageUnit}}",
      "Status: {{status}}",
      "",
      "Regards,",
      "GrSD PMS",
    ].join("\n");

  const reminderDaysBefore = map["email_reminder_days_before"]
    ? Number(map["email_reminder_days_before"])
    : 3;

  return {
    enabled,
    sendOnIssue,
    host,
    port,
    username,
    password,
    recipients,
    ccs,
    templateSubject,
    templateBody,
    reminderDaysBefore,
  };
}

function buildTransport(config: EmailConfig) {
  if (!config.host || !config.port || !config.username || !config.password) {
    return null;
  }

  const secure = config.port === 465;

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure,
    auth: {
      user: config.username,
      pass: config.password,
    },
  });
}

function applyTemplate(template: string, data: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    const pattern = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    result = result.replace(pattern, value);
  }
  return result;
}

type EmailContext = {
  type: "issued" | "reminder";
  check: CheckSheet & { equipment: Equipment };
};

export async function sendCheckEmail(context: EmailContext) {
  const config = await loadEmailConfig();

  if (!config.enabled) return;
  if (context.type === "issued" && !config.sendOnIssue) return;
  if (config.recipients.length === 0) return;

  const transport = buildTransport(config);
  if (!transport) return;

  const { check } = context;

  const data: Record<string, string> = {
    type: context.type === "issued" ? "issued" : "due soon",
    equipmentNumber: check.equipment.equipmentNumber,
    equipmentName: check.equipment.displayName,
    checkCode: check.checkCode,
    dueDate: check.dueDate.toISOString().split("T")[0],
    dueHours: check.dueHours.toString(),
    usageUnit: check.equipment.usageUnit,
    status: check.status,
  };

  const subject = applyTemplate(config.templateSubject, data);
  const body = applyTemplate(config.templateBody, data);

  await transport.sendMail({
    from: config.username || undefined,
    to: config.recipients.join(", "),
    cc: config.ccs.length ? config.ccs.join(", ") : undefined,
    subject,
    text: body,
  });
}

export async function getEmailReminderDaysBefore(): Promise<number> {
  const config = await loadEmailConfig();
  return config.reminderDaysBefore;
}


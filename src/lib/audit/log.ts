import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AuditPayload = {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  payload?: unknown;
  request?: Request;
};

export async function writeAuditLog(input: AuditPayload) {
  const ipAddress =
    input.request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = input.request?.headers.get("user-agent") ?? null;

  let serializedPayload: Prisma.InputJsonValue | undefined;
  if (input.payload !== undefined) {
    const json = JSON.stringify(input.payload);
    serializedPayload = JSON.parse(json) as Prisma.InputJsonValue;
  }

  await prisma.auditLog
    .create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        payload: serializedPayload,
        ipAddress,
        userAgent,
      },
    })
    .catch(() => null);
}

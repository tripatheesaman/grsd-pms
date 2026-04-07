import type { CheckStatus } from "@prisma/client";

/**
 * Use this instead of `CheckStatus.SKIPPED` in queries and writes. If a deploy runs an
 * older generated `@prisma/client` before `prisma generate`, `CheckStatus.SKIPPED` is
 * `undefined` and Prisma rejects `in: [..., undefined]`.
 */
export const CHECK_STATUS_SKIPPED = "SKIPPED" as CheckStatus;

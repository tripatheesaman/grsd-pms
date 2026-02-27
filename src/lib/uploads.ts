import { dirname, join } from "path";
import { mkdir, writeFile, rename } from "fs/promises";

export const UPLOAD_ROOT = process.env.UPLOAD_ROOT ?? "/data/uploads";

function ensureSafeSegment(segment: string) {
  if (segment.includes("..")) {
    throw new Error("Invalid path segment");
  }
}

export function buildUploadPath(...segments: string[]): string {
  segments.forEach(ensureSafeSegment);
  return join(UPLOAD_ROOT, ...segments);
}

export async function writeFileAtomic(targetPath: string, data: Buffer | Uint8Array) {
  await mkdir(dirname(targetPath), { recursive: true });
  const tempPath = `${targetPath}.tmp-${Date.now()}`;
  await writeFile(tempPath, data);
  await rename(tempPath, targetPath);
}


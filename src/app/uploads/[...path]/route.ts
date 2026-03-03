import { NextRequest } from "next/server";
import { readFile, stat } from "fs/promises";
import { buildUploadPath } from "@/lib/uploads";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

function getContentType(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  return "application/octet-stream";
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const segments = path ?? [];
  try {
    const filePath = buildUploadPath(...segments);
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      return new Response("Not found", { status: 404 });
    }

    const data = await readFile(filePath);
    const contentType = getContentType(filePath);

    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": fileStat.size.toString(),
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}


export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "/pms";

function normalizePath(path: string): string {
  if (!path.startsWith("/")) {
    return `/${path}`;
  }
  return path;
}

export function withBasePath(path: string): string {
  return `${BASE_PATH}${normalizePath(path)}`;
}

export function apiPath(path: string): string {
  // Expect paths like "/api/..." or "api/..."
  const normalized = normalizePath(path);
  return `${BASE_PATH}${normalized}`;
}

export const UPLOADS_BASE_URL = `${BASE_PATH}/uploads`;


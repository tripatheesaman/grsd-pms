import { ApiError, ApiSuccess } from "@/types/api";
import { apiPath } from "@/lib/config/app-config";

type ApiMethod = "GET" | "POST" | "PATCH" | "DELETE";

async function apiRequest<T>(
  path: string,
  method: ApiMethod,
  body?: unknown,
): Promise<T> {
  const url = apiPath(path);

  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = (await response.json()) as ApiSuccess<T> | ApiError;

  if (response.status === 401 && typeof window !== "undefined") {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const isAuthEndpoint = normalizedPath.startsWith("/api/auth/");
    const alreadyOnLogin = window.location.pathname === apiPath("/");
    const redirectInProgress = window.sessionStorage.getItem("grsd:redirecting-login") === "1";

    // Never redirect for auth endpoints themselves to avoid login loops.
    if (!isAuthEndpoint && !alreadyOnLogin && !redirectInProgress) {
      window.sessionStorage.setItem("grsd:redirecting-login", "1");
      window.sessionStorage.setItem("grsd:session-expired", "1");
      window.location.href = apiPath("/");
    }
    throw new Error("Session expired");
  }

  if (!response.ok) {
    const message =
      "error" in payload ? payload.error.message : "Request failed";
    throw new Error(message);
  }

  return (payload as ApiSuccess<T>).data;
}

export async function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path, "GET");
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, "POST", body);
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, "PATCH", body);
}

export async function apiDelete<T>(path: string): Promise<T> {
  return apiRequest<T>(path, "DELETE");
}

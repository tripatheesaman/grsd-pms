import { ApiError, ApiSuccess } from "@/types/api";
import { apiPath } from "@/lib/config/app-config";

type ApiMethod = "GET" | "POST" | "PATCH" | "DELETE";

async function parseApiResponse<T>(path: string, response: Response): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (response.status === 401 && typeof window !== "undefined") {
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

  const text = await response.text();
  let payload: ApiSuccess<T> | ApiError | null = null;
  if (text.trim()) {
    try {
      payload = JSON.parse(text) as ApiSuccess<T> | ApiError;
    } catch {
      throw new Error("Invalid response from server");
    }
  }

  if (!response.ok) {
    const message =
      payload && "error" in payload
        ? payload.error.message
        : `Request failed (${response.status})`;
    throw new Error(message);
  }

  if (!payload || !("data" in payload)) {
    throw new Error(
      "Empty response from server. The request may have timed out—try again or approve in smaller batches.",
    );
  }

  return payload.data;
}

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

  return parseApiResponse<T>(path, response);
}

export async function apiPostForm<T>(path: string, formData: FormData): Promise<T> {
  const url = apiPath(path);
  const response = await fetch(url, {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  return parseApiResponse<T>(path, response);
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

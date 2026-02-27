"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api/client";
import { UserRole } from "@/types/api";

type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  permissions: Array<{ key: string; allowed: boolean }>;
};

type LoginInput = {
  email: string;
  password: string;
};

type BootstrapInput = {
  email: string;
  fullName: string;
  password: string;
};

export function useCurrentUser() {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiGet<AuthUser>("/api/auth/me"),
    retry: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: LoginInput) =>
      apiPost<AuthUser>("/api/auth/login", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<{ success: boolean }>("/api/auth/logout", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });
}

export function useBootstrapSuperadmin() {
  return useMutation({
    mutationFn: (payload: BootstrapInput) =>
      apiPost<{ id: string; email: string }>("/api/auth/bootstrap", payload),
  });
}

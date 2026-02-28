"use client";

import { FormEvent, useState } from "react";
import toast from "react-hot-toast";
import { useLogin } from "@/hooks/use-auth";
import { BASE_PATH } from "@/lib/config/app-config";

export function AuthScreen() {
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loginError = login.error instanceof Error ? login.error.message : "";

  const onLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    login.mutate(
      { email, password },
      {
        onSuccess: () => {
          toast.success("Signed in successfully");
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Failed to sign in");
        },
      }
    );
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#f4f7fb] via-[#e7eef8] to-[#f4f7fb] px-4 py-8 sm:px-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(11,61,145,0.15),transparent_50%),radial-gradient(circle_at_80%_70%,rgba(215,38,61,0.12),transparent_50%)]" />
      
      <div className="relative w-full max-w-md">
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="mb-6 flex items-center justify-center rounded-2xl bg-white p-6 shadow-2xl shadow-[var(--color-primary)]/30 border-2 border-[var(--color-primary)]/30">
            <img 
              src={`${BASE_PATH}/logo.png`} 
              alt="GrSD Logo" 
              width={120} 
              height={120} 
              className="object-contain max-w-full h-auto"
              style={{ display: 'block' }}
            />
          </div>
          <h1 className="mb-3 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] bg-clip-text text-3xl font-bold text-transparent sm:text-4xl">
            GrSD Planning System
          </h1>
          <p className="text-base text-[var(--color-text-soft)] sm:text-lg">
            Sign in to access your dashboard
          </p>
        </div>

        <div className="rounded-3xl border border-white/20 bg-white/95 p-8 shadow-2xl backdrop-blur-xl sm:p-10">
          <form className="space-y-6" onSubmit={onLogin}>
            <div>
              <label className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-12 w-full rounded-xl border-2 border-[var(--color-surface-strong)] bg-white px-4 text-sm font-medium outline-none transition-all placeholder:text-[var(--color-text-soft)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/20"
                placeholder="you@grsd.local"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
                Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-12 w-full rounded-xl border-2 border-[var(--color-surface-strong)] bg-white px-4 text-sm font-medium outline-none transition-all placeholder:text-[var(--color-text-soft)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/20"
                placeholder="Enter your password"
              />
            </div>

            {loginError ? (
              <div className="rounded-xl bg-gradient-to-r from-[var(--color-accent)]/10 to-[var(--color-accent)]/5 border-2 border-[var(--color-accent)]/20 px-4 py-3 text-sm font-semibold text-[var(--color-accent)]">
                {loginError}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={login.isPending}
              className="h-12 w-full rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] text-sm font-bold text-white shadow-lg shadow-[var(--color-primary)]/40 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-[var(--color-primary)]/50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
            >
              {login.isPending ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

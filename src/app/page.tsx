"use client";

import nextDynamic from "next/dynamic";
import { useCurrentUser } from "@/hooks/use-auth";

const AuthScreen = nextDynamic(
  () => import("@/components/auth/auth-screen").then((module) => module.AuthScreen),
);

const AppDashboard = nextDynamic(
  () => import("@/components/dashboard/app-dashboard").then((module) => module.AppDashboard),
  {
    loading: () => (
      <main className="flex min-h-screen items-center justify-center bg-[var(--color-surface)] px-4">
        <div className="rounded-xl bg-white px-5 py-4 text-sm font-medium text-[var(--color-text)] shadow-sm ring-1 ring-black/5">
          Loading dashboard...
        </div>
      </main>
    ),
  },
);

export const dynamic = 'force-dynamic';

export default function Home() {
  const currentUser = useCurrentUser();

  if (currentUser.isLoading) {
  return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--color-surface)] px-4">
        <div className="rounded-xl bg-white px-5 py-4 text-sm font-medium text-[var(--color-text)] shadow-sm ring-1 ring-black/5">
          Loading secure workspace...
        </div>
      </main>
    );
  }

  if (currentUser.isError || !currentUser.data) {
    return <AuthScreen />;
  }

  return (
    <AppDashboard
      user={{
        id: currentUser.data.id,
        fullName: currentUser.data.fullName,
        email: currentUser.data.email,
        role: currentUser.data.role,
      }}
    />
  );
}

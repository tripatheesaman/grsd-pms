"use client";

import { AuthScreen } from "@/components/auth/auth-screen";
import { AppDashboard } from "@/components/dashboard/app-dashboard";
import { useCurrentUser } from "@/hooks/use-auth";

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

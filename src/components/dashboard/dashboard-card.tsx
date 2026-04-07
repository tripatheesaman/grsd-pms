import type { ReactNode } from "react";

export const dashboardInputClass =
  "h-12 w-full rounded-xl border-2 border-[var(--color-surface-strong)] bg-white px-4 text-sm font-medium outline-none transition-all focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/20 shadow-sm";

export function Card({
  title,
  className = "",
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border-2 border-[var(--color-surface-strong)] bg-gradient-to-br from-white to-[var(--color-surface)] p-6 shadow-xl ${className}`}
    >
      <h2 className="mb-5 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] bg-clip-text text-xl font-bold text-transparent">
        {title}
      </h2>
      {children}
    </div>
  );
}

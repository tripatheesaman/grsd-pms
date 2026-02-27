import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { Toaster } from "react-hot-toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GrSD Planning System",
  description: "Planning System for GrSD operations and workflows",
  icons: {
    icon: "/nac_icon.png",
    shortcut: "/nac_icon.png",
    apple: "/nac_icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <QueryProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: "white",
                color: "var(--color-text)",
                borderRadius: "12px",
                border: "2px solid var(--color-surface-strong)",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                padding: "16px",
                fontSize: "14px",
                fontWeight: "500",
              },
              success: {
                iconTheme: {
                  primary: "var(--color-primary)",
                  secondary: "white",
                },
                style: {
                  borderColor: "var(--color-primary)",
                },
              },
              error: {
                iconTheme: {
                  primary: "var(--color-accent)",
                  secondary: "white",
                },
                style: {
                  borderColor: "var(--color-accent)",
                },
              },
            }}
          />
        </QueryProvider>
      </body>
    </html>
  );
}

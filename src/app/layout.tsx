import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "@fontsource-variable/figtree";
import "@fontsource-variable/montserrat/wght-italic.css";
import "./globals.css";
import { THEME_COOKIE } from "@/lib/config";

export const metadata: Metadata = {
  title: { default: "Propulse", template: "%s - Propulse" },
  description: "Candidate search for the Propulse team.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get(THEME_COOKIE)?.value;
  return (
    <html lang="en" data-theme={theme === "dark" || theme === "light" ? theme : undefined}>
      <body>{children}</body>
    </html>
  );
}

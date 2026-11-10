import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorker from "./ServiceWorker";

export const metadata: Metadata = {
  title: "Johden AI Business Manager",
  description: "Your AI-assisted workspace for prospects, follow-ups, and business tasks.",
  applicationName: "Johden AI",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Johden AI" },
};

export const viewport: Viewport = {
  themeColor: "#971b1e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><ServiceWorker />{children}</body>
    </html>
  );
}

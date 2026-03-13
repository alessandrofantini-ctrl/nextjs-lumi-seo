import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Orbita — Lumi SEO Suite",
  description: "Lumi SEO Suite",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='%230a0e1a'/><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%25' stop-color='%236366f1'/><stop offset='100%25' stop-color='%2338bdf8'/></linearGradient></defs><path d='M14 50 Q32 12 50 36' stroke='url(%23g)' stroke-width='4' stroke-linecap='round' fill='none'/><circle cx='50' cy='36' r='5.5' fill='%2338bdf8'/><circle cx='14' cy='50' r='3.5' fill='%236366f1' opacity='0.55'/></svg>",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" className="h-full">
      <body className={`${geist.className} h-full bg-[#f7f7f6] text-[#1a1a1a] antialiased`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

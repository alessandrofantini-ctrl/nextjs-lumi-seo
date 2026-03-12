import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Lumi SEO Suite",
  description: "Tool interno per la gestione SEO",
  icons: { icon: "/favicon.svg" },
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

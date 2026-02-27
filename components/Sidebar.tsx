"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, BarChart2, PenLine, Settings } from "lucide-react";

const NAV = [
  { href: "/clients", label: "Clienti",     icon: Users     },
  { href: "/seo",     label: "Analisi SEO", icon: BarChart2 },
  { href: "/writer",  label: "Redattore",   icon: PenLine   },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-52 shrink-0 flex flex-col bg-[#141414] border-r border-white/[0.07] h-full">

      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/[0.07]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[#7c6af7] flex items-center justify-center">
            <span className="text-[11px] font-bold text-white">L</span>
          </div>
          <span className="text-sm font-semibold text-white/90 tracking-tight">
            Lumi SEO Suite
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 flex flex-col gap-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={[
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-colors",
                active
                  ? "bg-white/[0.08] text-white font-medium"
                  : "text-white/50 hover:text-white/80 hover:bg-white/[0.04]",
              ].join(" ")}
            >
              <Icon size={15} strokeWidth={active ? 2 : 1.7} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="p-2 border-t border-white/[0.07]">
        <Link
          href="/impostazioni"
          className={[
            "flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-colors",
            pathname === "/impostazioni"
              ? "bg-white/[0.08] text-white font-medium"
              : "text-white/35 hover:text-white/70 hover:bg-white/[0.04]",
          ].join(" ")}
        >
          <Settings size={15} strokeWidth={1.7} />
          Impostazioni
        </Link>
      </div>
    </aside>
  );
}

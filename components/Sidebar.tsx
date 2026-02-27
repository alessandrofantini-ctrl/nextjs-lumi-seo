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
    <aside className="w-56 shrink-0 flex flex-col bg-[#141414] border-r border-white/[0.06] h-full">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-white/[0.06]">
        <span className="text-lg font-semibold tracking-tight text-white">
          Lumi <span className="text-[#7c6af7]">SEO</span>
        </span>
        <p className="text-[11px] text-white/30 mt-0.5">Suite interna</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 flex flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all
                ${active
                  ? "bg-[#7c6af7]/15 text-[#a89ff9] font-medium"
                  : "text-white/50 hover:text-white/80 hover:bg-white/[0.04]"
                }
              `}
            >
              <Icon size={16} strokeWidth={1.8} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-white/[0.06]">
        <Link
          href="/impostazioni"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-all"
        >
          <Settings size={16} strokeWidth={1.8} />
          Impostazioni
        </Link>
      </div>
    </aside>
  );
}

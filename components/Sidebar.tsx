"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Users, BarChart2, PenLine, Settings, LogOut, ArrowLeftRight, LayoutDashboard, Calendar } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

const NAV = [
  { href: "/dashboard", label: "Dashboard",   icon: LayoutDashboard },
  { href: "/calendar",  label: "Calendario",  icon: Calendar        },
  { href: "/clients",   label: "Clienti",     icon: Users           },
  { href: "/seo",       label: "Analisi SEO", icon: BarChart2       },
  { href: "/migration", label: "Migrazione",  icon: ArrowLeftRight  },
  { href: "/writer",    label: "Redattore",   icon: PenLine         },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-52 shrink-0 flex flex-col bg-white border-r border-[#e8e8e8] h-full">

      {/* Logo */}
      <div className="px-4 py-5 border-b border-[#e8e8e8]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[#1a1a1a] flex items-center justify-center">
            <span className="text-[11px] font-bold text-white">L</span>
          </div>
          <span className="text-sm font-semibold text-[#1a1a1a] tracking-tight">
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
                  ? "bg-[#f0f0ef] text-[#1a1a1a] font-medium"
                  : "text-[#737373] hover:text-[#1a1a1a] hover:bg-[#f5f5f4]",
              ].join(" ")}
            >
              <Icon size={15} strokeWidth={active ? 2 : 1.7} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="p-2 border-t border-[#e8e8e8] flex flex-col gap-0.5">
        <Link
          href="/impostazioni"
          className={[
            "flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-colors",
            pathname === "/impostazioni"
              ? "bg-[#f0f0ef] text-[#1a1a1a] font-medium"
              : "text-[#ababab] hover:text-[#737373] hover:bg-[#f5f5f4]",
          ].join(" ")}
        >
          <Settings size={15} strokeWidth={1.7} />
          Impostazioni
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] text-[#ababab] hover:text-red-500 hover:bg-red-50 transition-colors w-full text-left"
        >
          <LogOut size={15} strokeWidth={1.7} />
          Esci
        </button>
      </div>
    </aside>
  );
}

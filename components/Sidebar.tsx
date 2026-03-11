"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Users, BarChart2, PenLine, Settings, LogOut,
  ArrowLeftRight, Calendar, FileText, BookOpen,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

const NAV = [
  { href: "/clients",   label: "Clienti",     icon: Users           },
  { href: "/calendar",  label: "Calendario",  icon: Calendar        },
  { href: "/seo",       label: "Analisi SEO", icon: BarChart2       },
  { href: "/briefs",    label: "Brief",        icon: FileText        },
  { href: "/writer",    label: "Redattore",   icon: PenLine         },
  { href: "/articles",  label: "Articoli",    icon: BookOpen        },
  { href: "/migration", label: "Migrazione",  icon: ArrowLeftRight  },
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

      {/* User avatar */}
      <UserAvatar />

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

      {/* Active client */}
      <ActiveClient />

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

function UserAvatar() {
  const [initials, setInitials] = useState("?");
  useEffect(() => {
    async function load() {
      const { createClient } = await import("@/utils/supabase/client");
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const name = user.user_metadata?.full_name
        || user.user_metadata?.name
        || user.email
        || "";
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        setInitials((parts[0][0] + parts[1][0]).toUpperCase());
      } else if (parts[0]) {
        setInitials(parts[0].substring(0, 2).toUpperCase());
      }
    }
    load();
  }, []);
  return (
    <div className="flex items-center gap-2.5 px-3 py-4 border-b border-[#e8e8e8] mb-2">
      <div className="w-7 h-7 rounded-full bg-[#1a1a1a] flex items-center justify-center shrink-0">
        <span className="text-[10px] font-semibold text-white">{initials}</span>
      </div>
      <span className="text-[12px] font-medium text-[#333] truncate">
        Lumi SEO Suite
      </span>
    </div>
  );
}

function ActiveClient() {
  const pathname = usePathname();
  const [clientName, setClientName] = useState<string | null>(null);
  useEffect(() => {
    const match = pathname.match(/^\/clients\/([^/]+)/);
    if (!match) { setClientName(null); return; }
    const clientId = match[1];
    import("@/lib/api").then(({ apiFetch }) => {
      apiFetch(`/api/clients/${clientId}`)
        .then((r) => r.json())
        .then((data) => setClientName(data.name || null))
        .catch(() => setClientName(null));
    });
  }, [pathname]);
  if (!clientName) return null;
  return (
    <div className="mx-3 mb-3 px-3 py-2.5 rounded-lg bg-[#f7f7f6] border border-[#e8e8e8]">
      <p className="text-[9px] font-medium text-[#ababab] uppercase tracking-wide mb-0.5">
        Progetto attivo
      </p>
      <p className="text-[12px] font-semibold text-[#1a1a1a] truncate">
        {clientName}
      </p>
    </div>
  );
}

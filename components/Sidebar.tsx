"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Users, BarChart2, PenLine, Settings, LogOut,
  ArrowLeftRight, Calendar, FileText, BookOpen, Archive,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

const NAV_GROUPS = [
  {
    label: "Principale",
    items: [
      { href: "/clients",  label: "Clienti",    icon: Users    },
      { href: "/calendar", label: "Calendario", icon: Calendar },
    ],
  },
  {
    label: "Contenuti",
    items: [
      { href: "/seo",      label: "Analisi SEO", icon: BarChart2      },
      { href: "/briefs",   label: "Brief",        icon: FileText       },
      { href: "/writer",   label: "Redattore",   icon: PenLine        },
      { href: "/articles", label: "Articoli",    icon: BookOpen       },
    ],
  },
  {
    label: "Strumenti",
    items: [
      { href: "/migration",  label: "Migrazione",       icon: ArrowLeftRight },
      { href: "/migrations", label: "Archivio redirect", icon: Archive        },
    ],
  },
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
    <aside className="w-48 shrink-0 flex flex-col h-full"
           style={{ background: "var(--lumi-sidebar-bg)" }}>

      {/* Logo + user avatar */}
      <UserAvatar />

      {/* Nav */}
      <nav className="flex-1 px-2 py-1 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p style={{
              fontSize: 9.5,
              fontWeight: 600,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.25)",
              padding: "10px 10px 4px",
            }}>
              {group.label}
            </p>
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 10px",
                    borderRadius: 6,
                    marginBottom: 1,
                    fontSize: 12.5,
                    background: active ? "rgba(99,102,241,0.18)" : "transparent",
                    color: active ? "#a5b4fc" : "rgba(255,255,255,0.5)",
                    fontWeight: active ? 500 : 400,
                    transition: "all 0.1s",
                    textDecoration: "none",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                      (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.8)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                      (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.5)";
                    }
                  }}
                >
                  <Icon size={14} strokeWidth={active ? 2 : 1.7} />
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Active client */}
      <ActiveClient />

      {/* Footer */}
      <div style={{
        padding: "8px",
        borderTop: "1px solid var(--lumi-sidebar-border)",
      }}>
        <Link
          href="/impostazioni"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 10px",
            borderRadius: 6,
            fontSize: 12.5,
            color: pathname === "/impostazioni" ? "#a5b4fc" : "rgba(255,255,255,0.35)",
            textDecoration: "none",
          }}
        >
          <Settings size={14} strokeWidth={1.7} />
          Impostazioni
        </Link>
        <button
          onClick={handleLogout}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 10px",
            borderRadius: 6,
            width: "100%",
            fontSize: 12.5,
            color: "rgba(255,255,255,0.35)",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = "#fca5a5";
            (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.1)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.35)";
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          <LogOut size={14} strokeWidth={1.7} />
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
    <div style={{
      padding: "14px 14px 12px",
      borderBottom: "1px solid var(--lumi-sidebar-border)",
      display: "flex",
      alignItems: "center",
      gap: 9,
    }}>
      {/* Logo geometrico Lumi */}
      <div style={{
        width: 26,
        height: 26,
        borderRadius: 7,
        background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M4 2.5V11.5H10.5" stroke="white" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <span style={{
        fontSize: 13,
        fontWeight: 600,
        color: "rgba(255,255,255,0.9)",
        letterSpacing: "-0.01em",
      }}>
        Lumi SEO
      </span>
      {/* Initials badge utente */}
      <div style={{
        marginLeft: "auto",
        width: 24,
        height: 24,
        borderRadius: "50%",
        background: "rgba(99,102,241,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 9,
        fontWeight: 700,
        color: "#a5b4fc",
        flexShrink: 0,
      }}>
        {initials}
      </div>
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
    <div style={{
      margin: "0 8px 8px",
      padding: "8px 10px",
      borderRadius: 7,
      background: "rgba(255,255,255,0.05)",
      border: "1px solid rgba(255,255,255,0.08)",
    }}>
      <p style={{
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "rgba(255,255,255,0.3)",
        marginBottom: 2,
      }}>
        Progetto attivo
      </p>
      <p style={{
        fontSize: 12,
        fontWeight: 500,
        color: "rgba(255,255,255,0.75)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {clientName}
      </p>
    </div>
  );
}

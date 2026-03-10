"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader, Card } from "@/components/ui";
import { apiFetch } from "@/lib/api";

// ── Tipi ────────────────────────────────────────────────────────────────────

type DashboardClient = {
  id: string;
  name: string;
  sector?: string;
  total_keywords: number;
  keywords_crescita: number;
  keywords_calo: number;
  last_sync: string | null;
};

// ── Pagina ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [clients, setClients] = useState<DashboardClient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/dashboard")
      .then((r) => r.json())
      .then((data: DashboardClient[]) => setClients(data))
      .catch(() => setClients([]))
      .finally(() => setLoading(false));
  }, []);

  // KPI globali
  const totalCrescita = clients.reduce((s, c) => s + c.keywords_crescita, 0);
  const totalCalo     = clients.reduce((s, c) => s + c.keywords_calo,     0);
  const activeClients = clients.filter((c) => c.total_keywords > 0).length;

  return (
    <div className="p-8 max-w-[1200px] mx-auto">
      <PageHeader
        title="Dashboard"
        subtitle="Panoramica tutti i progetti"
      />

      {/* KPI globali */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card className="p-5">
          <p className="text-[11px] text-[#ababab] uppercase tracking-wide mb-1">
            Progetti attivi
          </p>
          <p className="text-[28px] font-semibold text-[#1a1a1a] leading-none">
            {loading ? "—" : activeClients}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-[11px] text-[#ababab] uppercase tracking-wide mb-1">
            Keyword in crescita
          </p>
          <p className="text-[28px] font-semibold text-green-600 leading-none">
            {loading ? "—" : totalCrescita}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-[11px] text-[#ababab] uppercase tracking-wide mb-1">
            Keyword in calo
          </p>
          <p className="text-[28px] font-semibold text-red-500 leading-none">
            {loading ? "—" : totalCalo}
          </p>
        </Card>
      </div>

      {/* Griglia clienti */}
      {loading ? (
        <SkeletonGrid />
      ) : clients.length === 0 ? (
        <p className="text-[#ababab] text-[13px] text-center py-12">
          Nessun dato disponibile — sincronizza GSC per almeno un cliente per vedere il trend.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client) => (
            <Link key={client.id} href={`/clients/${client.id}`}>
              <Card className="p-5 hover:border-[#ccc] hover:shadow-sm transition-all cursor-pointer h-full">
                {/* Header card */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-[14px] font-semibold text-[#1a1a1a]">
                      {client.name}
                    </p>
                    <p className="text-[11px] text-[#ababab] mt-0.5">
                      {client.sector || "—"}
                    </p>
                  </div>
                  <SyncBadge lastSync={client.last_sync} />
                </div>

                {/* KPI trend */}
                <div className="flex gap-3 flex-wrap">
                  <TrendPill value={client.keywords_crescita} type="crescita" />
                  <TrendPill value={client.keywords_calo}     type="calo"     />
                </div>

                {/* Footer */}
                <p className="text-[11px] text-[#c0c0c0] mt-4">
                  {client.total_keywords} keyword monitorate
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Componenti locali ────────────────────────────────────────────────────────

function TrendPill({ value, type }: { value: number; type: "crescita" | "calo" }) {
  if (value === 0) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-medium border ${
        type === "crescita"
          ? "bg-green-50 text-green-600 border-green-200"
          : "bg-red-50 text-red-600 border-red-200"
      }`}
    >
      {type === "crescita" ? "↑" : "↓"}
      {value} {type === "crescita" ? "in crescita" : "in calo"}
    </span>
  );
}

function SyncBadge({ lastSync }: { lastSync: string | null }) {
  if (!lastSync) {
    return <span className="text-[10px] text-[#c0c0c0]">Nessun sync</span>;
  }
  const days = Math.floor((Date.now() - new Date(lastSync).getTime()) / 86400000);
  const color =
    days <= 7  ? "text-green-500" :
    days <= 14 ? "text-[#ababab]" :
                 "text-orange-500";
  return (
    <span className={`text-[10px] font-medium ${color}`}>
      {days === 0 ? "sync oggi" : days === 1 ? "sync ieri" : `sync ${days}gg fa`}
    </span>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-[#e8e8e8] p-5 animate-pulse">
          <div className="flex items-start justify-between mb-4">
            <div className="space-y-2">
              <div className="h-3.5 w-32 bg-[#e8e8e8] rounded" />
              <div className="h-2.5 w-20 bg-[#f0f0ef] rounded" />
            </div>
            <div className="h-2.5 w-16 bg-[#f0f0ef] rounded" />
          </div>
          <div className="flex gap-3">
            <div className="h-6 w-28 bg-[#f0f0ef] rounded-full" />
            <div className="h-6 w-24 bg-[#f0f0ef] rounded-full" />
          </div>
          <div className="h-2.5 w-36 bg-[#f0f0ef] rounded mt-4" />
        </div>
      ))}
    </div>
  );
}

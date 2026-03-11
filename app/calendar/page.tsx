"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { ChevronLeft, ChevronRight } from "lucide-react";

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  backlog:    { label: "In lista",     color: "#8f8f8f", bg: "#f5f5f4", border: "#e0e0e0" },
  planned:    { label: "Pianificata",  color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
  brief_done: { label: "Brief pronto", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  written:    { label: "Scritta",      color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  published:  { label: "Pubblicata",   color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
};

type CalendarKeyword = {
  id: string;
  keyword: string;
  status: string;
  planned_month: string;
  client_id: string;
  cluster?: string;
  intent?: string;
  priority?: string;
  clients: { id: string; name: string };
};

function groupByClient(kws: CalendarKeyword[]): Record<string, CalendarKeyword[]> {
  return kws.reduce(
    (acc, kw) => {
      const name = kw.clients.name;
      if (!acc[name]) acc[name] = [];
      acc[name].push(kw);
      return acc;
    },
    {} as Record<string, CalendarKeyword[]>
  );
}

function formatMonthLabel(ym: string): string {
  const [year, mon] = ym.split("-").map(Number);
  return new Date(year, mon - 1, 1).toLocaleDateString("it-IT", {
    month: "long",
    year: "numeric",
  });
}

function KeywordPill({ kw }: { kw: CalendarKeyword }) {
  const sCfg = STATUS_CFG[kw.status ?? "backlog"] ?? STATUS_CFG.backlog;
  return (
    <Link href={`/clients/${kw.clients.id}`}>
      <span
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("keyword_id", kw.id);
        }}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border cursor-pointer hover:opacity-80 transition-opacity"
        style={{
          color: sCfg.color,
          background: sCfg.bg,
          borderColor: sCfg.border,
        }}
      >
        <span className="text-[9px] text-[#ababab]">{kw.clients.name}</span>
        {kw.keyword}
      </span>
    </Link>
  );
}

function MonthDropZone({
  month,
  onDrop,
}: {
  month: Date;
  onDrop: (keywordId: string, month: string) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const monthStr = month.toISOString().substring(0, 7);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        const kwId = e.dataTransfer.getData("keyword_id");
        onDrop(kwId, monthStr);
        setIsDragOver(false);
      }}
      className={`min-h-[60px] rounded-lg border-2 border-dashed p-2 transition-colors ${
        isDragOver
          ? "border-[#1a1a1a] bg-[#f0f0ef]"
          : "border-[#e8e8e8]"
      }`}
    >
      <p className="text-[10px] text-[#ababab] mb-1">
        {month.toLocaleDateString("it-IT", {
          month: "long",
          year: "numeric",
        })}
      </p>
    </div>
  );
}

export default function CalendarPage() {
  const [keywords, setKeywords] = useState<CalendarKeyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"monthly" | "list">("monthly");
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    apiFetch("/api/clients/calendar")
      .then((r) => r.json())
      .then((data) => setKeywords(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const currentMonthKeywords = useMemo(
    () =>
      keywords.filter((kw) => {
        if (!kw.planned_month) return false;
        return kw.planned_month.substring(0, 7) ===
          currentDate.toISOString().substring(0, 7);
      }),
    [keywords, currentDate]
  );

  const dropZoneMonths = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const d = new Date(currentDate);
        d.setMonth(d.getMonth() + i);
        return d;
      }),
    [currentDate]
  );

  const sortedKeywords = useMemo(
    () =>
      [...keywords]
        .filter((kw) => kw.planned_month)
        .sort((a, b) => {
          const cmp = a.planned_month.localeCompare(b.planned_month);
          if (cmp !== 0) return cmp;
          return a.clients.name.localeCompare(b.clients.name);
        }),
    [keywords]
  );

  const keywordsByMonth = useMemo(() => {
    const groups: { month: string; kws: CalendarKeyword[] }[] = [];
    let lastMonth = "";
    for (const kw of sortedKeywords) {
      const m = kw.planned_month.substring(0, 7);
      if (m !== lastMonth) {
        groups.push({ month: m, kws: [] });
        lastMonth = m;
      }
      groups[groups.length - 1].kws.push(kw);
    }
    return groups;
  }, [sortedKeywords]);

  function getClientId(keywordId: string): string {
    return keywords.find((k) => k.id === keywordId)?.client_id ?? "";
  }

  async function handleDrop(keywordId: string, month: string) {
    setKeywords((prev) =>
      prev.map((kw) =>
        kw.id === keywordId ? { ...kw, planned_month: `${month}-01` } : kw
      )
    );
    await apiFetch(
      `/api/clients/${getClientId(keywordId)}/keywords/${keywordId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ planned_month: month }),
      }
    );
  }

  function navigateMonth(direction: number) {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + direction);
      return d;
    });
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[#1a1a1a]">Calendario editoriale</h1>
          <p className="text-[13px] text-[#ababab] mt-0.5">
            Keyword pianificate per mese
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView("monthly")}
            className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
              view === "monthly"
                ? "bg-[#1a1a1a] text-white"
                : "bg-[#f5f5f4] text-[#737373] hover:bg-[#e8e8e8]"
            }`}
          >
            Mensile
          </button>
          <button
            onClick={() => setView("list")}
            className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
              view === "list"
                ? "bg-[#1a1a1a] text-white"
                : "bg-[#f5f5f4] text-[#737373] hover:bg-[#e8e8e8]"
            }`}
          >
            Lista
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-[13px] text-[#ababab]">Caricamento…</p>
      ) : view === "monthly" ? (
        <div>
          {/* Month navigation */}
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-1.5 rounded-md hover:bg-[#f5f5f4] text-[#737373]"
            >
              <ChevronLeft size={16} />
            </button>
            <h2 className="text-[15px] font-semibold text-[#1a1a1a] capitalize">
              {currentDate.toLocaleDateString("it-IT", {
                month: "long",
                year: "numeric",
              })}
            </h2>
            <button
              onClick={() => navigateMonth(1)}
              className="p-1.5 rounded-md hover:bg-[#f5f5f4] text-[#737373]"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Keywords for current month grouped by client */}
          {currentMonthKeywords.length === 0 ? (
            <p className="text-[#ababab] text-[13px]">
              Nessuna keyword pianificata per questo mese.
            </p>
          ) : (
            <div className="flex flex-col gap-6">
              {Object.entries(groupByClient(currentMonthKeywords)).map(
                ([clientName, kws]) => (
                  <div key={clientName}>
                    <p className="text-[11px] font-semibold text-[#555] uppercase tracking-wide mb-3">
                      {clientName}
                      <span className="ml-2 font-normal text-[#ababab]">
                        ({kws.length})
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {kws.map((kw) => (
                        <KeywordPill key={kw.id} kw={kw} />
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {/* Drop zones */}
          <div className="mt-8">
            <p className="text-[11px] font-medium text-[#ababab] uppercase tracking-wide mb-3">
              Sposta keyword in un altro mese
            </p>
            <div className="grid grid-cols-6 gap-2">
              {dropZoneMonths.map((month, i) => (
                <MonthDropZone key={i} month={month} onDrop={handleDrop} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* List view */
        <div>
          {sortedKeywords.length === 0 ? (
            <p className="text-[13px] text-[#ababab]">
              Nessuna keyword con mese pianificato.
            </p>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[#e8e8e8]">
                  <th className="text-left py-2 px-3 text-[10px] text-[#ababab] font-medium uppercase tracking-wide">
                    Mese
                  </th>
                  <th className="text-left py-2 px-3 text-[10px] text-[#ababab] font-medium uppercase tracking-wide">
                    Cliente
                  </th>
                  <th className="text-left py-2 px-3 text-[10px] text-[#ababab] font-medium uppercase tracking-wide">
                    Keyword
                  </th>
                  <th className="text-left py-2 px-3 text-[10px] text-[#ababab] font-medium uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-left py-2 px-3 text-[10px] text-[#ababab] font-medium uppercase tracking-wide">
                    Cluster
                  </th>
                  <th className="text-left py-2 px-3 text-[10px] text-[#ababab] font-medium uppercase tracking-wide">
                    Intent
                  </th>
                  <th className="text-left py-2 px-3 text-[10px] text-[#ababab] font-medium uppercase tracking-wide">
                    Priorità
                  </th>
                </tr>
              </thead>
              <tbody>
                {keywordsByMonth.map(({ month, kws }) =>
                  kws.map((kw, ki) => {
                    const sCfg = STATUS_CFG[kw.status ?? "backlog"] ?? STATUS_CFG.backlog;
                    return (
                      <tr
                        key={kw.id}
                        className="border-b border-[#f5f5f4] hover:bg-[#fafafa]"
                      >
                        <td className="py-2 px-3 text-[#737373]">
                          {ki === 0 ? (
                            <span className="font-medium capitalize text-[#1a1a1a]">
                              {formatMonthLabel(month)}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2 px-3">
                          <Link
                            href={`/clients/${kw.clients.id}`}
                            className="text-[#2563eb] hover:underline"
                          >
                            {kw.clients.name}
                          </Link>
                        </td>
                        <td className="py-2 px-3 text-[#333] font-medium">
                          {kw.keyword}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border"
                            style={{
                              color: sCfg.color,
                              background: sCfg.bg,
                              borderColor: sCfg.border,
                            }}
                          >
                            {sCfg.label}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-[#737373]">
                          {kw.cluster ?? "—"}
                        </td>
                        <td className="py-2 px-3 text-[#737373]">
                          {kw.intent ?? "—"}
                        </td>
                        <td className="py-2 px-3 text-[#737373]">
                          {kw.priority ?? "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

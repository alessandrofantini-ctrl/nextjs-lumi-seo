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

function getCalendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function monthStr(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
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

const DAY_LABELS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

export default function CalendarPage() {
  const [keywords, setKeywords] = useState<CalendarKeyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"monthly" | "list">("monthly");

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed

  useEffect(() => {
    apiFetch("/api/clients/calendar")
      .then((r) => r.json())
      .then((data) => setKeywords(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const currentMonthStr = monthStr(viewYear, viewMonth);

  const currentMonthKeywords = useMemo(
    () => keywords.filter((kw) => kw.planned_month?.startsWith(currentMonthStr)),
    [keywords, currentMonthStr]
  );

  const calendarDays = useMemo(
    () => getCalendarDays(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const dropZoneMonths = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => new Date(viewYear, viewMonth + i, 1)),
    [viewYear, viewMonth]
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

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
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
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-md hover:bg-[#f5f5f4] text-[#737373]"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-[15px] font-semibold text-[#1a1a1a] capitalize min-w-[160px] text-center">
              {formatMonthLabel(currentMonthStr)}
            </span>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded-md hover:bg-[#f5f5f4] text-[#737373]"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* "In questo mese" header */}
          <div className="mb-6">
            <p className="text-[11px] font-medium text-[#ababab] uppercase tracking-wide mb-3">
              {currentMonthKeywords.length} keyword pianificate
            </p>
            {currentMonthKeywords.length === 0 ? (
              <p className="text-[12px] text-[#c0c0c0]">
                Nessuna keyword pianificata per questo mese.
              </p>
            ) : (
              Object.entries(groupByClient(currentMonthKeywords)).map(
                ([clientName, kws]) => (
                  <div key={clientName} className="mb-4">
                    <p className="text-[12px] font-semibold text-[#333] mb-2">
                      {clientName}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {kws.map((kw) => (
                        <KeywordPill key={kw.id} kw={kw} />
                      ))}
                    </div>
                  </div>
                )
              )
            )}
          </div>

          {/* Calendar grid */}
          <div className="mb-8 border border-[#e8e8e8] rounded-lg overflow-hidden">
            <div className="grid grid-cols-7 bg-[#f5f5f4]">
              {DAY_LABELS.map((d) => (
                <div
                  key={d}
                  className="px-2 py-2 text-center text-[10px] font-medium text-[#ababab] uppercase tracking-wide"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {calendarDays.map((day, i) => {
                const isToday =
                  day === today.getDate() &&
                  viewMonth === today.getMonth() &&
                  viewYear === today.getFullYear();
                return (
                  <div
                    key={i}
                    className={`min-h-[52px] border-t border-r border-[#f0f0ef] p-2 ${
                      day === null ? "bg-[#fafafa]" : isToday ? "bg-[#eff6ff]" : "bg-white"
                    }`}
                  >
                    {day !== null && (
                      <span
                        className={`text-[11px] font-medium ${
                          isToday ? "text-[#2563eb]" : "text-[#c0c0c0]"
                        }`}
                      >
                        {day}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Drop zones */}
          <div>
            <p className="text-[11px] font-medium text-[#ababab] uppercase tracking-wide mb-3">
              Sposta keyword — trascina su un mese
            </p>
            <div className="grid grid-cols-6 gap-3">
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

"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import * as XLSX from "xlsx";
import { PageHeader, Section, Label, Select, Btn, Alert } from "@/components/ui";
import { apiFetch } from "@/lib/api";

// ══════════════════════════════════════════════
//  Tipi
// ══════════════════════════════════════════════

type Client = { id: string; name: string };

type ProgressStatus = "waiting" | "processing" | "done" | "error";
type ProgressRow = { keyword: string; status: ProgressStatus; error?: string };

type BriefResult = {
  keyword: string;
  url: string;
  h1: string;
  lunghezza_consigliata: string;
  outline: string;
  faq_domande: string[];
};

type SerpOrganic = { position?: number; title?: string; link?: string; snippet?: string };
type SerpSnapshot = { organic: SerpOrganic[]; paa: string[]; related_searches: string[]; features: string[] };
type AggregatedInsights = { top_h2: string[]; top_terms: string[]; top_questions: string[]; avg_word_count?: number };
type JobResult = { serp_snapshot: SerpSnapshot; aggregated_insights: AggregatedInsights; competitors_analysed: number };

// ══════════════════════════════════════════════
//  Costanti
// ══════════════════════════════════════════════

const MARKETS = [
  "🇮🇹 Italia", "🇺🇸 USA (English)", "🇬🇧 UK",
  "🇪🇸 Spagna", "🇫🇷 Francia", "🇩🇪 Germania",
];
const INTENTS = ["Informativo", "Commerciale", "Navigazionale"];
const COMPETITOR_OPTIONS = [3, 5, 10];
const MAX_KEYWORDS = 20;

// ══════════════════════════════════════════════
//  Icone progress
// ══════════════════════════════════════════════

function StatusIcon({ status }: { status: ProgressStatus }) {
  if (status === "waiting")    return <span className="text-[#ababab]">⏳</span>;
  if (status === "processing") return <span className="animate-pulse">🔄</span>;
  if (status === "done")       return <span>✅</span>;
  return <span>❌</span>;
}

// ══════════════════════════════════════════════
//  Componente principale
// ══════════════════════════════════════════════

export default function BatchBriefPage() {
  const [clients, setClients]         = useState<Client[]>([]);
  const [clientId, setClientId]       = useState("");
  const [rawKeywords, setRawKeywords] = useState("");
  const [urlMap, setUrlMap]           = useState<Record<string, string>>({});
  const [market, setMarket]           = useState("🇮🇹 Italia");
  const [intent, setIntent]           = useState("Informativo");
  const [competitors, setCompetitors] = useState(5);
  const [running, setRunning]         = useState(false);
  const [progress, setProgress]       = useState<ProgressRow[]>([]);
  const [results, setResults]         = useState<BriefResult[]>([]);
  const [clientError, setClientError] = useState(false);

  const cancelledRef  = useRef(false);
  const intervalsRef  = useRef<ReturnType<typeof setInterval>[]>([]);

  useEffect(() => {
    apiFetch("/api/writer/clients")
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data: unknown) => setClients(Array.isArray(data) ? (data as Client[]) : []))
      .catch(() => {});

    return () => {
      intervalsRef.current.forEach(clearInterval);
    };
  }, []);

  const keywords = useMemo(() => {
    return rawKeywords
      .split("\n")
      .map((k) => k.trim())
      .filter((k) => k.length > 0)
      .slice(0, MAX_KEYWORDS);
  }, [rawKeywords]);

  const clientName = useMemo(
    () => clients.find((c) => c.id === clientId)?.name ?? "",
    [clients, clientId]
  );

  const formDisabled = !clientId || running;
  const canGenerate  = !!clientId && keywords.length > 0 && !running;

  function handleUrlChange(kw: string, val: string) {
    setUrlMap((prev) => ({ ...prev, [kw]: val }));
  }

  // ── Polling helper ────────────────────────────
  function pollJob(jobId: string): Promise<JobResult> {
    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        try {
          const r = await apiFetch(`/api/seo/jobs/${jobId}`);
          if (!r.ok) return;
          const job = await r.json() as { status: string; result: JobResult; error?: string };
          if (job.status === "done") {
            clearInterval(interval);
            intervalsRef.current = intervalsRef.current.filter((i) => i !== interval);
            resolve(job.result);
          } else if (job.status === "error") {
            clearInterval(interval);
            intervalsRef.current = intervalsRef.current.filter((i) => i !== interval);
            reject(new Error(job.error ?? "Errore analisi SERP"));
          }
        } catch { /* ignora errori di rete temporanei */ }
      }, 3000);
      intervalsRef.current.push(interval);
    });
  }

  // ── Avvia generazione ─────────────────────────
  async function handleGenerate() {
    if (!clientId) { setClientError(true); return; }
    setClientError(false);
    cancelledRef.current = false;
    setRunning(true);
    setResults([]);
    setProgress(keywords.map((kw) => ({ keyword: kw, status: "waiting" })));

    const accumulated: BriefResult[] = [];

    for (let i = 0; i < keywords.length; i++) {
      if (cancelledRef.current) break;

      const kw  = keywords[i];
      const url = urlMap[kw] ?? "";

      setProgress((prev) =>
        prev.map((r, idx) => idx === i ? { ...r, status: "processing" } : r)
      );

      try {
        // 1 — Avvia analisi SERP
        const analyseRes = await apiFetch("/api/seo/analyse", {
          method: "POST",
          body: JSON.stringify({
            keyword:         kw,
            client_id:       clientId,
            market,
            intent,
            max_competitors: competitors,
            include_schema:  false,
            save_brief:      false,
          }),
        });
        if (!analyseRes.ok) {
          const d = await analyseRes.json() as { detail?: string };
          throw new Error(d.detail ?? "Errore avvio analisi");
        }
        const { job_id } = await analyseRes.json() as { job_id: string };

        // 2 — Polling job
        const jobResult = await pollJob(job_id);

        // 3 — Calcola lunghezza consigliata da avg_word_count dell'analisi
        const avgWc = jobResult.aggregated_insights?.avg_word_count ?? 0;
        const lunghezza = avgWc > 0
          ? `${Math.round(avgWc * 0.9)}–${Math.round(avgWc * 1.1)}`
          : "";

        // 4 — Costruisce serp_context compatto
        const snap = jobResult.serp_snapshot;
        const serpContext = JSON.stringify({
          paa:          snap?.paa?.slice(0, 8) ?? [],
          related:      snap?.related_searches?.slice(0, 8) ?? [],
          top_terms:    jobResult.aggregated_insights?.top_terms?.slice(0, 15) ?? [],
          top_h2:       jobResult.aggregated_insights?.top_h2?.slice(0, 10) ?? [],
        });

        // 5 — Genera H1 + outline + FAQ
        const briefRes = await apiFetch("/api/seo/batch-brief", {
          method: "POST",
          body: JSON.stringify({
            keyword:      kw,
            market,
            intent,
            url:          url || undefined,
            client_id:    clientId,
            serp_context: serpContext,
          }),
        });
        if (!briefRes.ok) {
          const d = await briefRes.json() as { detail?: string };
          throw new Error(d.detail ?? "Errore generazione brief");
        }
        const brief = await briefRes.json() as { h1: string; outline: string; faq_domande: string[] };

        accumulated.push({ keyword: kw, url, h1: brief.h1, lunghezza_consigliata: lunghezza, outline: brief.outline, faq_domande: brief.faq_domande });
        setProgress((prev) =>
          prev.map((r, idx) => idx === i ? { ...r, status: "done" } : r)
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Errore sconosciuto";
        setProgress((prev) =>
          prev.map((r, idx) => idx === i ? { ...r, status: "error", error: msg } : r)
        );
      }
    }

    setResults(accumulated);
    setRunning(false);
  }

  function handleCancel() {
    cancelledRef.current = true;
  }

  // ── Export Excel ──────────────────────────────
  function handleDownload() {
    const rows = results.map((r) => ({
      url:                   r.url,
      query:                 r.keyword,
      h1:                    r.h1,
      lunghezza_consigliata: r.lunghezza_consigliata,
      outline:               r.outline,
      faq_domande:           Array.isArray(r.faq_domande) ? r.faq_domande.join("\n") : "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Brief");

    const now     = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const safeName = clientName.replace(/[^a-z0-9]/gi, "_");
    XLSX.writeFile(wb, `brief_batch_${safeName}_${dateStr}.xlsx`);
  }

  // ── Riepilogo finale ──────────────────────────
  const doneCount  = progress.filter((r) => r.status === "done").length;
  const errorCount = progress.filter((r) => r.status === "error").length;
  const isDone     = progress.length > 0 && !running && (doneCount + errorCount) === progress.length;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Generatore Brief Batch"
        subtitle="Genera un foglio Excel con brief SEO per più keyword contemporaneamente."
      />

      <Section>
        <div className="flex flex-col gap-5 max-w-2xl">

          {/* ── Cliente ── */}
          <div>
            <Label>Cliente *</Label>
            <Select
              value={clientId}
              onChange={(e) => { setClientId(e.target.value); setClientError(false); }}
              disabled={running}
            >
              <option value="">— Seleziona un cliente —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
            {clientError && (
              <p className="mt-1 text-[12px] text-red-500">Seleziona un cliente per continuare.</p>
            )}
          </div>

          {/* ── Keyword textarea ── */}
          <div className={formDisabled && !running ? "opacity-50 pointer-events-none" : ""}>
            <div className="flex items-center justify-between mb-1.5">
              <Label>Keyword (una per riga, max {MAX_KEYWORDS})</Label>
              <span className="text-[11px] text-[#ababab]">{keywords.length}/{MAX_KEYWORDS}</span>
            </div>
            <textarea
              value={rawKeywords}
              onChange={(e) => setRawKeywords(e.target.value)}
              disabled={!clientId || running}
              rows={6}
              placeholder={"impianti elettrici industriali\ninstallazione pannelli solari\nmanutenzione impianti industriali"}
              className="w-full px-3 py-2 rounded-md bg-white border border-[#e8e8e8] text-[#1a1a1a] text-[13px] placeholder:text-[#d0d0d0] focus:outline-none focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1]/20 transition-colors resize-none leading-relaxed font-mono"
            />
          </div>

          {/* ── Tabella URL opzionali ── */}
          {keywords.length > 0 && (
            <div className={!clientId || running ? "opacity-50 pointer-events-none" : ""}>
              <Label>URL pagina esistente (opzionale)</Label>
              <div className="border border-[#e8e8e8] rounded-md overflow-hidden">
                <table className="w-full text-[12px]">
                  <thead className="bg-[#f7f7f6] border-b border-[#e8e8e8]">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-[#737373] w-1/2">Keyword</th>
                      <th className="text-left px-3 py-2 font-medium text-[#737373]">URL pagina (opzionale)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0f0f0]">
                    {keywords.map((kw) => (
                      <tr key={kw}>
                        <td className="px-3 py-2 text-[#555] truncate max-w-[200px]">{kw}</td>
                        <td className="px-3 py-2">
                          <input
                            type="url"
                            value={urlMap[kw] ?? ""}
                            onChange={(e) => handleUrlChange(kw, e.target.value)}
                            disabled={!clientId || running}
                            placeholder="https://..."
                            className="w-full px-2 py-1 rounded border border-[#e8e8e8] text-[12px] text-[#1a1a1a] placeholder:text-[#d0d0d0] focus:outline-none focus:border-[#6366f1] transition-colors"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Mercato + Intento + Competitor ── */}
          <div className={`grid grid-cols-3 gap-4 ${!clientId || running ? "opacity-50 pointer-events-none" : ""}`}>
            <div>
              <Label>Mercato</Label>
              <Select value={market} onChange={(e) => setMarket(e.target.value)} disabled={!clientId || running}>
                {MARKETS.map((m) => <option key={m}>{m}</option>)}
              </Select>
            </div>
            <div>
              <Label>Intento</Label>
              <Select value={intent} onChange={(e) => setIntent(e.target.value)} disabled={!clientId || running}>
                {INTENTS.map((i) => <option key={i}>{i}</option>)}
              </Select>
            </div>
            <div>
              <Label>Competitor analizzati</Label>
              <Select value={competitors} onChange={(e) => setCompetitors(Number(e.target.value))} disabled={!clientId || running}>
                {COMPETITOR_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </div>
          </div>

          {/* ── Bottoni ── */}
          <div className="flex items-center gap-3">
            {!running ? (
              <Btn onClick={handleGenerate} disabled={!canGenerate}>
                Genera Excel
              </Btn>
            ) : (
              <Btn variant="ghost" onClick={handleCancel}>
                Annulla
              </Btn>
            )}
          </div>

          {/* ── Progress ── */}
          {progress.length > 0 && (
            <div className="border border-[#e8e8e8] rounded-lg overflow-hidden">
              <div className="bg-[#f7f7f6] px-4 py-2.5 border-b border-[#e8e8e8]">
                <p className="text-[11px] font-medium text-[#737373] uppercase tracking-wide">
                  Avanzamento generazione
                </p>
              </div>
              <div className="divide-y divide-[#f0f0f0]">
                {progress.map((row) => (
                  <div key={row.keyword} className="flex items-start gap-3 px-4 py-2.5">
                    <StatusIcon status={row.status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] text-[#1a1a1a] truncate font-medium">{row.keyword}</p>
                      {row.status === "processing" && (
                        <p className="text-[11px] text-[#ababab] animate-pulse">In elaborazione…</p>
                      )}
                      {row.status === "error" && row.error && (
                        <p className="text-[11px] text-red-500">{row.error}</p>
                      )}
                    </div>
                    <span className="text-[11px] text-[#ababab] shrink-0">
                      {row.status === "waiting"    ? "In attesa"     : ""}
                      {row.status === "processing" ? "In elaborazione" : ""}
                      {row.status === "done"       ? "Completata"    : ""}
                      {row.status === "error"      ? "Errore"        : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Riepilogo finale + download ── */}
          {isDone && results.length > 0 && (
            <div className="flex flex-col gap-3">
              <Alert type="info">
                {doneCount} keyword completate{errorCount > 0 ? `, ${errorCount} con errore` : ""}.
              </Alert>
              <Btn onClick={handleDownload} className="self-start">
                ⬇ Scarica Excel
              </Btn>
            </div>
          )}

          {isDone && results.length === 0 && (
            <Alert type="warn">
              Nessun brief generato. Controlla i messaggi di errore sopra e riprova.
            </Alert>
          )}

        </div>
      </Section>
    </div>
  );
}

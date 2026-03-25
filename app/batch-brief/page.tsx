"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import { PageHeader, Section, Label, Select, Btn, Alert, Input } from "@/components/ui";
import { apiFetch } from "@/lib/api";

// ══════════════════════════════════════════════
//  Tipi
// ══════════════════════════════════════════════

type Client      = { id: string; name: string };
type InputMode   = "text" | "excel";
type KeywordRow  = { keyword: string; url: string | null };

type ProgressStatus = "waiting" | "processing" | "done" | "error";
type ProgressRow    = { keyword: string; status: ProgressStatus; error?: string };

type BriefResult = {
  keyword: string;
  url:                  string;
  h1:                   string;
  lunghezza_consigliata: string;
  outline:              string;
  faq_domande:          string;
};

type BatchBriefResponse = {
  h1:                    string;
  lunghezza_consigliata: string;
  outline:               string;
  faq_domande:           string;
  avg_wc?:               number;
  target_range?:         string;
  brands_count?:         number;
  filters_count?:        number;
};

// ══════════════════════════════════════════════
//  Costanti
// ══════════════════════════════════════════════

const MARKETS = [
  "🇮🇹 Italia", "🇺🇸 USA (English)", "🇬🇧 UK",
  "🇪🇸 Spagna", "🇫🇷 Francia", "🇩🇪 Germania",
];
const INTENTS          = ["Informativo", "Commerciale", "Navigazionale"];
const COMPETITOR_OPTS  = [3, 5, 10];
const FALLBACK_RANGES  = ["450–750", "550–900", "700–1100"];
const MAX_KEYWORDS     = 20;
const DEBOUNCE_MS      = 400;

// ══════════════════════════════════════════════
//  Parser textarea: "keyword | https://url"
// ══════════════════════════════════════════════

function parseTextarea(raw: string): KeywordRow[] {
  return raw
    .split("\n")
    .slice(0, MAX_KEYWORDS)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const parts = l.split(" | ");
      return { keyword: parts[0].trim(), url: parts[1]?.trim() || null };
    })
    .filter((r) => r.keyword.length > 0);
}

// ══════════════════════════════════════════════
//  Parser Excel: auto-detect colonne
// ══════════════════════════════════════════════

function parseXlsx(file: File): Promise<{ rows: KeywordRow[]; truncated: boolean }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb   = XLSX.read(data, { type: "array" });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const raw  = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });

        if (!raw.length) { resolve({ rows: [], truncated: false }); return; }

        const headers   = Object.keys(raw[0]).map((h) => h.toLowerCase());
        const urlIdx    = headers.findIndex((h) => /url|address|pagina|link/.test(h));
        const queryIdx  = headers.findIndex((h) => /query|keyword|kw/.test(h));

        if (queryIdx === -1) { resolve({ rows: [], truncated: false }); return; }

        const queryKey = Object.keys(raw[0])[queryIdx];
        const urlKey   = urlIdx !== -1 ? Object.keys(raw[0])[urlIdx] : null;

        const all: KeywordRow[] = raw
          .map((r) => ({ keyword: String(r[queryKey] ?? "").trim(), url: urlKey ? String(r[urlKey] ?? "").trim() || null : null }))
          .filter((r) => r.keyword.length > 0);

        const truncated = all.length > MAX_KEYWORDS;
        resolve({ rows: all.slice(0, MAX_KEYWORDS), truncated });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Errore lettura file"));
    reader.readAsArrayBuffer(file);
  });
}

// ══════════════════════════════════════════════
//  StatusIcon
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
  const [clientError, setClientError] = useState(false);

  // ── Input mode ────────────────────────────
  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [rawText, setRawText]     = useState("");
  const [parsedRows, setParsedRows] = useState<KeywordRow[]>([]);
  const [xlsxWarning, setXlsxWarning] = useState(false);
  const [xlsxFileName, setXlsxFileName] = useState("");

  // ── Config ────────────────────────────────
  const [market, setMarket]             = useState("🇮🇹 Italia");
  const [intent, setIntent]             = useState("Informativo");
  const [maxCompetitors, setMaxCompetitors] = useState(5);
  const [marginPct, setMarginPct]       = useState(20);
  const [fallbackRange, setFallbackRange] = useState("550–900");
  const [maxH2, setMaxH2]               = useState(8);
  const [competitorUrls, setCompetitorUrls] = useState("");

  // ── Run state ─────────────────────────────
  const [running, setRunning]   = useState(false);
  const [progress, setProgress] = useState<ProgressRow[]>([]);
  const [results, setResults]   = useState<BriefResult[]>([]);

  const cancelledRef = useRef(false);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Mount: carica clienti ─────────────────
  useEffect(() => {
    apiFetch("/api/writer/clients")
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data: unknown) => setClients(Array.isArray(data) ? (data as Client[]) : []))
      .catch(() => {});
  }, []);

  // ── Debounce parse textarea ───────────────
  useEffect(() => {
    if (inputMode !== "text") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setParsedRows(parseTextarea(rawText));
    }, DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [rawText, inputMode]);

  const clientName = useMemo(
    () => clients.find((c) => c.id === clientId)?.name ?? "",
    [clients, clientId]
  );

  const formDisabled = !clientId || running;
  const canGenerate  = !!clientId && parsedRows.length > 0 && !running;

  // ── Excel import ──────────────────────────
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setXlsxWarning(false);
    setXlsxFileName(file.name);
    try {
      const { rows, truncated } = await parseXlsx(file);
      setParsedRows(rows);
      if (truncated) setXlsxWarning(true);
    } catch {
      setParsedRows([]);
    }
    e.target.value = "";
  }, []);

  // ── Generazione ───────────────────────────
  async function handleGenerate() {
    if (!clientId) { setClientError(true); return; }
    setClientError(false);
    cancelledRef.current = false;
    setRunning(true);
    setResults([]);
    setProgress(parsedRows.map((r) => ({ keyword: r.keyword, status: "waiting" })));

    const accumulated: BriefResult[] = [];
    const priorityUrls = competitorUrls
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    for (let i = 0; i < parsedRows.length; i++) {
      if (cancelledRef.current) break;

      const row = parsedRows[i];

      setProgress((prev) =>
        prev.map((r, idx) => idx === i ? { ...r, status: "processing" } : r)
      );

      try {
        const res = await apiFetch("/api/seo/batch-brief", {
          method: "POST",
          body: JSON.stringify({
            keyword:         row.keyword,
            market,
            intent,
            url:             row.url ?? undefined,
            client_id:       clientId,
            competitor_urls: priorityUrls,
            max_competitors: maxCompetitors,
            margin_pct:      marginPct,
            fallback_range:  fallbackRange,
            max_h2:          maxH2,
          }),
        });

        if (!res.ok) {
          const d = await res.json() as { detail?: string };
          throw new Error(d.detail ?? `HTTP ${res.status}`);
        }

        const brief = await res.json() as BatchBriefResponse;

        accumulated.push({
          keyword:              row.keyword,
          url:                  row.url ?? "",
          h1:                   brief.h1,
          lunghezza_consigliata: brief.lunghezza_consigliata,
          outline:              brief.outline,
          faq_domande:          brief.faq_domande,
        });

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

  // ── Export Excel ──────────────────────────
  function handleDownload() {
    const rows = results.map((r) => ({
      url:                   r.url,
      query:                 r.keyword,
      h1:                    r.h1,
      lunghezza_consigliata: r.lunghezza_consigliata,
      outline:               r.outline,
      faq_domande:           r.faq_domande,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Brief");

    const now      = new Date();
    const dateStr  = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const safeName = clientName.replace(/[^a-z0-9]/gi, "_");
    XLSX.writeFile(wb, `brief_batch_${safeName}_${dateStr}.xlsx`);
  }

  // ── Riepilogo ─────────────────────────────
  const doneCount  = progress.filter((r) => r.status === "done").length;
  const errorCount = progress.filter((r) => r.status === "error").length;
  const isDone     = progress.length > 0 && !running && (doneCount + errorCount) === progress.length;

  const textRowCount = useMemo(() => parseTextarea(rawText).length, [rawText]);

  // ══════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <PageHeader
        title="Generatore Brief Batch"
        subtitle="Genera un foglio Excel con brief SEO per più keyword contemporaneamente."
      />

      <Section>
        <div className="grid grid-cols-[1fr_320px] gap-8 items-start max-w-5xl">

          {/* ══ COLONNA SINISTRA ══ */}
          <div className="flex flex-col gap-5">

            {/* Cliente */}
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

            {/* Input mode toggle */}
            <div className={formDisabled ? "opacity-50 pointer-events-none" : ""}>
              <div className="flex items-center gap-1 mb-3">
                {(["text", "excel"] as InputMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => { setInputMode(mode); setParsedRows([]); setXlsxWarning(false); setXlsxFileName(""); }}
                    className={`px-3 py-1 rounded text-[12px] font-medium transition-colors ${
                      inputMode === mode
                        ? "bg-[#6366f1] text-white"
                        : "bg-[#f5f5f4] text-[#555] hover:bg-[#ebebea]"
                    }`}
                  >
                    {mode === "text" ? "Testo libero" : "Importa Excel"}
                  </button>
                ))}
              </div>

              {inputMode === "text" ? (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label>Keyword (una per riga, max {MAX_KEYWORDS})</Label>
                    <span className="text-[11px] text-[#ababab]">{Math.min(textRowCount, MAX_KEYWORDS)}/{MAX_KEYWORDS}</span>
                  </div>
                  <textarea
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    disabled={!clientId || running}
                    rows={7}
                    className="w-full px-3 py-2 rounded-md bg-white border border-[#e8e8e8] text-[#1a1a1a] text-[13px] placeholder:text-[#d0d0d0] focus:outline-none focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1]/20 transition-colors resize-none leading-relaxed font-mono"
                    placeholder={"cavi elettrici industriali | https://rexel.it/cavi\ninterruttori magnetotermici\nconduttori bt | https://rexel.it/conduttori"}
                  />
                  <p className="mt-1 text-[11px] text-[#c0c0c0]">
                    Formato: <span className="font-mono">keyword | https://url-pagina.it</span> — URL opzionale
                  </p>
                </div>
              ) : (
                <div>
                  <Label>File Excel (.xlsx)</Label>
                  <label className="flex items-center gap-3 px-3 py-2.5 rounded-md border border-dashed border-[#d0d0d0] bg-[#fafaf9] cursor-pointer hover:border-[#6366f1] transition-colors">
                    <span className="text-[13px] text-[#555]">
                      {xlsxFileName ? xlsxFileName : "Scegli file .xlsx…"}
                    </span>
                    <input
                      type="file"
                      accept=".xlsx"
                      onChange={handleFileChange}
                      disabled={!clientId || running}
                      className="sr-only"
                    />
                  </label>
                  <p className="mt-1 text-[11px] text-[#c0c0c0]">
                    Auto-detect colonne: <span className="font-mono">query/keyword/kw</span> e <span className="font-mono">url/address/pagina/link</span>
                  </p>
                  {xlsxWarning && (
                    <div className="mt-2">
                      <Alert type="warn">File contiene più di {MAX_KEYWORDS} righe — importate solo le prime {MAX_KEYWORDS}.</Alert>
                    </div>
                  )}
                </div>
              )}

              {/* Preview tabella */}
              {parsedRows.length > 0 && (
                <div className="mt-3 border border-[#e8e8e8] rounded-md overflow-hidden">
                  <div className="bg-[#f7f7f6] px-3 py-2 border-b border-[#e8e8e8]">
                    <p className="text-[11px] font-medium text-[#737373] uppercase tracking-wide">
                      Anteprima — {parsedRows.length} keyword
                    </p>
                  </div>
                  <table className="w-full text-[12px]">
                    <thead className="bg-[#f7f7f6] border-b border-[#e8e8e8]">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-[#737373] w-1/2">Keyword</th>
                        <th className="text-left px-3 py-2 font-medium text-[#737373]">URL pagina</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0f0f0]">
                      {(inputMode === "excel" ? parsedRows.slice(0, 5) : parsedRows).map((row, idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-1.5 text-[#1a1a1a] truncate max-w-[200px]">{row.keyword}</td>
                          <td className="px-3 py-1.5 text-[#ababab] truncate max-w-[200px] font-mono">
                            {row.url ?? <span className="text-[#d0d0d0]">—</span>}
                          </td>
                        </tr>
                      ))}
                      {inputMode === "excel" && parsedRows.length > 5 && (
                        <tr>
                          <td colSpan={2} className="px-3 py-1.5 text-[11px] text-[#ababab]">
                            + {parsedRows.length - 5} altre…
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Bottoni */}
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

            {/* Progress */}
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
                          <p className="text-[11px] text-[#ababab] animate-pulse">SERP + scraping + GPT-4o…</p>
                        )}
                        {row.status === "error" && row.error && (
                          <p className="text-[11px] text-red-500">{row.error}</p>
                        )}
                      </div>
                      <span className="text-[11px] text-[#ababab] shrink-0 capitalize">
                        {{ waiting: "In attesa", processing: "Elaborazione", done: "Completata", error: "Errore" }[row.status]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Riepilogo finale */}
            {isDone && results.length > 0 && (
              <div className="flex flex-col gap-3">
                <Alert type="info">
                  {doneCount} keyword completate{errorCount > 0 ? `, ${errorCount} con errore` : ""}.
                </Alert>
                <Btn onClick={handleDownload} className="self-start text-base">
                  ⬇ Scarica Excel
                </Btn>
              </div>
            )}
            {isDone && results.length === 0 && (
              <Alert type="warn">Nessun brief generato. Controlla i messaggi di errore sopra.</Alert>
            )}
          </div>

          {/* ══ COLONNA DESTRA — Config ══ */}
          <div className={`flex flex-col gap-4 ${!clientId || running ? "opacity-50 pointer-events-none" : ""}`}>
            <p className="text-[11px] font-medium text-[#737373] uppercase tracking-wide">Configurazione</p>

            <div>
              <Label>Mercato</Label>
              <Select value={market} onChange={(e) => setMarket(e.target.value)} disabled={formDisabled}>
                {MARKETS.map((m) => <option key={m}>{m}</option>)}
              </Select>
            </div>

            <div>
              <Label>Intento</Label>
              <Select value={intent} onChange={(e) => setIntent(e.target.value)} disabled={formDisabled}>
                {INTENTS.map((i) => <option key={i}>{i}</option>)}
              </Select>
            </div>

            <div>
              <Label>Competitor da analizzare</Label>
              <Select value={maxCompetitors} onChange={(e) => setMaxCompetitors(Number(e.target.value))} disabled={formDisabled}>
                {COMPETITOR_OPTS.map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label>Margine % su media competitor</Label>
                <span className="text-[12px] font-medium text-[#6366f1]">{marginPct}%</span>
              </div>
              <input
                type="range"
                min={0} max={60} step={5}
                value={marginPct}
                onChange={(e) => setMarginPct(Number(e.target.value))}
                disabled={formDisabled}
                className="w-full accent-[#6366f1]"
              />
              <p className="mt-0.5 text-[11px] text-[#c0c0c0]">
                Range = avg ± 10% attorno a media + {marginPct}%
              </p>
            </div>

            <div>
              <Label>Range fallback (se no competitor)</Label>
              <Select value={fallbackRange} onChange={(e) => setFallbackRange(e.target.value)} disabled={formDisabled}>
                {FALLBACK_RANGES.map((r) => <option key={r}>{r}</option>)}
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label>Max H2 nell&#39;outline</Label>
                <span className="text-[12px] font-medium text-[#6366f1]">{maxH2}</span>
              </div>
              <input
                type="range"
                min={4} max={10} step={1}
                value={maxH2}
                onChange={(e) => setMaxH2(Number(e.target.value))}
                disabled={formDisabled}
                className="w-full accent-[#6366f1]"
              />
            </div>

            <div>
              <Label>Competitor da includere sempre</Label>
              <textarea
                value={competitorUrls}
                onChange={(e) => setCompetitorUrls(e.target.value)}
                disabled={formDisabled}
                rows={4}
                placeholder={"https://competitor1.it/categoria\nhttps://competitor2.it/sezione"}
                className="w-full px-3 py-2 rounded-md bg-white border border-[#e8e8e8] text-[#1a1a1a] text-[12px] placeholder:text-[#d0d0d0] focus:outline-none focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1]/20 transition-colors resize-none font-mono"
              />
              <p className="mt-0.5 text-[11px] text-[#c0c0c0]">Uno per riga. Prepended alla lista SERP.</p>
            </div>
          </div>

        </div>
      </Section>
    </div>
  );
}

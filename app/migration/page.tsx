"use client";

import { useState, useRef } from "react";
import { Upload, CheckCircle, Circle, ArrowRight, Download } from "lucide-react";
import { PageHeader, Section, Card, Label, Input, Btn, Alert, Badge } from "@/components/ui";
import { apiFetch } from "@/lib/api";

// ── Tipi ────────────────────────────────────────────────────────────────────

type MigrationResult = {
  old_url: string;
  old_title: string;
  old_h1: string;
  old_inlinks: number;
  new_url: string | null;
  new_title: string | null;
  confidence: number;
  match_type: "exact" | "slug" | "gpt" | "no_match";
  reason: string | null;
};

type MigrationStats = {
  total: number;
  matched: number;
  no_match: number;
  stats: { exact: number; slug: number; gpt: number; no_match: number };
};

type FilterType = "all" | "certain" | "review" | "nomatch";

// ── Componente FileDropZone ──────────────────────────────────────────────────

function FileDropZone({
  label,
  file,
  onFile,
}: {
  label: string;
  file: File | null;
  onFile: (f: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  }

  return (
    <div>
      <Label>{label}</Label>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={[
          "flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed cursor-pointer transition-colors",
          dragging
            ? "border-[#999] bg-[#f5f5f4]"
            : file
            ? "border-[#22c55e] bg-green-50"
            : "border-[#d9d9d9] hover:border-[#aaa] bg-[#fafafa]",
        ].join(" ")}
      >
        {file ? (
          <>
            <CheckCircle size={18} className="text-green-500" />
            <span className="text-[12px] text-[#555] text-center break-all">{file.name}</span>
            <span className="text-[11px] text-[#aaa]">{(file.size / 1024).toFixed(0)} KB</span>
          </>
        ) : (
          <>
            <Upload size={18} className="text-[#aaa]" />
            <span className="text-[12px] text-[#8f8f8f]">Trascina CSV o clicca per selezionare</span>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => { if (e.target.files?.[0]) onFile(e.target.files[0]); }}
        />
      </div>
    </div>
  );
}

// ── Badge confidenza ─────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence >= 80) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-green-50 text-green-700 border border-green-200">
        {confidence}%
      </span>
    );
  }
  if (confidence >= 50) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-yellow-50 text-yellow-700 border border-yellow-200">
        {confidence}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-red-50 text-red-600 border border-red-200">
      {confidence > 0 ? `${confidence}%` : "—"}
    </span>
  );
}

// ── Badge tipo match ─────────────────────────────────────────────────────────

function MatchTypeBadge({ type }: { type: MigrationResult["match_type"] }) {
  const map: Record<MigrationResult["match_type"], { label: string; cls: string }> = {
    exact:    { label: "Esatto", cls: "bg-[#f0f0ef] text-[#1a1a1a] border-[#d9d9d9]" },
    slug:     { label: "Slug",   cls: "bg-blue-50 text-blue-700 border-blue-200" },
    gpt:      { label: "GPT",    cls: "bg-purple-50 text-purple-700 border-purple-200" },
    no_match: { label: "Nessuno", cls: "bg-red-50 text-red-500 border-red-200" },
  };
  const { label, cls } = map[type];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${cls}`}>
      {label}
    </span>
  );
}

// ── Step loading ─────────────────────────────────────────────────────────────

function LoadingSteps({ current }: { current: number }) {
  const steps = [
    "CSV caricati e parsati",
    "Matching URL in corso...",
    "Analisi semantica GPT-4o...",
    "Generazione mapping...",
  ];
  return (
    <Card className="p-6">
      <p className="text-[13px] font-medium text-[#1a1a1a] mb-4">Analisi in corso</p>
      <div className="flex flex-col gap-3">
        {steps.map((step, i) => (
          <div key={step} className="flex items-center gap-3">
            {i < current ? (
              <CheckCircle size={16} className="text-green-500 shrink-0" />
            ) : i === current ? (
              <Circle size={16} className="text-[#aaa] shrink-0 animate-pulse" />
            ) : (
              <Circle size={16} className="text-[#e0e0e0] shrink-0" />
            )}
            <span className={`text-[13px] ${i < current ? "text-[#1a1a1a]" : i === current ? "text-[#555] animate-pulse" : "text-[#c0c0c0]"}`}>
              {step}
            </span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-[#c0c0c0] mt-4">
        Può richiedere 1–2 minuti su siti grandi.
      </p>
    </Card>
  );
}

// ── Pagina principale ────────────────────────────────────────────────────────

export default function MigrationPage() {
  const [oldDomain, setOldDomain] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [oldFile, setOldFile] = useState<File | null>(null);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [step, setStep] = useState<"config" | "loading" | "results">("config");
  const [results, setResults] = useState<MigrationResult[]>([]);
  const [stats, setStats] = useState<MigrationStats | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);

  // ── Avvia analisi ──────────────────────────────────────────────────────────

  async function handleAnalyze() {
    if (!oldFile || !newFile || !oldDomain || !newDomain) return;
    setStep("loading");
    setAnalyzing(true);
    setError(null);
    setLoadingStep(0);

    const formData = new FormData();
    formData.append("old_csv", oldFile);
    formData.append("new_csv", newFile);
    formData.append("old_domain", oldDomain);
    formData.append("new_domain", newDomain);

    // Simula avanzamento step durante attesa
    const stepTimer = setInterval(() => {
      setLoadingStep((s) => Math.min(s + 1, 3));
    }, 4000);

    try {
      const r = await apiFetch("/api/migration/analyze", {
        method: "POST",
        body: formData,
        // NON impostare Content-Type — fetch lo imposta automaticamente per FormData
        headers: { "Content-Type": "" } as Record<string, string>,
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.detail || "Errore analisi");
      }
      const data = await r.json();
      setResults(data.results);
      setStats({
        total: data.total,
        matched: data.matched,
        no_match: data.no_match,
        stats: data.stats,
      });
      setStep("results");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Errore analisi");
      setStep("config");
    } finally {
      clearInterval(stepTimer);
      setAnalyzing(false);
    }
  }

  // ── Export CSV ─────────────────────────────────────────────────────────────

  async function handleExport() {
    const r = await apiFetch("/api/migration/export-csv", {
      method: "POST",
      body: JSON.stringify({ results, old_domain: oldDomain, new_domain: newDomain }),
    });
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "migration_mapping.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Filtraggio risultati ───────────────────────────────────────────────────

  const filteredResults = results.filter((r) => {
    if (filter === "all") return true;
    if (filter === "certain") return r.confidence >= 80;
    if (filter === "review") return r.confidence > 0 && r.confidence < 80;
    if (filter === "nomatch") return r.match_type === "no_match";
    return true;
  });

  // ── Confidenza media ───────────────────────────────────────────────────────

  const avgConfidence =
    results.length > 0
      ? Math.round(results.reduce((s, r) => s + r.confidence, 0) / results.length)
      : 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Migrazione Sito"
        subtitle="Analisi redirect 301 tra sito vecchio e nuovo"
      />

      <Section>
        {/* ── Step 1: Configurazione ── */}
        {step === "config" && (
          <div className="flex flex-col gap-6 max-w-2xl">
            {error && <Alert type="error">{error}</Alert>}

            <Card className="p-6">
              <div className="flex flex-col gap-5">
                {/* Domini */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Dominio vecchio</Label>
                    <Input
                      value={oldDomain}
                      onChange={(e) => setOldDomain(e.target.value)}
                      placeholder="https://www.vecchio.it"
                    />
                  </div>
                  <div>
                    <Label>Dominio nuovo</Label>
                    <Input
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value)}
                      placeholder="https://www.nuovo.it"
                    />
                  </div>
                </div>

                {/* Upload CSV */}
                <div className="grid grid-cols-2 gap-4">
                  <FileDropZone
                    label="CSV sito vecchio (Screaming Frog)"
                    file={oldFile}
                    onFile={setOldFile}
                  />
                  <FileDropZone
                    label="CSV sito nuovo (Screaming Frog)"
                    file={newFile}
                    onFile={setNewFile}
                  />
                </div>

                <Btn
                  onClick={handleAnalyze}
                  disabled={!oldFile || !newFile || !oldDomain || !newDomain || analyzing}
                  loading={analyzing}
                >
                  Avvia analisi
                </Btn>
              </div>
            </Card>
          </div>
        )}

        {/* ── Step 2: Analisi in corso ── */}
        {step === "loading" && (
          <div className="max-w-md">
            <LoadingSteps current={loadingStep} />
          </div>
        )}

        {/* ── Step 3: Risultati ── */}
        {step === "results" && stats && (
          <div className="flex flex-col gap-6">
            {/* KPI card */}
            <div className="grid grid-cols-4 gap-4">
              <Card className="p-4">
                <p className="text-[11px] text-[#8f8f8f] uppercase tracking-wide font-medium">Totale pagine</p>
                <p className="text-[26px] font-semibold text-[#1a1a1a] mt-1">{stats.total}</p>
              </Card>
              <Card className="p-4">
                <p className="text-[11px] text-[#8f8f8f] uppercase tracking-wide font-medium">Matched</p>
                <p className="text-[26px] font-semibold text-green-600 mt-1">{stats.matched}</p>
              </Card>
              <Card className="p-4">
                <p className="text-[11px] text-[#8f8f8f] uppercase tracking-wide font-medium">No match</p>
                <p className="text-[26px] font-semibold text-red-500 mt-1">{stats.no_match}</p>
              </Card>
              <Card className="p-4">
                <p className="text-[11px] text-[#8f8f8f] uppercase tracking-wide font-medium">Confidenza media</p>
                <p className="text-[26px] font-semibold text-[#1a1a1a] mt-1">{avgConfidence}%</p>
              </Card>
            </div>

            {/* Filtri + export */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {(
                  [
                    { key: "all",     label: `Tutti (${stats.total})` },
                    { key: "certain", label: `Match certi >80% (${results.filter((r) => r.confidence >= 80).length})` },
                    { key: "review",  label: `Da rivedere <80% (${results.filter((r) => r.confidence > 0 && r.confidence < 80).length})` },
                    { key: "nomatch", label: `No match (${stats.no_match})` },
                  ] as { key: FilterType; label: string }[]
                ).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={[
                      "px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors",
                      filter === key
                        ? "bg-[#1a1a1a] text-white"
                        : "text-[#737373] hover:text-[#1a1a1a] hover:bg-[#f0f0ef]",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Btn variant="ghost" onClick={() => { setStep("config"); setResults([]); setStats(null); }}>
                  Nuova analisi
                </Btn>
                <Btn onClick={handleExport}>
                  <Download size={14} />
                  Esporta CSV
                </Btn>
              </div>
            </div>

            {/* Stats badge row */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#aaa]">Match per tipo:</span>
              <Badge>Esatto: {stats.stats.exact}</Badge>
              <Badge>Slug: {stats.stats.slug}</Badge>
              <Badge>GPT: {stats.stats.gpt}</Badge>
              <Badge>Nessuno: {stats.stats.no_match}</Badge>
            </div>

            {/* Tabella risultati */}
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-[#e8e8e8] bg-[#fafafa]">
                      <th className="text-left px-4 py-3 font-medium text-[#737373] w-[18%]">URL vecchio</th>
                      <th className="text-left px-4 py-3 font-medium text-[#737373] w-[20%]">Title vecchio</th>
                      <th className="px-2 py-3 w-6"></th>
                      <th className="text-left px-4 py-3 font-medium text-[#737373] w-[18%]">URL nuovo</th>
                      <th className="text-left px-4 py-3 font-medium text-[#737373] w-[20%]">Title nuovo</th>
                      <th className="text-left px-4 py-3 font-medium text-[#737373] w-[8%]">Confidenza</th>
                      <th className="text-left px-4 py-3 font-medium text-[#737373] w-[7%]">Tipo</th>
                      <th className="text-left px-4 py-3 font-medium text-[#737373]">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResults.map((r, i) => (
                      <tr
                        key={i}
                        className="border-b border-[#f0f0ef] hover:bg-[#fafafa] transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-[11px] text-[#1a1a1a] break-all">
                          {r.old_url}
                        </td>
                        <td className="px-4 py-3 text-[#555]">{r.old_title || "—"}</td>
                        <td className="px-2 py-3 text-center">
                          <ArrowRight size={13} className="text-[#d0d0d0]" />
                        </td>
                        <td className={`px-4 py-3 font-mono text-[11px] break-all ${r.new_url ? "text-[#1a1a1a]" : "text-[#c0c0c0]"}`}>
                          {r.new_url || "—"}
                        </td>
                        <td className="px-4 py-3 text-[#555]">{r.new_title || "—"}</td>
                        <td className="px-4 py-3">
                          <ConfidenceBadge confidence={r.confidence} />
                        </td>
                        <td className="px-4 py-3">
                          <MatchTypeBadge type={r.match_type} />
                        </td>
                        <td className="px-4 py-3 text-[#8f8f8f] text-[11px]">
                          {r.reason || ""}
                        </td>
                      </tr>
                    ))}
                    {filteredResults.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-[#c0c0c0] text-[13px]">
                          Nessun risultato per il filtro selezionato.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </Section>
    </div>
  );
}

"use client";

import { useState, useRef } from "react";
import { Upload, CheckCircle, Circle, ArrowRight, Download, Plus, X } from "lucide-react";
import { PageHeader, Section, Card, Label, Input, Select, Btn, Alert, Badge } from "@/components/ui";
import { apiFetch } from "@/lib/api";

// ── Tipi ────────────────────────────────────────────────────────────────────

type LanguageMapping = {
  language_code: string;
  label: string;
  source_type: "subdirectory" | "domain";
  source_value: string;
  csv_file?: File;
  destination_type: "subdirectory" | "domain" | "eliminated" | "consolidated";
  destination_value: string;
  target_language_code?: string;
};

type MatchType = "exact" | "slug" | "gpt" | "no_match" | "eliminated" | "consolidated";

type MigrationResult = {
  old_url: string;
  old_title: string;
  old_h1: string;
  old_inlinks: number;
  new_url: string | null;
  new_title: string | null;
  new_domain: string | null;
  confidence: number;
  match_type: MatchType;
  reason: string | null;
  language_code: string | null;
};

type ByLanguageStat = {
  total: number;
  matched: number;
  no_match: number;
  eliminated?: number;
};

type MigrationStats = {
  total: number;
  matched: number;
  no_match: number;
  eliminated: number;
  stats: {
    exact: number;
    slug: number;
    gpt: number;
    no_match: number;
    eliminated: number;
    consolidated: number;
  };
  by_language: Record<string, ByLanguageStat>;
};

type FilterType = "all" | "certain" | "review" | "nomatch";

// ── Utility ──────────────────────────────────────────────────────────────────

function extractHostname(url: string | null): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function emptyLang(): LanguageMapping {
  return {
    language_code: "",
    label: "",
    source_type: "subdirectory",
    source_value: "",
    destination_type: "subdirectory",
    destination_value: "",
  };
}

// ── FileDropZone ─────────────────────────────────────────────────────────────

function FileDropZone({
  label,
  file,
  onFile,
  compact = false,
}: {
  label: string;
  file: File | null;
  onFile: (f: File) => void;
  compact?: boolean;
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
      {label && <Label>{label}</Label>}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={[
          "flex items-center justify-center gap-2 rounded-lg border-2 border-dashed cursor-pointer transition-colors",
          compact ? "p-3" : "flex-col p-6",
          dragging
            ? "border-[#999] bg-[#f5f5f4]"
            : file
            ? "border-[#22c55e] bg-green-50"
            : "border-[#d9d9d9] hover:border-[#aaa] bg-[#fafafa]",
        ].join(" ")}
      >
        {file ? (
          <>
            <CheckCircle size={14} className="text-green-500 shrink-0" />
            <span className="text-[11px] text-[#555] truncate max-w-[200px]">{file.name}</span>
          </>
        ) : (
          <>
            <Upload size={14} className="text-[#aaa] shrink-0" />
            <span className="text-[12px] text-[#8f8f8f]">
              {compact ? "CSV" : "Trascina CSV o clicca per selezionare"}
            </span>
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
  if (confidence >= 80)
    return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-green-50 text-green-700 border border-green-200">{confidence}%</span>;
  if (confidence >= 50)
    return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-yellow-50 text-yellow-700 border border-yellow-200">{confidence}%</span>;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-red-50 text-red-600 border border-red-200">
      {confidence > 0 ? `${confidence}%` : "—"}
    </span>
  );
}

// ── Badge tipo match ─────────────────────────────────────────────────────────

function MatchTypeBadge({ type }: { type: MatchType }) {
  const map: Record<MatchType, { label: string; cls: string }> = {
    exact:       { label: "Esatto",      cls: "bg-[#f0f0ef] text-[#1a1a1a] border-[#d9d9d9]" },
    slug:        { label: "Slug",        cls: "bg-blue-50 text-blue-700 border-blue-200" },
    gpt:         { label: "GPT",         cls: "bg-purple-50 text-purple-700 border-purple-200" },
    no_match:    { label: "Nessuno",     cls: "bg-red-50 text-red-500 border-red-200" },
    eliminated:  { label: "Eliminata",   cls: "bg-red-100 text-red-700 border-red-300" },
    consolidated:{ label: "Consolidata", cls: "bg-orange-50 text-orange-600 border-orange-200" },
  };
  const { label, cls } = map[type] ?? map.no_match;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${cls}`}>
      {label}
    </span>
  );
}

// ── Badge lingua ─────────────────────────────────────────────────────────────

function LangBadge({ code, matchType }: { code: string | null; matchType: MatchType }) {
  if (!code) return <span className="text-[#d0d0d0] text-[11px]">—</span>;
  const cls =
    matchType === "eliminated"
      ? "bg-red-100 text-red-700"
      : matchType === "consolidated"
      ? "bg-orange-50 text-orange-600"
      : "bg-[#f0f0ef] text-[#555]";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide ${cls}`}>
      {code.toUpperCase()}
    </span>
  );
}

// ── Loading steps ────────────────────────────────────────────────────────────

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
      <p className="text-[11px] text-[#c0c0c0] mt-4">Può richiedere 1–2 minuti su siti grandi.</p>
    </Card>
  );
}

// ── Card configurazione lingua ────────────────────────────────────────────────

function LanguageMappingCard({
  lm,
  index,
  otherLanguages,
  onUpdate,
  onRemove,
}: {
  lm: LanguageMapping;
  index: number;
  otherLanguages: { code: string; label: string }[];
  onUpdate: (updates: Partial<LanguageMapping>) => void;
  onRemove: () => void;
}) {
  const needsCsv =
    lm.destination_type === "subdirectory" || lm.destination_type === "domain";

  return (
    <Card className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] font-semibold text-[#1a1a1a]">Lingua {index + 1}</span>
        <button
          onClick={onRemove}
          className="text-[#ccc] hover:text-red-500 transition-colors"
          title="Rimuovi lingua"
        >
          <X size={14} />
        </button>
      </div>

      {/* Codice + Label */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <Label>Codice</Label>
          <Input
            value={lm.language_code}
            onChange={(e) => onUpdate({ language_code: e.target.value.toLowerCase() })}
            placeholder="it"
          />
        </div>
        <div>
          <Label>Label</Label>
          <Input
            value={lm.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            placeholder="Italiano"
          />
        </div>
      </div>

      {/* Struttura sorgente */}
      <div className="mb-3">
        <Label>Struttura sorgente</Label>
        <Select
          value={lm.source_type}
          onChange={(e) => onUpdate({ source_type: e.target.value as LanguageMapping["source_type"] })}
        >
          <option value="subdirectory">Subdirectory (es. /it/)</option>
          <option value="domain">Dominio separato</option>
        </Select>
        <Input
          value={lm.source_value}
          onChange={(e) => onUpdate({ source_value: e.target.value })}
          placeholder={lm.source_type === "subdirectory" ? "/it/" : "https://www.vecchio.com"}
          className="mt-2"
        />
      </div>

      {/* Destinazione */}
      <div className="mb-0">
        <Label>Destinazione</Label>
        <Select
          value={lm.destination_type}
          onChange={(e) =>
            onUpdate({
              destination_type: e.target.value as LanguageMapping["destination_type"],
              destination_value: "",
              target_language_code: undefined,
              csv_file: undefined,
            })
          }
        >
          <option value="subdirectory">Subdirectory (es. /it/)</option>
          <option value="domain">Dominio separato</option>
          <option value="eliminated">Lingua eliminata (nessun redirect)</option>
          <option value="consolidated">Consolidata in altra lingua</option>
        </Select>

        {(lm.destination_type === "subdirectory" || lm.destination_type === "domain") && (
          <div className="mt-2 flex flex-col gap-2">
            <Input
              value={lm.destination_value}
              onChange={(e) => onUpdate({ destination_value: e.target.value })}
              placeholder={lm.destination_type === "subdirectory" ? "/it/" : "https://www.nuovo.com"}
            />
            <FileDropZone
              label=""
              file={lm.csv_file ?? null}
              onFile={(f) => onUpdate({ csv_file: f })}
              compact
            />
          </div>
        )}

        {lm.destination_type === "consolidated" && (
          <Select
            value={lm.target_language_code ?? ""}
            onChange={(e) => onUpdate({ target_language_code: e.target.value })}
            className="mt-2"
          >
            <option value="">— Lingua target —</option>
            {otherLanguages.map((ol) => (
              <option key={ol.code} value={ol.code}>{ol.label || ol.code.toUpperCase()}</option>
            ))}
          </Select>
        )}
      </div>

      {/* Avviso CSV mancante */}
      {needsCsv && !lm.csv_file && (
        <p className="text-[11px] text-[#e08000] mt-2">Carica il CSV Screaming Frog per questa lingua.</p>
      )}
    </Card>
  );
}

// ── Pagina principale ─────────────────────────────────────────────────────────

export default function MigrationPage() {
  // Tipo migrazione
  const [migrationType, setMigrationType] = useState<"simple" | "multilingual">("simple");
  const [languageMappings, setLanguageMappings] = useState<LanguageMapping[]>([]);

  // Campi comuni
  const [oldDomain, setOldDomain] = useState("");
  const [oldFile, setOldFile] = useState<File | null>(null);

  // Solo per migrazione semplice
  const [newDomain, setNewDomain] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);

  // Navigazione step
  const [step, setStep] = useState<"config" | "loading" | "results">("config");
  const [loadingStep, setLoadingStep] = useState(0);

  // Risultati
  const [results, setResults] = useState<MigrationResult[]>([]);
  const [stats, setStats] = useState<MigrationStats | null>(null);

  // Filtri
  const [filter, setFilter] = useState<FilterType>("all");
  const [languageFilter, setLanguageFilter] = useState<string | null>(null);

  // UI state
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Gestione language mappings ─────────────────────────────────────────────

  function addLanguage() {
    setLanguageMappings((prev) => [...prev, emptyLang()]);
  }

  function removeLanguage(index: number) {
    setLanguageMappings((prev) => prev.filter((_, i) => i !== index));
  }

  function updateLanguage(index: number, updates: Partial<LanguageMapping>) {
    setLanguageMappings((prev) =>
      prev.map((lm, i) => (i === index ? { ...lm, ...updates } : lm))
    );
  }

  // ── Validazione ────────────────────────────────────────────────────────────

  function isSimpleValid() {
    return Boolean(oldFile && newFile && oldDomain && newDomain);
  }

  function isMultilingualValid() {
    if (!oldFile || !oldDomain || languageMappings.length === 0) return false;
    for (const lm of languageMappings) {
      if (!lm.language_code || !lm.source_value) return false;
      if (
        (lm.destination_type === "subdirectory" || lm.destination_type === "domain") &&
        (!lm.destination_value || !lm.csv_file)
      )
        return false;
      if (lm.destination_type === "consolidated" && !lm.target_language_code) return false;
    }
    return true;
  }

  const canAnalyze = migrationType === "simple" ? isSimpleValid() : isMultilingualValid();

  // ── Avvia analisi ──────────────────────────────────────────────────────────

  async function handleAnalyze() {
    if (!canAnalyze) return;
    setStep("loading");
    setAnalyzing(true);
    setError(null);
    setLoadingStep(0);
    setLanguageFilter(null);

    const formData = new FormData();
    formData.append("old_csv", oldFile!);

    if (migrationType === "simple") {
      formData.append(
        "config",
        JSON.stringify({ migration_type: "simple", old_domain: oldDomain, new_domain: newDomain })
      );
      formData.append("new_csv_default", newFile!);
    } else {
      formData.append(
        "config",
        JSON.stringify({
          migration_type: "multilingual",
          old_domain: oldDomain,
          language_mappings: languageMappings.map(({ csv_file: _f, ...rest }) => rest),
        })
      );
      languageMappings.forEach((lm) => {
        if (lm.csv_file) {
          formData.append(`new_csv_${lm.language_code}`, lm.csv_file);
        }
      });
    }

    const stepTimer = setInterval(() => {
      setLoadingStep((s) => Math.min(s + 1, 3));
    }, 4000);

    try {
      const r = await apiFetch("/api/migration/analyze", {
        method: "POST",
        body: formData,
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
        eliminated: data.eliminated ?? 0,
        stats: data.stats,
        by_language: data.by_language ?? {},
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
      body: JSON.stringify({
        results,
        old_domain: oldDomain,
        new_domain: newDomain || null,
      }),
    });
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "migration_mapping.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Filtraggio ─────────────────────────────────────────────────────────────

  const filteredResults = results.filter((r) => {
    if (filter === "certain" && r.confidence < 80) return false;
    if (filter === "review" && (r.confidence <= 0 || r.confidence >= 80)) return false;
    if (filter === "nomatch" && r.match_type !== "no_match") return false;
    if (languageFilter !== null && r.language_code !== languageFilter) return false;
    return true;
  });

  const avgConfidence =
    results.length > 0
      ? Math.round(results.reduce((s, r) => s + r.confidence, 0) / results.length)
      : 0;

  const isMultilingual = Object.keys(stats?.by_language ?? {}).length > 0;
  const uniqueLanguages = [...new Set(results.map((r) => r.language_code).filter(Boolean))] as string[];

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
          <div className="flex flex-col gap-6 max-w-3xl">
            {error && <Alert type="error">{error}</Alert>}

            {/* Toggle tipo migrazione */}
            <div className="flex gap-2">
              {(["simple", "multilingual"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setMigrationType(t)}
                  className={[
                    "px-4 py-2 rounded-md text-[12px] font-medium transition-colors border",
                    migrationType === t
                      ? "bg-[#1a1a1a] text-white border-[#1a1a1a]"
                      : "text-[#737373] border-[#e8e8e8] hover:text-[#1a1a1a] hover:bg-[#f0f0ef]",
                  ].join(" ")}
                >
                  {t === "simple" ? "Migrazione semplice" : "Migrazione multilingua"}
                </button>
              ))}
            </div>

            {/* ── Form semplice ── */}
            {migrationType === "simple" && (
              <Card className="p-6">
                <div className="flex flex-col gap-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Dominio vecchio</Label>
                      <Input value={oldDomain} onChange={(e) => setOldDomain(e.target.value)} placeholder="https://www.vecchio.it" />
                    </div>
                    <div>
                      <Label>Dominio nuovo</Label>
                      <Input value={newDomain} onChange={(e) => setNewDomain(e.target.value)} placeholder="https://www.nuovo.it" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FileDropZone label="CSV sito vecchio (Screaming Frog)" file={oldFile} onFile={setOldFile} />
                    <FileDropZone label="CSV sito nuovo (Screaming Frog)" file={newFile} onFile={setNewFile} />
                  </div>
                  <Btn onClick={handleAnalyze} disabled={!canAnalyze || analyzing} loading={analyzing}>
                    Avvia analisi
                  </Btn>
                </div>
              </Card>
            )}

            {/* ── Form multilingua ── */}
            {migrationType === "multilingual" && (
              <div className="flex flex-col gap-4">
                <Card className="p-6">
                  <div className="flex flex-col gap-5">
                    <div>
                      <Label>Dominio vecchio principale</Label>
                      <Input value={oldDomain} onChange={(e) => setOldDomain(e.target.value)} placeholder="https://www.vecchio.it" />
                    </div>
                    <FileDropZone label="CSV sito vecchio (Screaming Frog — tutti gli URL)" file={oldFile} onFile={setOldFile} />
                  </div>
                </Card>

                {/* Lingue */}
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-medium text-[#1a1a1a]">
                    Lingue configurate ({languageMappings.length})
                  </p>
                  <Btn variant="ghost" onClick={addLanguage}>
                    <Plus size={14} />
                    Aggiungi lingua
                  </Btn>
                </div>

                {languageMappings.length === 0 && (
                  <p className="text-[12px] text-[#aaa] text-center py-4">
                    Aggiungi almeno una lingua per configurare il mapping.
                  </p>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {languageMappings.map((lm, idx) => (
                    <LanguageMappingCard
                      key={idx}
                      lm={lm}
                      index={idx}
                      otherLanguages={languageMappings
                        .filter((_, i) => i !== idx)
                        .map((m) => ({ code: m.language_code, label: m.label }))}
                      onUpdate={(updates) => updateLanguage(idx, updates)}
                      onRemove={() => removeLanguage(idx)}
                    />
                  ))}
                </div>

                <Btn onClick={handleAnalyze} disabled={!canAnalyze || analyzing} loading={analyzing}>
                  Avvia analisi
                </Btn>
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Loading ── */}
        {step === "loading" && (
          <div className="max-w-md">
            <LoadingSteps current={loadingStep} />
          </div>
        )}

        {/* ── Step 3: Risultati ── */}
        {step === "results" && stats && (
          <div className="flex flex-col gap-6">
            {/* KPI cards */}
            <div className={`grid gap-4 ${stats.eliminated > 0 ? "grid-cols-5" : "grid-cols-4"}`}>
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
              {stats.eliminated > 0 && (
                <Card className="p-4">
                  <p className="text-[11px] text-[#8f8f8f] uppercase tracking-wide font-medium">Eliminate</p>
                  <p className="text-[26px] font-semibold text-red-600 mt-1">{stats.eliminated}</p>
                </Card>
              )}
              <Card className="p-4">
                <p className="text-[11px] text-[#8f8f8f] uppercase tracking-wide font-medium">Confidenza media</p>
                <p className="text-[26px] font-semibold text-[#1a1a1a] mt-1">{avgConfidence}%</p>
              </Card>
            </div>

            {/* Riepilogo per lingua (solo multilingual) */}
            {isMultilingual && (
              <div className="flex flex-wrap gap-3 px-1">
                {Object.entries(stats.by_language).map(([lang, ls]) => (
                  <div key={lang} className="flex items-center gap-1.5 text-[12px] text-[#555]">
                    <span className="font-semibold text-[10px] bg-[#f0f0ef] px-1.5 py-0.5 rounded tracking-wide">
                      {lang.toUpperCase()}
                    </span>
                    {ls.eliminated != null && ls.eliminated > 0 ? (
                      <span className="text-red-500">{ls.eliminated} eliminate</span>
                    ) : (
                      <span>{ls.matched}/{ls.total} matched</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Filtri + azioni */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                {(
                  [
                    { key: "all",     label: `Tutti (${stats.total})` },
                    { key: "certain", label: `Certi >80% (${results.filter((r) => r.confidence >= 80).length})` },
                    { key: "review",  label: `Da rivedere (${results.filter((r) => r.confidence > 0 && r.confidence < 80).length})` },
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
                <Btn
                  variant="ghost"
                  onClick={() => { setStep("config"); setResults([]); setStats(null); setLanguageFilter(null); }}
                >
                  Nuova analisi
                </Btn>
                <Btn onClick={handleExport}>
                  <Download size={14} />
                  Esporta CSV
                </Btn>
              </div>
            </div>

            {/* Filtro lingua (solo multilingual) */}
            {isMultilingual && uniqueLanguages.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-[#aaa] mr-1">Lingua:</span>
                <button
                  onClick={() => setLanguageFilter(null)}
                  className={[
                    "px-2.5 py-1 rounded text-[11px] font-medium transition-colors",
                    languageFilter === null
                      ? "bg-[#1a1a1a] text-white"
                      : "text-[#737373] hover:bg-[#f0f0ef]",
                  ].join(" ")}
                >
                  Tutte
                </button>
                {uniqueLanguages.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setLanguageFilter(lang === languageFilter ? null : lang)}
                    className={[
                      "px-2.5 py-1 rounded text-[11px] font-medium transition-colors",
                      languageFilter === lang
                        ? "bg-[#1a1a1a] text-white"
                        : "text-[#737373] hover:bg-[#f0f0ef]",
                    ].join(" ")}
                  >
                    {lang.toUpperCase()}
                  </button>
                ))}
              </div>
            )}

            {/* Stats badge row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-[#aaa]">Match per tipo:</span>
              <Badge>Esatto: {stats.stats.exact}</Badge>
              <Badge>Slug: {stats.stats.slug}</Badge>
              <Badge>GPT: {stats.stats.gpt}</Badge>
              {stats.stats.consolidated > 0 && <Badge>Consolidato: {stats.stats.consolidated}</Badge>}
              <Badge>Nessuno: {stats.stats.no_match}</Badge>
              {stats.stats.eliminated > 0 && <Badge>Eliminato: {stats.stats.eliminated}</Badge>}
            </div>

            {/* Tabella risultati */}
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-[#e8e8e8] bg-[#fafafa]">
                      <th className="text-left px-3 py-3 font-medium text-[#737373]">URL vecchio</th>
                      {isMultilingual && (
                        <th className="text-left px-3 py-3 font-medium text-[#737373] w-[5%]">Lingua</th>
                      )}
                      <th className="text-left px-3 py-3 font-medium text-[#737373] w-[18%]">Title vecchio</th>
                      <th className="px-2 py-3 w-5"></th>
                      <th className="text-left px-3 py-3 font-medium text-[#737373]">URL nuovo</th>
                      {isMultilingual && (
                        <th className="text-left px-3 py-3 font-medium text-[#737373] w-[8%]">Dominio</th>
                      )}
                      <th className="text-left px-3 py-3 font-medium text-[#737373] w-[18%]">Title nuovo</th>
                      <th className="text-left px-3 py-3 font-medium text-[#737373] w-[8%]">Confidenza</th>
                      <th className="text-left px-3 py-3 font-medium text-[#737373] w-[9%]">Tipo</th>
                      <th className="text-left px-3 py-3 font-medium text-[#737373]">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResults.map((r, i) => (
                      <tr key={i} className="border-b border-[#f0f0ef] hover:bg-[#fafafa] transition-colors">
                        <td className="px-3 py-3 font-mono text-[11px] text-[#1a1a1a] break-all max-w-[180px]">
                          {r.old_url}
                        </td>
                        {isMultilingual && (
                          <td className="px-3 py-3">
                            <LangBadge code={r.language_code} matchType={r.match_type} />
                          </td>
                        )}
                        <td className="px-3 py-3 text-[#555] max-w-[160px] truncate">{r.old_title || "—"}</td>
                        <td className="px-2 py-3 text-center">
                          <ArrowRight size={12} className="text-[#d0d0d0]" />
                        </td>
                        <td className={`px-3 py-3 font-mono text-[11px] break-all max-w-[180px] ${r.new_url ? "text-[#1a1a1a]" : "text-[#c0c0c0]"}`}>
                          {r.new_url || "—"}
                        </td>
                        {isMultilingual && (
                          <td className="px-3 py-3 text-[11px] text-[#8f8f8f]">
                            {extractHostname(r.new_domain)}
                          </td>
                        )}
                        <td className="px-3 py-3 text-[#555] max-w-[160px] truncate">{r.new_title || "—"}</td>
                        <td className="px-3 py-3">
                          <ConfidenceBadge confidence={r.confidence} />
                        </td>
                        <td className="px-3 py-3">
                          <MatchTypeBadge type={r.match_type} />
                        </td>
                        <td className="px-3 py-3 text-[#8f8f8f] text-[11px] max-w-[150px]">
                          {r.reason || ""}
                        </td>
                      </tr>
                    ))}
                    {filteredResults.length === 0 && (
                      <tr>
                        <td
                          colSpan={isMultilingual ? 10 : 8}
                          className="px-4 py-8 text-center text-[#c0c0c0] text-[13px]"
                        >
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

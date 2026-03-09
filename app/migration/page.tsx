"use client";

import { useState, useRef } from "react";
import {
  Upload, CheckCircle, Circle, ArrowRight, Download,
  Plus, X, ChevronDown,
} from "lucide-react";
import { PageHeader, Section, Card, Label, Input, Select, Btn, Alert, Badge } from "@/components/ui";
import { apiFetch, apiFetchForm } from "@/lib/api";

// ── Tipi ────────────────────────────────────────────────────────────────────

type NewDomain = {
  id: string;          // uuid locale (React key + FormData key)
  domain: string;      // es. https://www.nuovo.it
  label: string;       // es. "Italia" (opzionale ma presente come stringa vuota)
  csv_file: File | null;
};

type LanguageRule = {
  id: string;
  pattern: string;                                         // es. "/en/" o "vecchio.com"
  pattern_type: "subdirectory" | "domain";
  target_domain_id: string;                               // id del NewDomain destinazione
  behavior: "redirect" | "eliminated" | "consolidated";
  consolidated_target_domain_id?: string;
};

type MatchType = "exact" | "slug" | "gpt" | "no_match" | "eliminated" | "consolidated";

type MigrationResult = {
  old_url: string;
  old_title: string;
  old_h1: string;
  old_inlinks: number;
  new_url: string | null;
  new_title: string | null;
  target_domain: string | null;
  target_label: string | null;
  confidence: number;
  match_type: MatchType;
  reason: string | null;
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
};

type FilterType = "all" | "certain" | "review" | "nomatch";

// ── Utility ──────────────────────────────────────────────────────────────────

function genId(): string {
  return crypto.randomUUID();
}

function emptyDomain(): NewDomain {
  return { id: genId(), domain: "", label: "", csv_file: null };
}

function emptyRule(): LanguageRule {
  return {
    id: genId(),
    pattern: "",
    pattern_type: "subdirectory",
    target_domain_id: "",
    behavior: "redirect",
  };
}

function extractHostname(url: string | null): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// ── FileDropZone ─────────────────────────────────────────────────────────────

function FileDropZone({
  label,
  hint,
  file,
  onFile,
  compact = false,
}: {
  label?: string;
  hint?: string;
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
      {hint && <p className="text-[11px] text-[#aaa] mb-1.5">{hint}</p>}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={[
          "flex items-center justify-center gap-2 rounded-lg border-2 border-dashed cursor-pointer transition-colors",
          compact ? "p-3" : "flex-col p-5",
          dragging ? "border-[#999] bg-[#f5f5f4]"
            : file ? "border-[#22c55e] bg-green-50"
            : "border-[#d9d9d9] hover:border-[#aaa] bg-[#fafafa]",
        ].join(" ")}
      >
        {file ? (
          <>
            <CheckCircle size={14} className="text-green-500 shrink-0" />
            <span className="text-[11px] text-[#555] truncate max-w-[260px]">{file.name}</span>
            <span className="text-[10px] text-[#aaa]">{(file.size / 1024).toFixed(0)} KB</span>
          </>
        ) : (
          <>
            <Upload size={14} className="text-[#aaa] shrink-0" />
            <span className="text-[12px] text-[#8f8f8f]">
              {compact ? "Carica CSV" : "Trascina CSV o clicca per selezionare"}
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
    exact:        { label: "Esatto",      cls: "bg-[#f0f0ef] text-[#1a1a1a] border-[#d9d9d9]" },
    slug:         { label: "Slug",        cls: "bg-blue-50 text-blue-700 border-blue-200" },
    gpt:          { label: "GPT",         cls: "bg-purple-50 text-purple-700 border-purple-200" },
    no_match:     { label: "Nessuno",     cls: "bg-red-50 text-red-500 border-red-200" },
    eliminated:   { label: "Eliminata",   cls: "bg-red-100 text-red-700 border-red-300" },
    consolidated: { label: "Consolidata", cls: "bg-orange-50 text-orange-600 border-orange-200" },
  };
  const { label, cls } = map[type] ?? map.no_match;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${cls}`}>
      {label}
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

// ── Pagina principale ─────────────────────────────────────────────────────────

export default function MigrationPage() {
  // ── Config
  const [oldDomain, setOldDomain] = useState("");
  const [oldFile, setOldFile] = useState<File | null>(null);
  const [newDomains, setNewDomains] = useState<NewDomain[]>([]);
  const [languageRules, setLanguageRules] = useState<LanguageRule[]>([]);
  const [rulesOpen, setRulesOpen] = useState(false);

  // ── Navigazione step
  const [step, setStep] = useState<"config" | "loading" | "results">("config");
  const [loadingStep, setLoadingStep] = useState(0);

  // ── Risultati
  const [results, setResults] = useState<MigrationResult[]>([]);
  const [stats, setStats] = useState<MigrationStats | null>(null);

  // ── Filtri
  const [filter, setFilter] = useState<FilterType>("all");
  const [domainFilter, setDomainFilter] = useState<string | null>(null);

  // ── UI
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Gestione newDomains ────────────────────────────────────────────────────

  function addDomain() {
    setNewDomains((prev) => [...prev, emptyDomain()]);
  }

  function removeDomain(id: string) {
    setNewDomains((prev) => prev.filter((d) => d.id !== id));
    // Rimuovi regole che puntano a questo dominio
    setLanguageRules((prev) =>
      prev.filter((r) => r.target_domain_id !== id && r.consolidated_target_domain_id !== id)
    );
  }

  function updateDomain(id: string, updates: Partial<NewDomain>) {
    setNewDomains((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)));
  }

  // ── Gestione languageRules ─────────────────────────────────────────────────

  function addRule() {
    setLanguageRules((prev) => [...prev, emptyRule()]);
  }

  function removeRule(id: string) {
    setLanguageRules((prev) => prev.filter((r) => r.id !== id));
  }

  function updateRule(id: string, updates: Partial<LanguageRule>) {
    setLanguageRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  }

  // ── Validazione ────────────────────────────────────────────────────────────

  const canAnalyze =
    Boolean(oldDomain) &&
    Boolean(oldFile) &&
    newDomains.length > 0 &&
    newDomains.every((d) => d.domain && d.csv_file);

  // ── Avvia analisi ──────────────────────────────────────────────────────────

  async function handleAnalyze() {
    if (!canAnalyze) return;
    setStep("loading");
    setAnalyzing(true);
    setError(null);
    setLoadingStep(0);
    setDomainFilter(null);

    const formData = new FormData();
    formData.append("old_csv", oldFile!);
    formData.append(
      "config",
      JSON.stringify({
        old_domain: oldDomain,
        new_domains: newDomains.map(({ csv_file: _f, ...rest }) => rest),
        language_rules: languageRules.map(({ id: _id, ...rest }) => rest),
      })
    );
    newDomains.forEach((nd) => {
      if (nd.csv_file) formData.append(`new_csv_${nd.id}`, nd.csv_file);
    });

    const stepTimer = setInterval(() => {
      setLoadingStep((s) => Math.min(s + 1, 3));
    }, 4000);

    try {
      const r = await apiFetchForm("/api/migration/analyze", formData);
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
      body: JSON.stringify({ results, old_domain: oldDomain }),
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
    if (domainFilter !== null && r.target_domain !== domainFilter) return false;
    return true;
  });

  const avgConfidence =
    results.length > 0
      ? Math.round(results.reduce((s, r) => s + r.confidence, 0) / results.length)
      : 0;

  const uniqueTargetDomains = [...new Set(
    results.map((r) => r.target_domain).filter((d): d is string => d !== null)
  )];
  const showDomainFilter = uniqueTargetDomains.length > 1;

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
          <div className="flex flex-col gap-6 max-w-5xl">
            {error && <Alert type="error">{error}</Alert>}

            {/* Due colonne: sito vecchio | sito nuovo */}
            <div className="grid grid-cols-2 gap-6">

              {/* ── Sito vecchio ── */}
              <Card className="p-5 flex flex-col gap-5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold tracking-widest uppercase px-2 py-0.5 rounded bg-[#f0f0ef] text-[#555]">
                    SITO VECCHIO
                  </span>
                </div>
                <div>
                  <Label>Dominio vecchio</Label>
                  <Input
                    value={oldDomain}
                    onChange={(e) => setOldDomain(e.target.value)}
                    placeholder="https://www.vecchio.it"
                  />
                </div>
                <FileDropZone
                  label="CSV Screaming Frog — tutti gli URL del sito vecchio"
                  hint="Esporta da Screaming Frog includendo tutti i domini/lingue"
                  file={oldFile}
                  onFile={setOldFile}
                />
              </Card>

              {/* ── Sito nuovo ── */}
              <Card className="p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold tracking-widest uppercase px-2 py-0.5 rounded bg-green-100 text-green-700">
                    SITO NUOVO
                  </span>
                </div>

                {newDomains.length === 0 && (
                  <p className="text-[12px] text-[#aaa] text-center py-3">
                    Aggiungi almeno un dominio nuovo.
                  </p>
                )}

                <div className="flex flex-col gap-3">
                  {newDomains.map((nd, idx) => (
                    <div
                      key={nd.id}
                      className="p-3.5 rounded-lg border border-[#e8e8e8] bg-[#fafafa] flex flex-col gap-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-[#555]">
                          Dominio {idx + 1}
                        </span>
                        <button
                          onClick={() => removeDomain(nd.id)}
                          className="text-[#ccc] hover:text-red-500 transition-colors"
                          title="Rimuovi dominio"
                        >
                          <X size={13} />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>Dominio</Label>
                          <Input
                            value={nd.domain}
                            onChange={(e) => updateDomain(nd.id, { domain: e.target.value })}
                            placeholder="https://www.nuovo.it"
                          />
                        </div>
                        <div>
                          <Label>Label (opzionale)</Label>
                          <Input
                            value={nd.label}
                            onChange={(e) => updateDomain(nd.id, { label: e.target.value })}
                            placeholder="Italia"
                          />
                        </div>
                      </div>
                      <FileDropZone
                        file={nd.csv_file}
                        onFile={(f) => updateDomain(nd.id, { csv_file: f })}
                        compact
                      />
                    </div>
                  ))}
                </div>

                <button
                  onClick={addDomain}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-dashed border-[#d0d0d0] text-[12px] text-[#737373] hover:text-[#1a1a1a] hover:border-[#999] transition-colors"
                >
                  <Plus size={13} />
                  Aggiungi dominio nuovo
                </button>
              </Card>
            </div>

            {/* ── Accordion mappatura lingue ── */}
            <div className="rounded-xl border border-[#e8e8e8] overflow-hidden">
              <button
                onClick={() => setRulesOpen(!rulesOpen)}
                className="w-full flex items-center justify-between px-5 py-3.5 bg-[#fafafa] hover:bg-[#f0f0ef] transition-colors text-left"
              >
                <div>
                  <span className="text-[13px] font-medium text-[#1a1a1a]">
                    Configura mappatura lingue
                  </span>
                  <span className="ml-2 text-[12px] text-[#aaa]">opzionale</span>
                  {languageRules.length > 0 && (
                    <span className="ml-2 text-[11px] font-medium text-[#555] bg-[#e8e8e8] px-1.5 py-0.5 rounded">
                      {languageRules.length} {languageRules.length === 1 ? "regola" : "regole"}
                    </span>
                  )}
                </div>
                <ChevronDown
                  size={15}
                  className={`text-[#aaa] transition-transform ${rulesOpen ? "rotate-180" : ""}`}
                />
              </button>

              {rulesOpen && (
                <div className="p-5 border-t border-[#e8e8e8] flex flex-col gap-4">
                  <p className="text-[12px] text-[#737373]">
                    Configura solo se il sito vecchio ha più lingue da distribuire su domini diversi.
                    Se non configurata, il tool cerca il match migliore su tutti i domini nuovo.
                  </p>

                  {languageRules.length === 0 && (
                    <p className="text-[12px] text-[#aaa] text-center py-2">
                      Nessuna regola configurata.
                    </p>
                  )}

                  <div className="flex flex-col gap-2">
                    {languageRules.map((rule) => (
                      <div
                        key={rule.id}
                        className="flex items-start gap-2 p-3 rounded-lg border border-[#e8e8e8] bg-[#fafafa] flex-wrap"
                      >
                        {/* Tipo pattern */}
                        <div className="w-36">
                          <Label>Tipo pattern</Label>
                          <Select
                            value={rule.pattern_type}
                            onChange={(e) =>
                              updateRule(rule.id, {
                                pattern_type: e.target.value as LanguageRule["pattern_type"],
                              })
                            }
                          >
                            <option value="subdirectory">Subdirectory</option>
                            <option value="domain">Dominio</option>
                          </Select>
                        </div>

                        {/* Pattern */}
                        <div className="w-36">
                          <Label>Pattern</Label>
                          <Input
                            value={rule.pattern}
                            onChange={(e) => updateRule(rule.id, { pattern: e.target.value })}
                            placeholder={rule.pattern_type === "subdirectory" ? "/en/" : "vecchio.com"}
                          />
                        </div>

                        {/* Dominio destinazione */}
                        <div className="w-40">
                          <Label>Dominio nuovo</Label>
                          <Select
                            value={rule.target_domain_id}
                            onChange={(e) =>
                              updateRule(rule.id, { target_domain_id: e.target.value })
                            }
                          >
                            <option value="">— Seleziona —</option>
                            {newDomains.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.label || extractHostname(d.domain) || d.id.slice(0, 8)}
                              </option>
                            ))}
                          </Select>
                        </div>

                        {/* Comportamento */}
                        <div className="w-40">
                          <Label>Comportamento</Label>
                          <Select
                            value={rule.behavior}
                            onChange={(e) =>
                              updateRule(rule.id, {
                                behavior: e.target.value as LanguageRule["behavior"],
                                consolidated_target_domain_id: undefined,
                              })
                            }
                          >
                            <option value="redirect">Redirect normale</option>
                            <option value="eliminated">Lingua eliminata</option>
                            <option value="consolidated">Consolidata</option>
                          </Select>
                        </div>

                        {/* Destinazione consolidamento */}
                        {rule.behavior === "consolidated" && (
                          <div className="w-40">
                            <Label>Verso dominio</Label>
                            <Select
                              value={rule.consolidated_target_domain_id ?? ""}
                              onChange={(e) =>
                                updateRule(rule.id, {
                                  consolidated_target_domain_id: e.target.value,
                                })
                              }
                            >
                              <option value="">— Seleziona —</option>
                              {newDomains.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.label || extractHostname(d.domain) || d.id.slice(0, 8)}
                                </option>
                              ))}
                            </Select>
                          </div>
                        )}

                        {/* Rimuovi */}
                        <div className="flex items-end pb-0.5">
                          <button
                            onClick={() => removeRule(rule.id)}
                            className="text-[#ccc] hover:text-red-500 transition-colors p-1"
                            title="Rimuovi regola"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={addRule}
                    disabled={newDomains.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-dashed border-[#d0d0d0] text-[12px] text-[#737373] hover:text-[#1a1a1a] hover:border-[#999] transition-colors disabled:opacity-40 disabled:cursor-not-allowed self-start"
                  >
                    <Plus size={12} />
                    Aggiungi regola
                  </button>
                </div>
              )}
            </div>

            <Btn onClick={handleAnalyze} disabled={!canAnalyze || analyzing} loading={analyzing}>
              Avvia analisi
            </Btn>
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

            {/* Filtri principali + azioni */}
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
                  onClick={() => {
                    setStep("config");
                    setResults([]);
                    setStats(null);
                    setDomainFilter(null);
                  }}
                >
                  Nuova analisi
                </Btn>
                <Btn onClick={handleExport}>
                  <Download size={14} />
                  Esporta CSV
                </Btn>
              </div>
            </div>

            {/* Filtro per dominio */}
            {showDomainFilter && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-[#aaa] mr-1">Dominio:</span>
                <button
                  onClick={() => setDomainFilter(null)}
                  className={[
                    "px-2.5 py-1 rounded text-[11px] font-medium transition-colors",
                    domainFilter === null ? "bg-[#1a1a1a] text-white" : "text-[#737373] hover:bg-[#f0f0ef]",
                  ].join(" ")}
                >
                  Tutti
                </button>
                {uniqueTargetDomains.map((d) => {
                  const label = results.find((r) => r.target_domain === d)?.target_label;
                  return (
                    <button
                      key={d}
                      onClick={() => setDomainFilter(d === domainFilter ? null : d)}
                      className={[
                        "px-2.5 py-1 rounded text-[11px] font-medium transition-colors",
                        domainFilter === d ? "bg-[#1a1a1a] text-white" : "text-[#737373] hover:bg-[#f0f0ef]",
                      ].join(" ")}
                    >
                      {label || extractHostname(d)}
                    </button>
                  );
                })}
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
                      <th className="text-left px-3 py-3 font-medium text-[#737373] w-[17%]">Title vecchio</th>
                      <th className="px-2 py-3 w-5"></th>
                      <th className="text-left px-3 py-3 font-medium text-[#737373]">URL nuovo</th>
                      {showDomainFilter && (
                        <th className="text-left px-3 py-3 font-medium text-[#737373] w-[9%]">Dominio</th>
                      )}
                      <th className="text-left px-3 py-3 font-medium text-[#737373] w-[17%]">Title nuovo</th>
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
                        <td className="px-3 py-3 text-[#555] max-w-[160px] truncate">{r.old_title || "—"}</td>
                        <td className="px-2 py-3 text-center">
                          <ArrowRight size={12} className="text-[#d0d0d0]" />
                        </td>
                        <td className={`px-3 py-3 font-mono text-[11px] break-all max-w-[180px] ${r.new_url ? "text-[#1a1a1a]" : "text-[#c0c0c0]"}`}>
                          {r.new_url || "—"}
                        </td>
                        {showDomainFilter && (
                          <td className="px-3 py-3 text-[11px] text-[#8f8f8f] max-w-[100px] truncate">
                            {r.target_label || extractHostname(r.target_domain)}
                          </td>
                        )}
                        <td className="px-3 py-3 text-[#555] max-w-[160px] truncate">{r.new_title || "—"}</td>
                        <td className="px-3 py-3"><ConfidenceBadge confidence={r.confidence} /></td>
                        <td className="px-3 py-3"><MatchTypeBadge type={r.match_type} /></td>
                        <td className="px-3 py-3 text-[#8f8f8f] text-[11px] max-w-[150px]">
                          {r.reason || ""}
                        </td>
                      </tr>
                    ))}
                    {filteredResults.length === 0 && (
                      <tr>
                        <td
                          colSpan={showDomainFilter ? 9 : 8}
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

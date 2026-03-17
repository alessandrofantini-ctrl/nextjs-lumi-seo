"use client";

import { useState, useRef, useCallback } from "react";
import { PageHeader, Section, Btn, Alert } from "@/components/ui";
import { apiFetch } from "@/lib/api";

// ── Tipi ─────────────────────────────────────────────────────────────────────

type ParsedPage = {
  page: string;
  url: string;
  content: string;
};

type MetaPage = {
  page: string;
  url: string;
  title: string;
  description: string;
  regenerating?: boolean;
};

type Step = "upload" | "preview" | "results";

// ── Helpers ───────────────────────────────────────────────────────────────────

function charColor(len: number, min: number, max: number, warnMin: number, warnMax: number): string {
  if (len >= min && len <= max) return "#16a34a";
  if (len >= warnMin && len <= warnMax) return "#d97706";
  return "#dc2626";
}

function titleColor(len: number)  { return charColor(len, 50, 60, 40, 70); }
function descColor(len: number)   { return charColor(len, 140, 160, 120, 180); }

// ── Pagina ────────────────────────────────────────────────────────────────────

export default function MetaPage() {
  const [step, setStep]           = useState<Step>("upload");
  const [file, setFile]           = useState<File | null>(null);
  const [dragging, setDragging]   = useState(false);
  const [parsing, setParsing]     = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [parsed, setParsed]       = useState<ParsedPage[]>([]);
  const [metas, setMetas]         = useState<MetaPage[]>([]);
  const fileRef                   = useRef<HTMLInputElement>(null);

  // ── Drag & drop ────────────────────────────────────────────────────────────

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.name.endsWith(".docx")) setFile(dropped);
    else setError("Carica un file .docx valido.");
  }, []);

  // ── Step 1 → 2: parse ─────────────────────────────────────────────────────

  async function handleParse() {
    if (!file) return;
    setParsing(true); setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await apiFetch("/api/meta/parse", { method: "POST", body: form });
      if (!r.ok) {
        let msg = "Errore durante il parsing del documento.";
        try { const d = await r.json(); msg = d.detail || d.message || msg; } catch {}
        throw new Error(msg);
      }
      const data: ParsedPage[] = await r.json();
      if (!data.length) throw new Error("Nessuna sezione trovata nel documento.");
      setParsed(data);
      setStep("preview");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Errore");
    } finally { setParsing(false); }
  }

  // ── Step 2 → 3: generate ──────────────────────────────────────────────────

  async function handleGenerate() {
    setGenerating(true); setError(null);
    try {
      const r = await apiFetch("/api/meta/generate", {
        method: "POST",
        body: JSON.stringify(parsed),
      });
      if (!r.ok) {
        let msg = "Errore durante la generazione dei meta tag.";
        try { const d = await r.json(); msg = d.detail || d.message || msg; } catch {}
        throw new Error(msg);
      }
      const data: MetaPage[] = await r.json();
      setMetas(data);
      setStep("results");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Errore");
    } finally { setGenerating(false); }
  }

  // ── Rigenera singola pagina ────────────────────────────────────────────────

  async function handleRegenerate(idx: number) {
    const page = parsed[idx];
    if (!page) return;
    setMetas((prev) => prev.map((m, i) => i === idx ? { ...m, regenerating: true } : m));
    try {
      const r = await apiFetch("/api/meta/regenerate", {
        method: "POST",
        body: JSON.stringify(page),
      });
      if (!r.ok) return;
      const data: MetaPage = await r.json();
      setMetas((prev) => prev.map((m, i) =>
        i === idx ? { ...data, regenerating: false } : m
      ));
    } catch {
      setMetas((prev) => prev.map((m, i) => i === idx ? { ...m, regenerating: false } : m));
    }
  }

  // ── Export .docx ──────────────────────────────────────────────────────────

  async function handleExport() {
    try {
      const r = await apiFetch("/api/meta/export", {
        method: "POST",
        body: JSON.stringify({ pages: metas }),
      });
      if (!r.ok) {
        let msg = "Errore durante l'esportazione.";
        try { const d = await r.json(); msg = d.detail || d.message || msg; } catch {}
        setError(msg); return;
      }
      const blob = await r.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `meta-tag-${new Date().toISOString().slice(0, 10)}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { setError("Errore durante il download."); }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Meta Generator"
        subtitle="Carica il file testi del sito. Il sistema rileverà le pagine e genererà meta title e description ottimizzati."
      />

      <div className="flex-1 overflow-y-auto bg-[#f7f7f6]">
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 24px" }}>

          {error && <div style={{ marginBottom: 16 }}><Alert type="error">{error}</Alert></div>}

          {/* ── Step 1: Upload ─────────────────────────────────────────────── */}
          {step === "upload" && (
            <Section>
              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${dragging ? "#6366f1" : file ? "#22c55e" : "#d1d5db"}`,
                  borderRadius: 12,
                  padding: "48px 24px",
                  textAlign: "center",
                  cursor: "pointer",
                  background: dragging ? "rgba(99,102,241,0.04)" : "white",
                  transition: "all 0.15s",
                  marginBottom: 20,
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 12 }}>
                  {file ? "\u2705" : "\ud83d\udcc4"}
                </div>
                <p style={{ fontSize: 14, fontWeight: 500, color: "#1a1a1a", marginBottom: 6 }}>
                  {file ? file.name : "Trascina qui il file .docx"}
                </p>
                <p style={{ fontSize: 12, color: "#ababab" }}>
                  {file
                    ? `${(file.size / 1024).toFixed(1)} KB`
                    : "oppure clicca per selezionare"}
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".docx"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f?.name.endsWith(".docx")) { setFile(f); setError(null); }
                    else setError("Carica un file .docx valido.");
                  }}
                />
              </div>

              <Btn
                onClick={handleParse}
                loading={parsing}
                disabled={!file || parsing}
                style={{ background: "#6366f1", borderColor: "#6366f1", color: "white" }}
              >
                {parsing ? "Analisi in corso\u2026" : "Analizza documento"}
              </Btn>
            </Section>
          )}

          {/* ── Step 2: Preview ────────────────────────────────────────────── */}
          {step === "preview" && (
            <Section>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>
                    {parsed.length} pagine rilevate
                  </p>
                  <p style={{ fontSize: 12, color: "#ababab", marginTop: 2 }}>
                    Verifica le pagine e gli URL, poi genera i meta tag.
                  </p>
                </div>
                <button
                  onClick={() => { setStep("upload"); setFile(null); setParsed([]); setError(null); }}
                  style={{ fontSize: 12, color: "#ababab", background: "none", border: "none", cursor: "pointer" }}
                >
                  \u2190 Ricarica file
                </button>
              </div>

              {/* Tabella preview */}
              <div style={{ border: "1px solid #e8e8e8", borderRadius: 10, overflow: "hidden", marginBottom: 20 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e8e8e8" }}>
                      <th style={{ ...thStyle, width: "30%" }}>Pagina</th>
                      <th style={{ ...thStyle, width: "25%" }}>URL suggerito</th>
                      <th style={{ ...thStyle, width: "45%" }}>Contenuto (anteprima)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.map((p, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #f0f0f0" }}>
                        <td style={tdStyle}>
                          <span style={{ fontWeight: 500, color: "#1a1a1a" }}>{p.page}</span>
                        </td>
                        <td style={tdStyle}>
                          <input
                            value={p.url}
                            onChange={(e) => setParsed((prev) =>
                              prev.map((x, j) => j === i ? { ...x, url: e.target.value } : x)
                            )}
                            style={{
                              width: "100%", fontSize: 11, padding: "3px 6px",
                              border: "1px solid #e8e8e8", borderRadius: 5,
                              fontFamily: "monospace", color: "#555",
                            }}
                          />
                        </td>
                        <td style={{ ...tdStyle, color: "#888" }}>
                          {p.content.slice(0, 80)}{p.content.length > 80 ? "\u2026" : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Btn
                onClick={handleGenerate}
                loading={generating}
                disabled={generating}
                style={{ background: "#6366f1", borderColor: "#6366f1", color: "white" }}
              >
                {generating ? "Generazione meta tag\u2026" : "Genera Meta"}
              </Btn>
              {generating && (
                <p style={{ fontSize: 11, color: "#ababab", marginTop: 8 }}>
                  GPT-4o sta elaborando {parsed.length} pagine\u2026 potrebbe richiedere qualche secondo.
                </p>
              )}
            </Section>
          )}

          {/* ── Step 3: Results ────────────────────────────────────────────── */}
          {step === "results" && (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>
                    {metas.length} meta tag generati
                  </p>
                  <p style={{ fontSize: 12, color: "#ababab", marginTop: 2 }}>
                    Modifica i campi, poi scarica il documento.
                  </p>
                </div>
                <button
                  onClick={() => { setStep("upload"); setFile(null); setParsed([]); setMetas([]); setError(null); }}
                  style={{ fontSize: 12, color: "#ababab", background: "none", border: "none", cursor: "pointer" }}
                >
                  \u2190 Nuovo documento
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                {metas.map((m, i) => (
                  <MetaCard
                    key={i}
                    meta={m}
                    onChangeUrl={(v) => setMetas((prev) => prev.map((x, j) => j === i ? { ...x, url: v } : x))}
                    onChangeTitle={(v) => setMetas((prev) => prev.map((x, j) => j === i ? { ...x, title: v } : x))}
                    onChangeDesc={(v) => setMetas((prev) => prev.map((x, j) => j === i ? { ...x, description: v } : x))}
                    onRegenerate={() => handleRegenerate(i)}
                  />
                ))}
              </div>

              <Btn
                onClick={handleExport}
                style={{ background: "#6366f1", borderColor: "#6366f1", color: "white" }}
              >
                Scarica .docx
              </Btn>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Stili tabella ─────────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  padding: "10px 14px",
  textAlign: "left",
  fontSize: 11,
  fontWeight: 600,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 14px",
  verticalAlign: "top",
  fontSize: 12,
  color: "#374151",
};

// ── MetaCard ─────────────────────────────────────────────────────────────────

function MetaCard({
  meta,
  onChangeUrl,
  onChangeTitle,
  onChangeDesc,
  onRegenerate,
}: {
  meta: MetaPage;
  onChangeUrl:   (v: string) => void;
  onChangeTitle: (v: string) => void;
  onChangeDesc:  (v: string) => void;
  onRegenerate:  () => void;
}) {
  const tLen = meta.title.length;
  const dLen = meta.description.length;

  return (
    <div style={{
      background: "white", borderRadius: 10,
      border: "1px solid #e8e8e8", overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 16px", borderBottom: "1px solid #f0f0f0",
        background: "#fafafa",
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>
          {meta.page}
        </span>
        <button
          onClick={onRegenerate}
          disabled={meta.regenerating}
          style={{
            fontSize: 11, fontWeight: 500, color: "#6366f1",
            background: "none", border: "none", cursor: "pointer",
            opacity: meta.regenerating ? 0.5 : 1,
          }}
        >
          {meta.regenerating ? "Rigenerando\u2026" : "\u21ba Rigenera"}
        </button>
      </div>

      {/* Campi */}
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* URL */}
        <FieldRow label="URL">
          <input
            value={meta.url}
            onChange={(e) => onChangeUrl(e.target.value)}
            style={inputStyle}
          />
        </FieldRow>

        {/* Meta Title */}
        <FieldRow label="Meta Title" counter={tLen} counterColor={titleColor(tLen)} hint="50-60 car.">
          <input
            value={meta.title}
            onChange={(e) => onChangeTitle(e.target.value)}
            style={inputStyle}
          />
        </FieldRow>

        {/* Meta Description */}
        <FieldRow label="Meta Description" counter={dLen} counterColor={descColor(dLen)} hint="140-160 car.">
          <textarea
            value={meta.description}
            onChange={(e) => onChangeDesc(e.target.value)}
            rows={2}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
          />
        </FieldRow>

      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", fontSize: 13, padding: "7px 10px",
  border: "1px solid #e8e8e8", borderRadius: 7,
  color: "#1a1a1a", outline: "none",
  boxSizing: "border-box",
};

function FieldRow({
  label, children, counter, counterColor, hint,
}: {
  label: string;
  children: React.ReactNode;
  counter?: number;
  counterColor?: string;
  hint?: string;
}) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
        <span style={{ fontSize: 11, fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}
        </span>
        {hint && <span style={{ fontSize: 10, color: "#c0c0c0" }}>{hint}</span>}
        {counter !== undefined && (
          <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, color: counterColor }}>
            {counter}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Type stub per MetaPage (local) ────────────────────────────────────────────
// (già definito in cima, riutilizzato in MetaCard)

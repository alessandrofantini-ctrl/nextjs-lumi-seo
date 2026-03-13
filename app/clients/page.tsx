"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Label, Input, Textarea, Select, Btn, Alert } from "@/components/ui";
import { apiFetch } from "@/lib/api";

// ── Tipi ─────────────────────────────────────────────────────────────────────

type Client = {
  id: string;
  name: string;
  url?: string;
  sector?: string;
  tone_of_voice?: string;
  total_keywords: number;
  keywords_crescita: number;
  keywords_calo: number;
  last_sync: string | null;
  clicks_curr: number;
  impressions_curr: number;
  avg_position: number | null;
  avg_ctr: number | null;
  clicks_trend: number | null;
  impressions_trend: number | null;
};

type NewClientForm = {
  name: string; url: string; sector: string; brand_name: string;
  tone_of_voice: string; usp: string; products_services: string;
  target_audience: string; geo: string; notes: string; gsc_property: string;
  language_code: string; location_code: number;
};

const EMPTY: NewClientForm = {
  name: "", url: "", sector: "", brand_name: "",
  tone_of_voice: "Autorevole & tecnico", usp: "",
  products_services: "", target_audience: "", geo: "", notes: "", gsc_property: "",
  language_code: "it", location_code: 2380,
};

const TONES = ["Autorevole & tecnico", "Empatico & problem solving", "Diretto & commerciale"];

const LOCATION_OPTIONS = [
  { value: 2380, label: "Italia" },
  { value: 2840, label: "Stati Uniti" },
  { value: 2826, label: "Regno Unito" },
  { value: 2276, label: "Germania" },
  { value: 2250, label: "Francia" },
  { value: 2724, label: "Spagna" },
];

// ── Salute cliente ────────────────────────────────────────────────────────────

type Health = "critical" | "warning" | "stable" | "nodata";

const HEALTH_CFG: Record<Health, {
  label: string; border: string;
  badgeBg: string; badgeColor: string;
  avatarBg: string; avatarColor: string;
}> = {
  critical: { label: "Critico",     border: "#ef4444", badgeBg: "#fef2f2", badgeColor: "#b91c1c", avatarBg: "#fecaca", avatarColor: "#991b1b" },
  warning:  { label: "Attenzione",  border: "#f59e0b", badgeBg: "#fffbeb", badgeColor: "#92400e", avatarBg: "#fde68a", avatarColor: "#78350f" },
  stable:   { label: "Stabile",     border: "#22c55e", badgeBg: "#f0fdf4", badgeColor: "#15803d", avatarBg: "#bbf7d0", avatarColor: "#14532d" },
  nodata:   { label: "Nessun dato", border: "#d1d5db", badgeBg: "#f9fafb", badgeColor: "#6b7280", avatarBg: "#e5e7eb", avatarColor: "#374151" },
};

const HEALTH_ORDER: Record<Health, number> = { critical: 0, warning: 1, stable: 2, nodata: 3 };

function getHealth(c: Client): Health {
  if (c.clicks_curr === 0 && c.total_keywords === 0) return "nodata";
  const syncDays = c.last_sync
    ? Math.floor((Date.now() - new Date(c.last_sync).getTime()) / 86400000)
    : 999;
  if (c.keywords_calo > c.keywords_crescita) return "critical";
  if (syncDays > 14 || c.keywords_calo > 0) return "warning";
  return "stable";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtNum(n: number) { return n.toLocaleString("it-IT"); }
function fmtPos(p: number | null) { return p != null ? `#${p.toFixed(1)}` : "\u2014"; }
function fmtCtr(p: number | null) { return p != null ? `${(p * 100).toFixed(1)}%` : "\u2014"; }


function clientInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function TrendPct({ value }: { value: number | null }) {
  if (value == null || value === 0) return <span style={{ fontSize: 10, color: "#c0c0c0" }}>—</span>;
  const up = value > 0;
  return (
    <span style={{ fontSize: 10, fontWeight: 500, color: up ? "#16a34a" : "#dc2626" }}>
      {up ? "+" : ""}{value}%
    </span>
  );
}

// ── Pagina ────────────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const [clients, setClients]     = useState<Client[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState<NewClientForm>(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [autoUrl, setAutoUrl]     = useState("");
  const [generating, setGenerating] = useState(false);
  const [search, setSearch]       = useState("");
  const [sortCritical, setSortCritical] = useState(true);

  useEffect(() => { loadClients(); }, []);

  async function loadClients() {
    setLoading(true);
    try {
      const r = await apiFetch("/api/dashboard");
      if (!r.ok) throw new Error("Errore caricamento clienti");
      const data = await r.json();
      setClients(Array.isArray(data) ? data : []);
    } catch { setError("Errore caricamento clienti."); }
    finally { setLoading(false); }
  }

  async function handleAutoGenerate() {
    if (!autoUrl) return;
    setGenerating(true); setError(null);
    try {
      const r = await apiFetch("/api/clients/auto-generate", {
        method: "POST", body: JSON.stringify({ url: autoUrl }),
      });
      if (!r.ok) throw new Error("Errore generazione profilo");
      const data = await r.json();
      setForm((f) => ({ ...f, ...data, url: autoUrl }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Errore");
    } finally { setGenerating(false); }
  }

  async function createClient(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Il nome \u00e8 obbligatorio."); return; }
    setSaving(true); setError(null);
    try {
      const r = await apiFetch("/api/clients", {
        method: "POST", body: JSON.stringify(form),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.detail || "Errore"); }
      setForm(EMPTY); setShowModal(false); loadClients();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Errore creazione");
    } finally { setSaving(false); }
  }

  // KPI aggregati
  const kpi = useMemo(() => ({
    projects:    clients.length,
    keywords:    clients.reduce((s, c) => s + c.total_keywords, 0),
    clicks:      clients.reduce((s, c) => s + c.clicks_curr, 0),
    crescita:    clients.reduce((s, c) => s + c.keywords_crescita, 0),
    calo:        clients.reduce((s, c) => s + c.keywords_calo, 0),
  }), [clients]);

  // Alert clienti critici / desync
  const alertClients = useMemo(() =>
    clients.filter(c => {
      const days = syncDaysAgo(c.last_sync);
      return days > 14 || c.keywords_calo > c.keywords_crescita;
    }).map(c => c.name),
  [clients]);

  // Lista filtrata e ordinata
  const filtered = useMemo(() => {
    const withHealth = clients
      .filter(c =>
        !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.sector || "").toLowerCase().includes(search.toLowerCase())
      )
      .map(c => ({ ...c, health: getHealth(c) }));

    if (sortCritical) {
      withHealth.sort((a, b) => HEALTH_ORDER[a.health] - HEALTH_ORDER[b.health]);
    } else {
      withHealth.sort((a, b) => a.name.localeCompare(b.name));
    }
    return withHealth;
  }, [clients, search, sortCritical]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* Header ─────────────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "flex-end", justifyContent: "space-between",
        padding: "24px 28px 16px", borderBottom: "1px solid #eee",
        background: "white", flexShrink: 0,
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: "#1a1a1a", margin: 0 }}>Progetti</h1>
          <p style={{ fontSize: 12, color: "#ababab", marginTop: 4 }}>
            {clients.length} client{clients.length === 1 ? "e" : "i"} attiv{clients.length === 1 ? "o" : "i"}
          </p>
        </div>
        <button
          onClick={() => { setShowModal(true); setError(null); }}
          style={{
            background: "#6366f1", color: "white", border: "none",
            borderRadius: 8, padding: "8px 16px", fontSize: 13,
            fontWeight: 500, cursor: "pointer",
          }}
        >
          + Nuovo cliente
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", background: "#f7f7f6" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "20px 24px" }}>

          {/* KPI bar ─────────────────────────────────────────────────────────── */}
          {!loading && clients.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 20 }}>
              <KpiCard label="Progetti attivi"      value={kpi.projects}  />
              <KpiCard label="Keyword monitorate"   value={kpi.keywords}  />
              <KpiCard label="Click totali 28gg"    value={fmtNum(kpi.clicks)} />
              <KpiCard label="In crescita"          value={kpi.crescita}  color="#16a34a" />
              <KpiCard label="In calo"              value={kpi.calo}      color="#dc2626" />
            </div>
          )}

          {/* Alert bar ────────────────────────────────────────────────────────── */}
          {alertClients.length > 0 && (
            <div style={{
              background: "#fffbeb", border: "1px solid #fde68a",
              borderRadius: 8, padding: "10px 14px", marginBottom: 16,
              fontSize: 12, color: "#78350f",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontSize: 14 }}>⚠️</span>
              <span>
                <strong>Attenzione:</strong> {alertClients.join(", ")} {alertClients.length === 1 ? "richiede" : "richiedono"} verifica (sync scaduto o keyword in calo).
              </span>
            </div>
          )}

          {error && <div style={{ marginBottom: 16 }}><Alert type="error">{error}</Alert></div>}

          {/* Search + sort ───────────────────────────────────────────────────── */}
          {clients.length > 0 && (
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cerca per nome o settore\u2026"
                style={{
                  flex: 1, padding: "8px 12px", fontSize: 13,
                  border: "1px solid #e8e8e8", borderRadius: 8,
                  outline: "none", background: "white",
                }}
              />
              <button
                onClick={() => setSortCritical((v) => !v)}
                style={{
                  padding: "8px 14px", fontSize: 12, fontWeight: 500,
                  border: "1px solid #e8e8e8", borderRadius: 8,
                  background: sortCritical ? "#6366f1" : "white",
                  color: sortCritical ? "white" : "#555",
                  cursor: "pointer", whiteSpace: "nowrap",
                }}
              >
                Ordina: {sortCritical ? "critici prima" : "A → Z"}
              </button>
            </div>
          )}

          {/* Skeleton ────────────────────────────────────────────────────────── */}
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{
                  height: 110, borderRadius: 10,
                  background: "#e8e8e8", animation: "pulse 1.5s infinite",
                }} />
              ))}
            </div>
          )}

          {/* Lista clienti ──────────────────────────────────────────────────── */}
          {!loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.map((c) => (
                <ClientCard key={c.id} client={c} health={c.health} />
              ))}
            </div>
          )}

          {!loading && filtered.length === 0 && clients.length > 0 && (
            <p style={{ color: "#ababab", fontSize: 13, textAlign: "center", paddingTop: 32 }}>
              Nessun cliente trovato.
            </p>
          )}
          {!loading && clients.length === 0 && (
            <p style={{ color: "#ababab", fontSize: 13, textAlign: "center", paddingTop: 32 }}>
              Nessun progetto ancora. Crea il primo cliente.
            </p>
          )}

        </div>
      </div>

      {/* Modal nuovo cliente ─────────────────────────────────────────────────── */}
      {showModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 50, padding: 24,
          }}
        >
          <div style={{
            background: "white", borderRadius: 12, width: "100%", maxWidth: 680,
            maxHeight: "90vh", overflowY: "auto", padding: 28, position: "relative",
          }}>
            {/* X chiudi */}
            <button
              onClick={() => { setShowModal(false); setError(null); setForm(EMPTY); }}
              style={{
                position: "absolute", top: 16, right: 16,
                background: "none", border: "none", fontSize: 18,
                color: "#888", cursor: "pointer", lineHeight: 1,
              }}
            >
              \u00d7
            </button>

            <h2 style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", marginBottom: 4 }}>
              Nuovo profilo cliente
            </h2>
            <p style={{ fontSize: 12, color: "#ababab", marginBottom: 20 }}>
              Questi dati vengono usati per generare brief e articoli SEO personalizzati.
            </p>

            {/* Auto-generate */}
            <div style={{
              marginBottom: 20, padding: 16, borderRadius: 8,
              background: "#f7f7f6", border: "1px solid #e8e8e8",
            }}>
              <p style={{ fontSize: 11, fontWeight: 500, color: "#737373", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
                Genera da URL sito
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <Input value={autoUrl} onChange={(e) => setAutoUrl(e.target.value)} placeholder="https://www.cliente.it" />
                <Btn onClick={handleAutoGenerate} loading={generating} disabled={!autoUrl} className="shrink-0">
                  {generating ? "Analisi\u2026" : "Analizza"}
                </Btn>
              </div>
            </div>

            {error && <div style={{ marginBottom: 16 }}><Alert type="error">{error}</Alert></div>}

            <form onSubmit={createClient} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Nome identificativo *</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Rossi Impianti Srl" /></div>
                <div><Label>URL sito</Label><Input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://www.cliente.it" /></div>
                <div><Label>Settore</Label><Input value={form.sector} onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value }))} placeholder="Impianti industriali" /></div>
                <div><Label>Brand name</Label><Input value={form.brand_name} onChange={(e) => setForm((f) => ({ ...f, brand_name: e.target.value }))} placeholder="Es. Lumi Company" /></div>
                <div><Label>Area geografica</Label><Input value={form.geo} onChange={(e) => setForm((f) => ({ ...f, geo: e.target.value }))} placeholder="Es. Italia, Milano e Roma" /></div>
                <div>
                  <Label>Tono di voce</Label>
                  <Select value={form.tone_of_voice} onChange={(e) => setForm((f) => ({ ...f, tone_of_voice: e.target.value }))}>
                    {TONES.map((t) => <option key={t}>{t}</option>)}
                  </Select>
                </div>
                <div className="col-span-2"><Label>Pubblico target</Label><Input value={form.target_audience} onChange={(e) => setForm((f) => ({ ...f, target_audience: e.target.value }))} placeholder="Es. Marketing manager di PMI italiane" /></div>
              </div>
              <div><Label>Prodotti / Servizi</Label><Textarea rows={3} value={form.products_services} onChange={(e) => setForm((f) => ({ ...f, products_services: e.target.value }))} placeholder="Es. Consulenza SEO, audit tecnici" /></div>
              <div><Label>Proposta di valore (USP)</Label><Textarea rows={2} value={form.usp} onChange={(e) => setForm((f) => ({ ...f, usp: e.target.value }))} placeholder="Es. Unici a combinare SEO tecnico e content" /></div>
              <div><Label>Note strategiche SEO</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Istruzioni per i prompt GPT" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Lingua (DataForSEO)</Label>
                  <Input value={form.language_code} onChange={(e) => setForm((f) => ({ ...f, language_code: e.target.value }))} placeholder="it" />
                  <p style={{ fontSize: 11, color: "#ababab", marginTop: 4 }}>Codice ISO 639-1. Es: it, en, de, fr</p>
                </div>
                <div>
                  <Label>Paese (DataForSEO)</Label>
                  <Select value={form.location_code} onChange={(e) => setForm((f) => ({ ...f, location_code: Number(e.target.value) }))}>
                    {LOCATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </Select>
                </div>
              </div>
              <div>
                <Label>Proprietà Google Search Console</Label>
                <Input value={form.gsc_property ?? ""} onChange={(e) => setForm((f) => ({ ...f, gsc_property: e.target.value }))} placeholder="Es. sc-domain:example.com" />
                <p style={{ fontSize: 11, color: "#ababab", marginTop: 4 }}>
                  Trovi il formato in Google Search Console → seleziona la proprietà → copia l&apos;URL dalla barra.
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
                <Btn type="submit" loading={saving} style={{ background: "#6366f1", borderColor: "#6366f1", color: "white" }}>
                  Salva cliente
                </Btn>
                <Btn type="button" variant="ghost" onClick={() => { setShowModal(false); setError(null); setForm(EMPTY); }}>
                  Annulla
                </Btn>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Card cliente ──────────────────────────────────────────────────────────────

function ClientCard({ client: c, health }: { client: Client & { health: Health }; health: Health }) {
  const cfg    = HEALTH_CFG[health];
  const noData = health === "nodata";
  const days   = syncDaysAgo(c.last_sync);
  const syncLabel = c.last_sync == null
    ? "Mai sincronizzato"
    : days === 0 ? "sync oggi"
    : days === 1 ? "sync ieri"
    : `sync ${days}gg fa`;

  return (
    <div style={{
      background: "white", borderRadius: 10,
      border: "1px solid #e8e8e8",
      borderLeft: `3px solid ${cfg.border}`,
      overflow: "hidden",
    }}>
      {/* Header card */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 18px", borderBottom: noData ? "none" : "1px solid #f0f0f0",
      }}>
        {/* Avatar */}
        <div style={{
          width: 34, height: 34, borderRadius: 8, flexShrink: 0,
          background: cfg.avatarBg, color: cfg.avatarColor,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
        }}>
          {clientInitials(c.name)}
        </div>

        {/* Nome + URL */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link
            href={`/clients/${c.id}`}
            style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a", textDecoration: "none" }}
          >
            {c.name}
          </Link>
          {c.url && (
            <p style={{ fontSize: 11, color: "#ababab", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {c.url}
            </p>
          )}
          {!c.url && c.sector && (
            <p style={{ fontSize: 11, color: "#ababab", marginTop: 1 }}>{c.sector}</p>
          )}
        </div>

        {/* Badge salute + sync */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: "#c0c0c0" }}>{syncLabel}</span>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 20,
            background: cfg.badgeBg, color: cfg.badgeColor,
            letterSpacing: "0.04em", textTransform: "uppercase",
          }}>
            {cfg.label}
          </span>
          <Link href={`/clients/${c.id}`} style={{ color: "#ccc", fontSize: 14, textDecoration: "none" }}>→</Link>
        </div>
      </div>

      {/* Metriche row — 5 colonne */}
      {noData ? (
        <div style={{ padding: "11px 18px" }}>
          <Link
            href={`/clients/${c.id}`}
            style={{ fontSize: 12, color: "#ababab", textDecoration: "none" }}
          >
            Nessuna keyword monitorata · GSC non configurata —{" "}
            <span style={{ color: "#6366f1" }}>Completa il profilo →</span>
          </Link>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", padding: "12px 18px", gap: 8 }}>
          {/* Click */}
          <MetricCol
            label="Click 28gg"
            value={c.clicks_curr > 0 ? fmtNum(c.clicks_curr) : "\u2014"}
            trend={c.clicks_trend}
          />
          {/* Impressioni */}
          <MetricCol
            label="Impressioni"
            value={c.impressions_curr > 0 ? fmtNum(c.impressions_curr) : "\u2014"}
            trend={c.impressions_trend}
          />
          {/* Posizione */}
          <MetricCol label="Pos. media" value={fmtPos(c.avg_position)} />
          {/* CTR */}
          <MetricCol label="CTR medio" value={fmtCtr(c.avg_ctr)} />
          {/* Keyword */}
          <div>
            <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "#ababab", marginBottom: 4 }}>
              Keyword
            </p>
            <p style={{ fontSize: 15, fontWeight: 500, color: "#1a1a1a", marginBottom: 4 }}>
              {c.total_keywords}
            </p>
            {c.total_keywords > 0 && (
              <>
                <div style={{
                  height: 4, borderRadius: 2, background: "#f0f0f0",
                  overflow: "hidden", marginBottom: 4,
                  display: "flex",
                }}>
                  <div style={{
                    width: `${Math.min(100, (c.keywords_crescita / c.total_keywords) * 100)}%`,
                    background: "#22c55e",
                  }} />
                  <div style={{
                    width: `${Math.min(100, (c.keywords_calo / c.total_keywords) * 100)}%`,
                    background: "#ef4444",
                  }} />
                </div>
                <p style={{ fontSize: 10, color: "#888" }}>
                  <span style={{ color: "#16a34a" }}>\u2191{c.keywords_crescita}</span>
                  {" "}
                  <span style={{ color: "#dc2626" }}>\u2193{c.keywords_calo}</span>
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componenti locali ─────────────────────────────────────────────────────────

function KpiCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{
      background: "white", borderRadius: 10,
      border: "1px solid #e8e8e8", padding: "14px 16px",
    }}>
      <p style={{ fontSize: 10, fontWeight: 500, color: "#ababab", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
        {label}
      </p>
      <p style={{ fontSize: 22, fontWeight: 600, color: color ?? "#1a1a1a", margin: 0 }}>
        {value}
      </p>
    </div>
  );
}

function MetricCol({ label, value, trend }: { label: string; value: string; trend?: number | null }) {
  return (
    <div>
      <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "#ababab", marginBottom: 4 }}>
        {label}
      </p>
      <p style={{ fontSize: 15, fontWeight: 500, color: "#1a1a1a", marginBottom: 2 }}>
        {value}
      </p>
      {trend !== undefined && <TrendPct value={trend} />}
    </div>
  );
}

function syncDaysAgo(last: string | null): number {
  if (!last) return 999;
  return Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
}

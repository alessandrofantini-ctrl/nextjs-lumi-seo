"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader, Section, Card, Label, Input, Textarea, Select, Btn, Alert } from "@/components/ui";
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
  // Metriche GSC
  clicks_curr: number;
  impressions_curr: number;
  avg_position: number | null;
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

// ── Pagina ────────────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const [clients, setClients]   = useState<Client[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState<NewClientForm>(EMPTY);
  const [saving, setSaving]     = useState(false);
  const [search, setSearch]     = useState("");
  const [autoUrl, setAutoUrl]   = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => { loadClients(); }, []);

  async function loadClients() {
    setLoading(true);
    try {
      const r = await apiFetch("/api/dashboard");
      if (!r.ok) throw new Error("Errore caricamento clienti");
      const data = await r.json();
      setClients(Array.isArray(data) ? data : []);
    } catch { setError("Errore caricamento clienti"); }
    finally { setLoading(false); }
  }

  async function handleAutoGenerate() {
    if (!autoUrl) return;
    setGenerating(true); setError(null);
    try {
      const r = await apiFetch("/api/clients/auto-generate", {
        method: "POST",
        body: JSON.stringify({ url: autoUrl }),
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
    if (!form.name.trim()) { setError("Il nome è obbligatorio."); return; }
    setSaving(true); setError(null);
    try {
      const r = await apiFetch("/api/clients", {
        method: "POST",
        body: JSON.stringify(form),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.detail || "Errore"); }
      setForm(EMPTY); setShowForm(false); loadClients();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Errore creazione");
    } finally { setSaving(false); }
  }

  const filtered = clients.filter(
    (c) => !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.sector || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Clienti"
        subtitle={`${clients.length} profil${clients.length === 1 ? "o" : "i"} attiv${clients.length === 1 ? "o" : "i"}`}
      />

      <div className="flex-1 overflow-y-auto bg-[#f7f7f6]">
        <Section>
          {error && <div className="mb-5"><Alert type="error">{error}</Alert></div>}

          {/* KPI globali */}
          {!loading && clients.length > 0 && <GlobalKpi clients={clients} />}

          {/* Bottone nuovo */}
          {!showForm ? (
            <Btn onClick={() => { setShowForm(true); setError(null); }} className="mb-6">
              + Nuovo cliente
            </Btn>
          ) : (
            <Card className="mb-8 p-6">
              <h2 className="text-[13px] font-semibold text-[#555] mb-1">Nuovo profilo cliente</h2>
              <p className="text-[12px] text-[#ababab] mb-5">
                Questi dati vengono usati per generare brief e articoli SEO personalizzati — più sono precisi, migliore sarà l&apos;output.
              </p>

              {/* Auto-generate */}
              <div className="mb-5 p-4 rounded-lg bg-[#f7f7f6] border border-[#e8e8e8]">
                <p className="text-[11px] font-medium text-[#737373] uppercase tracking-wide mb-3">
                  Genera da URL sito
                </p>
                <div className="flex gap-2">
                  <Input value={autoUrl} onChange={(e) => setAutoUrl(e.target.value)} placeholder="https://www.cliente.it" />
                  <Btn onClick={handleAutoGenerate} loading={generating} disabled={!autoUrl} className="shrink-0">
                    {generating ? "Analisi…" : "Analizza"}
                  </Btn>
                </div>
              </div>

              <form onSubmit={createClient} className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Nome identificativo *</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Rossi Impianti Srl" /></div>
                  <div><Label>URL sito</Label><Input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://www.cliente.it" /></div>
                  <div><Label>Settore</Label><Input value={form.sector} onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value }))} placeholder="Impianti industriali" /></div>
                  <div><Label>Brand name</Label><Input value={form.brand_name} onChange={(e) => setForm((f) => ({ ...f, brand_name: e.target.value }))} placeholder="Es. Lumi Company — agenzia SEO B2B" /></div>
                  <div><Label>Area geografica</Label><Input value={form.geo} onChange={(e) => setForm((f) => ({ ...f, geo: e.target.value }))} placeholder="Es. Italia, con focus su Milano e Roma" /></div>
                  <div>
                    <Label>Tono di voce</Label>
                    <Select value={form.tone_of_voice} onChange={(e) => setForm((f) => ({ ...f, tone_of_voice: e.target.value }))}>
                      {TONES.map((t) => <option key={t}>{t}</option>)}
                    </Select>
                  </div>
                  <div className="col-span-2"><Label>Pubblico target</Label><Input value={form.target_audience} onChange={(e) => setForm((f) => ({ ...f, target_audience: e.target.value }))} placeholder="Es. Marketing manager di PMI italiane, 30-50 anni" /></div>
                </div>
                <div><Label>Prodotti / Servizi</Label><Textarea rows={4} value={form.products_services} onChange={(e) => setForm((f) => ({ ...f, products_services: e.target.value }))} placeholder="Es. Consulenza SEO, audit tecnici, content marketing" /></div>
                <div><Label>Proposta di valore unica (USP)</Label><Textarea rows={2} value={form.usp} onChange={(e) => setForm((f) => ({ ...f, usp: e.target.value }))} placeholder="Es. Unici a combinare SEO tecnico e content in un unico team interno" /></div>
                <div><Label>Note strategiche SEO</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Istruzioni particolari per i prompt GPT" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Lingua (DataForSEO)</Label>
                    <Input value={form.language_code} onChange={(e) => setForm((f) => ({ ...f, language_code: e.target.value }))} placeholder="it" />
                    <p className="text-[11px] text-[#ababab] mt-1.5">Codice lingua ISO 639-1. Es: it, en, de, fr</p>
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
                  <Input value={form.gsc_property ?? ""} onChange={(e) => setForm((f) => ({ ...f, gsc_property: e.target.value }))} placeholder="Es. sc-domain:example.com oppure https://www.example.com/" />
                  <p className="text-[11px] text-[#ababab] mt-1.5">
                    Trovi il formato esatto in Google Search Console → seleziona la proprietà → copia l&apos;URL dalla barra in alto.
                  </p>
                </div>

                <div className="flex gap-2 pt-1">
                  <Btn type="submit" loading={saving}>Salva cliente</Btn>
                  <Btn type="button" variant="ghost" onClick={() => { setShowForm(false); setError(null); setForm(EMPTY); }}>
                    Annulla
                  </Btn>
                </div>
              </form>
            </Card>
          )}

          {/* Ricerca */}
          {clients.length > 0 && (
            <div className="mb-4">
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca per nome o settore…" />
            </div>
          )}

          {/* Skeleton */}
          {loading && (
            <div className="flex flex-col gap-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-[72px] rounded-xl border border-[#e8e8e8] bg-[#f0f0f0] animate-pulse" />
              ))}
            </div>
          )}

          {/* Lista clienti */}
          <div className="flex flex-col gap-1.5">
            {filtered.map((c) => (
              <Link
                key={c.id}
                href={`/clients/${c.id}`}
                className="group flex items-center justify-between px-5 py-4 rounded-xl border border-[#e8e8e8] bg-white hover:border-[#ccc] hover:shadow-sm transition-all"
              >
                {/* Sinistra — info cliente */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#1a1a1a]">{c.name}</p>
                  <p className="text-[11px] text-[#ababab] mt-0.5">
                    {[c.sector, c.tone_of_voice].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>

                {/* Centro — metriche GSC + trend */}
                <div className="flex items-center gap-4 mx-6">
                  {c.clicks_curr > 0 ? (
                    <>
                      <div className="flex flex-col items-center">
                        <span className="text-[13px] font-semibold text-[#1a1a1a]">
                          {c.clicks_curr.toLocaleString("it-IT")}
                        </span>
                        <span className="text-[10px] text-[#ababab]">click</span>
                        {c.clicks_trend !== null && <TrendPct value={c.clicks_trend} />}
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[13px] font-semibold text-[#1a1a1a]">
                          {c.impressions_curr.toLocaleString("it-IT")}
                        </span>
                        <span className="text-[10px] text-[#ababab]">imp</span>
                        {c.impressions_trend !== null && <TrendPct value={c.impressions_trend} />}
                      </div>
                      {c.avg_position && (
                        <div className="flex flex-col items-center">
                          <span className="text-[13px] font-semibold text-[#1a1a1a]">
                            #{c.avg_position}
                          </span>
                          <span className="text-[10px] text-[#ababab]">pos. media</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        {c.keywords_crescita > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-50 text-green-600 border border-green-200">
                            ↑ {c.keywords_crescita}
                          </span>
                        )}
                        {c.keywords_calo > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-50 text-red-600 border border-red-200">
                            ↓ {c.keywords_calo}
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <span className="text-[11px] text-[#c0c0c0]">
                      {c.total_keywords > 0
                        ? `${c.total_keywords} keyword · nessun dato GSC`
                        : "Nessuna keyword"}
                    </span>
                  )}
                </div>

                {/* Destra — sync badge + freccia */}
                <div className="flex items-center gap-3 shrink-0">
                  <SyncBadge lastSync={c.last_sync} />
                  <span className="text-[#ccc] group-hover:text-[#999] transition-colors text-sm">→</span>
                </div>
              </Link>
            ))}
          </div>

          {!loading && filtered.length === 0 && clients.length > 0 && (
            <p className="text-[#ababab] text-[13px]">Nessun cliente trovato.</p>
          )}
          {!loading && clients.length === 0 && !showForm && (
            <p className="text-[#ababab] text-[13px]">Nessun profilo ancora. Crea il primo cliente.</p>
          )}
        </Section>
      </div>
    </div>
  );
}

// ── Componenti locali ─────────────────────────────────────────────────────────

function SyncBadge({ lastSync }: { lastSync: string | null }) {
  if (!lastSync) return (
    <span className="text-[10px] text-[#c0c0c0]">Nessun sync</span>
  );
  const days = Math.floor((Date.now() - new Date(lastSync).getTime()) / 86400000);
  const color = days <= 7
    ? "text-green-500"
    : days <= 14
      ? "text-[#ababab]"
      : "text-orange-500";
  return (
    <span className={`text-[10px] font-medium ${color}`}>
      {days === 0 ? "sync oggi" : days === 1 ? "sync ieri" : `sync ${days}gg fa`}
    </span>
  );
}

function GlobalKpi({ clients }: { clients: Client[] }) {
  const totCrescita = clients.reduce((s, c) => s + c.keywords_crescita, 0);
  const totCalo     = clients.reduce((s, c) => s + c.keywords_calo,     0);
  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      <KpiCard label="Progetti attivi" value={clients.length} />
      <KpiCard
        label="Keyword in crescita"
        value={totCrescita}
        color={totCrescita > 0 ? "text-green-600" : undefined}
      />
      <KpiCard
        label="Keyword in calo"
        value={totCalo}
        color={totCalo > 0 ? "text-red-500" : undefined}
      />
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-xl border border-[#e8e8e8] bg-white p-4">
      <p className="text-[10px] font-medium text-[#ababab] uppercase tracking-wide mb-1.5">{label}</p>
      <p className={`text-[22px] font-semibold ${color ?? "text-[#1a1a1a]"}`}>{value}</p>
    </div>
  );
}

function TrendPct({ value }: { value: number }) {
  if (value === 0) return null;
  const positive = value > 0;
  return (
    <span className={`text-[10px] font-medium ${positive ? "text-green-600" : "text-red-500"}`}>
      {positive ? "+" : ""}{value}%
    </span>
  );
}

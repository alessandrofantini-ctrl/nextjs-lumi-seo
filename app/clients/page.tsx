"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader, Section, Card, Label, Input, Textarea, Select, Btn, Alert } from "@/components/ui";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

type Client = { id: string; name: string; url?: string; sector?: string; tone_of_voice?: string };

type NewClientForm = {
  name: string; url: string; sector: string; brand_name: string;
  tone_of_voice: string; usp: string; products_services: string;
  target_audience: string; geo: string; notes: string;
};

const EMPTY: NewClientForm = {
  name: "", url: "", sector: "", brand_name: "",
  tone_of_voice: "Autorevole & tecnico", usp: "",
  products_services: "", target_audience: "", geo: "", notes: "",
};

const TONES = ["Autorevole & tecnico", "Empatico & problem solving", "Diretto & commerciale"];

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
  const [openaiKey, setOpenaiKey]   = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") setOpenaiKey(localStorage.getItem("openai_key") || "");
    loadClients();
  }, []);

  async function loadClients() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/clients`);
      setClients(await r.json());
    } catch { setError("Errore caricamento clienti"); }
    finally { setLoading(false); }
  }

  async function handleAutoGenerate() {
    if (!autoUrl) return;
    if (!openaiKey) { setError("OpenAI key mancante — vai in Impostazioni."); return; }
    setGenerating(true); setError(null);
    try {
      const r = await fetch(`${API}/api/clients/auto-generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: autoUrl, openai_api_key: openaiKey }),
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
      const r = await fetch(`${API}/api/clients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

      <Section>
        {error && <div className="mb-5"><Alert type="error">{error}</Alert></div>}

        {/* Bottone nuovo */}
        {!showForm ? (
          <Btn onClick={() => { setShowForm(true); setError(null); }} className="mb-6">
            + Nuovo cliente
          </Btn>
        ) : (
          /* ── Form nuovo cliente ── */
          <Card className="mb-8 p-6">
            <h2 className="text-[13px] font-semibold text-white/70 mb-5">Nuovo profilo cliente</h2>

            {/* Auto-generate */}
            <div className="mb-5 p-4 rounded-lg bg-white/[0.02] border border-white/[0.06]">
              <p className="text-[11px] font-medium text-white/40 uppercase tracking-wide mb-3">
                Genera da URL sito
              </p>
              <div className="flex gap-2">
                <Input
                  value={autoUrl}
                  onChange={(e) => setAutoUrl(e.target.value)}
                  placeholder="https://www.cliente.it"
                />
                <Btn onClick={handleAutoGenerate} loading={generating} disabled={!autoUrl} className="shrink-0">
                  {generating ? "Analisi…" : "Analizza"}
                </Btn>
              </div>
              {!openaiKey && (
                <p className="text-[11px] text-white/25 mt-2">
                  ⚠ OpenAI key mancante —{" "}
                  <Link href="/impostazioni" className="text-white/50 hover:text-white/70 underline underline-offset-2">
                    Impostazioni
                  </Link>
                </p>
              )}
            </div>

            <form onSubmit={createClient} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Nome identificativo *</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Rossi Impianti Srl" /></div>
                <div><Label>URL sito</Label><Input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://www.cliente.it" /></div>
                <div><Label>Settore</Label><Input value={form.sector} onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value }))} placeholder="Impianti industriali" /></div>
                <div><Label>Brand name</Label><Input value={form.brand_name} onChange={(e) => setForm((f) => ({ ...f, brand_name: e.target.value }))} placeholder="Rossi Impianti" /></div>
                <div><Label>Zona geografica</Label><Input value={form.geo} onChange={(e) => setForm((f) => ({ ...f, geo: e.target.value }))} placeholder="Nord Italia" /></div>
                <div>
                  <Label>Tono di voce</Label>
                  <Select value={form.tone_of_voice} onChange={(e) => setForm((f) => ({ ...f, tone_of_voice: e.target.value }))}>
                    {TONES.map((t) => <option key={t}>{t}</option>)}
                  </Select>
                </div>
                <div className="col-span-2"><Label>Target audience</Label><Input value={form.target_audience} onChange={(e) => setForm((f) => ({ ...f, target_audience: e.target.value }))} placeholder="PMI manifatturiere" /></div>
              </div>
              <div><Label>Prodotti / Servizi *</Label><Textarea rows={4} value={form.products_services} onChange={(e) => setForm((f) => ({ ...f, products_services: e.target.value }))} placeholder="Un prodotto/servizio per riga" /></div>
              <div><Label>USP / Punti di forza</Label><Textarea rows={2} value={form.usp} onChange={(e) => setForm((f) => ({ ...f, usp: e.target.value }))} placeholder="Cosa distingue questo cliente?" /></div>
              <div><Label>Note strategiche SEO</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Istruzioni particolari per i prompt GPT" /></div>

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
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca per nome o settore…"
            />
          </div>
        )}

        {/* Lista */}
        {loading && <p className="text-white/25 text-[13px]">Caricamento…</p>}

        <div className="flex flex-col gap-1.5">
          {filtered.map((c) => (
            <Link
              key={c.id}
              href={`/clients/${c.id}`}
              className="group flex items-center justify-between px-4 py-3 rounded-lg border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.04] hover:border-white/[0.11] transition-all"
            >
              <div>
                <p className="text-[13px] font-medium text-white/80 group-hover:text-white transition-colors">
                  {c.name}
                </p>
                <p className="text-[11px] text-white/30 mt-0.5">
                  {[c.sector, c.tone_of_voice].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <span className="text-white/15 group-hover:text-white/40 transition-colors text-sm">→</span>
            </Link>
          ))}
        </div>

        {!loading && filtered.length === 0 && clients.length > 0 && (
          <p className="text-white/25 text-[13px]">Nessun cliente trovato.</p>
        )}
        {!loading && clients.length === 0 && !showForm && (
          <p className="text-white/25 text-[13px]">Nessun profilo ancora. Crea il primo cliente.</p>
        )}
      </Section>
    </div>
  );
}

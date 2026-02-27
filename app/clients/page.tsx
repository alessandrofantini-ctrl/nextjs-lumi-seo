"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

type Client = {
  id: string;
  name: string;
  url?: string;
  sector?: string;
  tone_of_voice?: string;
};

type NewClientForm = {
  name: string;
  url: string;
  sector: string;
  brand_name: string;
  tone_of_voice: string;
  usp: string;
  products_services: string;
  target_audience: string;
  geo: string;
  notes: string;
};

const EMPTY_FORM: NewClientForm = {
  name: "",
  url: "",
  sector: "",
  brand_name: "",
  tone_of_voice: "Autorevole & tecnico",
  usp: "",
  products_services: "",
  target_audience: "",
  geo: "",
  notes: "",
};

const TONE_OPTIONS = [
  "Autorevole & tecnico",
  "Empatico & problem solving",
  "Diretto & commerciale",
];

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewClientForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  // Auto-generate state
  const [autoUrl, setAutoUrl] = useState("");
  const [openaiKey, setOpenaiKey] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("openai_key") || "" : ""
  );
  const [generating, setGenerating] = useState(false);

  const loadClients = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/clients`);
      const data = await res.json();
      setClients(data);
    } catch {
      setError("Errore nel caricamento clienti");
    } finally {
      setLoading(false);
    }
  };

  const handleAutoGenerate = async () => {
    if (!autoUrl) return;
    if (!openaiKey) { setError("Inserisci la OpenAI key nelle Impostazioni (o nel campo qui sopra)."); return; }
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/clients/auto-generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: autoUrl, openai_api_key: openaiKey }),
      });
      if (!res.ok) throw new Error("Errore generazione profilo");
      const data = await res.json();
      setForm((prev) => ({ ...prev, ...data, url: autoUrl }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Errore generazione profilo");
    } finally {
      setGenerating(false);
    }
  };

  const createClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Il nome è obbligatorio."); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/clients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Errore creazione cliente");
      }
      setForm(EMPTY_FORM);
      setShowForm(false);
      loadClients();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Errore creazione cliente");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => { loadClients(); }, []);

  const filtered = clients.filter((c) =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.sector || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white/90">👤 Clienti</h1>
          <p className="text-white/40 text-sm mt-0.5">{clients.length} profili</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setError(null); }}
          className="px-4 py-2 rounded-lg bg-[#7c6af7] hover:bg-[#6b5ae6] text-white text-sm font-medium transition-colors"
        >
          {showForm ? "Annulla" : "➕ Nuovo cliente"}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Nuovo cliente */}
      {showForm && (
        <div className="mb-8 p-6 rounded-xl border border-white/[0.08] bg-white/[0.02]">
          <h2 className="text-white/80 font-medium mb-4">Nuovo profilo cliente</h2>

          {/* Auto-generate */}
          <div className="mb-5 p-4 rounded-lg bg-[#7c6af7]/5 border border-[#7c6af7]/20">
            <p className="text-[#a89ff9] text-sm font-medium mb-3">🤖 Genera automaticamente da URL</p>
            <div className="flex gap-2">
              <input
                value={autoUrl}
                onChange={(e) => setAutoUrl(e.target.value)}
                placeholder="https://www.cliente.it"
                className="flex-1 px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white/80 text-sm placeholder:text-white/20 focus:outline-none focus:border-[#7c6af7]/50"
              />
              <button
                onClick={handleAutoGenerate}
                disabled={generating || !autoUrl}
                className="px-4 py-2 rounded-lg bg-[#7c6af7]/80 hover:bg-[#7c6af7] text-white text-sm font-medium transition-colors disabled:opacity-40"
              >
                {generating ? "Analisi…" : "Analizza"}
              </button>
            </div>
            {!openaiKey && (
              <p className="text-white/30 text-xs mt-2">
                ⚠️ OpenAI key non trovata —{" "}
                <Link href="/impostazioni" className="text-[#7c6af7] hover:underline">configurala nelle Impostazioni</Link>
              </p>
            )}
          </div>

          <form onSubmit={createClient} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nome identificativo *" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Es. Rossi Impianti Srl" />
              <Field label="URL sito" value={form.url} onChange={(v) => setForm((f) => ({ ...f, url: v }))} placeholder="https://www.cliente.it" />
              <Field label="Settore" value={form.sector} onChange={(v) => setForm((f) => ({ ...f, sector: v }))} placeholder="Es. Impianti industriali" />
              <Field label="Brand name" value={form.brand_name} onChange={(v) => setForm((f) => ({ ...f, brand_name: v }))} placeholder="Es. Rossi Impianti" />
              <Field label="Zona geografica" value={form.geo} onChange={(v) => setForm((f) => ({ ...f, geo: v }))} placeholder="Es. Nord Italia" />
              <div className="flex flex-col gap-1">
                <label className="text-white/50 text-xs">Tono di voce</label>
                <select
                  value={form.tone_of_voice}
                  onChange={(e) => setForm((f) => ({ ...f, tone_of_voice: e.target.value }))}
                  className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white/80 text-sm focus:outline-none focus:border-[#7c6af7]/50"
                >
                  {TONE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <Field label="Target audience" value={form.target_audience} onChange={(v) => setForm((f) => ({ ...f, target_audience: v }))} placeholder="Es. PMI manifatturiere" />
            </div>
            <TextareaField label="Prodotti / Servizi *" value={form.products_services} onChange={(v) => setForm((f) => ({ ...f, products_services: v }))} placeholder="Un prodotto/servizio per riga" rows={4} />
            <TextareaField label="USP / Punti di forza" value={form.usp} onChange={(v) => setForm((f) => ({ ...f, usp: v }))} placeholder="Cosa distingue questo cliente?" rows={2} />
            <TextareaField label="Note strategiche SEO" value={form.notes} onChange={(v) => setForm((f) => ({ ...f, notes: v }))} placeholder="Istruzioni particolari per i prompt GPT" rows={2} />

            <button
              type="submit"
              disabled={saving}
              className="mt-2 px-6 py-2.5 rounded-lg bg-[#7c6af7] hover:bg-[#6b5ae6] text-white text-sm font-medium transition-colors disabled:opacity-40"
            >
              {saving ? "Salvataggio…" : "✅ Salva cliente"}
            </button>
          </form>
        </div>
      )}

      {/* Cerca */}
      {clients.length > 0 && (
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Cerca per nome o settore…"
          className="w-full mb-4 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.07] text-white/70 text-sm placeholder:text-white/20 focus:outline-none focus:border-[#7c6af7]/40"
        />
      )}

      {/* Lista */}
      {loading && <p className="text-white/30 text-sm">Caricamento…</p>}

      <div className="flex flex-col gap-2">
        {filtered.map((c) => (
          <Link
            key={c.id}
            href={`/clients/${c.id}`}
            className="flex items-center justify-between p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-[#7c6af7]/30 hover:bg-white/[0.04] transition-all group"
          >
            <div>
              <p className="text-white/90 font-medium group-hover:text-[#a89ff9] transition-colors">
                {c.name}
              </p>
              <p className="text-white/35 text-xs mt-0.5">
                {c.sector || "—"}
                {c.tone_of_voice && ` · ${c.tone_of_voice}`}
              </p>
            </div>
            <span className="text-white/20 group-hover:text-[#7c6af7] transition-colors text-sm">→</span>
          </Link>
        ))}
      </div>

      {!loading && filtered.length === 0 && clients.length > 0 && (
        <p className="text-white/30 text-sm">Nessun cliente trovato.</p>
      )}
      {!loading && clients.length === 0 && !showForm && (
        <p className="text-white/30 text-sm">Nessun profilo ancora. Crea il primo cliente.</p>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-white/50 text-xs">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white/80 text-sm placeholder:text-white/20 focus:outline-none focus:border-[#7c6af7]/50"
      />
    </div>
  );
}

function TextareaField({ label, value, onChange, placeholder, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-white/50 text-xs">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white/80 text-sm placeholder:text-white/20 focus:outline-none focus:border-[#7c6af7]/50 resize-none"
      />
    </div>
  );
}

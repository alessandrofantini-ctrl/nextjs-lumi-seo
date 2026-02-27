"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

type Client = { id: string; name: string };

const MARKETS = [
  "🇮🇹 Italia",
  "🇺🇸 USA (English)",
  "🇬🇧 UK",
  "🇪🇸 Spagna",
  "🇫🇷 Francia",
  "🇩🇪 Germania",
];

const INTENTS = ["Informativo", "Commerciale", "Navigazionale"];

export default function SeoPage() {
  const [clients, setClients] = useState<Client[]>([]);

  // Form
  const [keyword, setKeyword] = useState("");
  const [clientId, setClientId] = useState("");
  const [market, setMarket] = useState("🇮🇹 Italia");
  const [intent, setIntent] = useState("Informativo");
  const [maxCompetitors, setMaxCompetitors] = useState(6);
  const [includeSchema, setIncludeSchema] = useState(true);

  // API keys (localStorage)
  const [openaiKey, setOpenaiKey] = useState("");
  const [serpKey, setSerpKey] = useState("");

  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ brief_output: string; competitors_analysed: number } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOpenaiKey(localStorage.getItem("openai_key") || "");
      setSerpKey(localStorage.getItem("serp_key") || "");
    }
    fetch(`${API}/api/clients`).then((r) => r.json()).then(setClients).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) { setError("Inserisci la keyword principale."); return; }
    if (!openaiKey)       { setError("OpenAI key mancante — configurala nelle Impostazioni."); return; }
    if (!serpKey)         { setError("SerpAPI key mancante — configurala nelle Impostazioni."); return; }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`${API}/api/seo/analyse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword,
          client_id: clientId || null,
          market,
          intent,
          max_competitors: maxCompetitors,
          include_schema: includeSchema,
          openai_api_key: openaiKey,
          serp_api_key: serpKey,
          save_brief: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Errore analisi SEO");
      }

      const data = await res.json();
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Errore analisi SEO");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (result?.brief_output) navigator.clipboard.writeText(result.brief_output);
  };

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-semibold text-white/90 mb-1">🔎 Analisi SEO</h1>
      <p className="text-white/40 text-sm mb-8">
        Genera un brief editoriale analizzando SERP e competitor.
      </p>

      {!openaiKey || !serpKey ? (
        <div className="mb-6 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm">
          ⚠️ Configura le API key nelle{" "}
          <a href="/impostazioni" className="underline hover:text-yellow-300">Impostazioni</a>{" "}
          prima di avviare un&apos;analisi.
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Keyword + intent */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-white/50 text-xs">Keyword principale *</label>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Es. impianti elettrici industriali"
              className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white/80 text-sm placeholder:text-white/20 focus:outline-none focus:border-[#7c6af7]/50"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-white/50 text-xs">Intento</label>
            <select
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white/70 text-sm focus:outline-none focus:border-[#7c6af7]/50"
            >
              {INTENTS.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
        </div>

        {/* Cliente + Mercato */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-white/50 text-xs">Cliente (opzionale)</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white/70 text-sm focus:outline-none focus:border-[#7c6af7]/50"
            >
              <option value="">— Nessun profilo —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-white/50 text-xs">Mercato</label>
            <select
              value={market}
              onChange={(e) => setMarket(e.target.value)}
              className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white/70 text-sm focus:outline-none focus:border-[#7c6af7]/50"
            >
              {MARKETS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        {/* Opzioni avanzate */}
        <div className="flex items-center gap-6 text-sm text-white/50">
          <label className="flex items-center gap-2">
            <span>Competitor da analizzare:</span>
            <select
              value={maxCompetitors}
              onChange={(e) => setMaxCompetitors(Number(e.target.value))}
              className="px-2 py-1 rounded bg-black/30 border border-white/10 text-white/70 text-sm focus:outline-none"
            >
              {[3, 4, 5, 6, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeSchema}
              onChange={(e) => setIncludeSchema(e.target.checked)}
              className="rounded"
            />
            <span>Estrai JSON-LD schema</span>
          </label>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 rounded-lg bg-[#7c6af7] hover:bg-[#6b5ae6] text-white text-sm font-medium transition-colors disabled:opacity-40 w-fit"
        >
          {loading ? "Analisi in corso…" : "🚀 Avvia analisi"}
        </button>
      </form>

      {loading && (
        <div className="mt-8 p-6 rounded-xl border border-white/[0.07] bg-white/[0.02]">
          <p className="text-white/50 text-sm animate-pulse">
            ⏳ Recupero SERP → Scraping competitor → Generazione brief GPT-4o…
          </p>
          <p className="text-white/25 text-xs mt-1">Può richiedere 30-60 secondi.</p>
        </div>
      )}

      {result && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <p className="text-white/70 text-sm">
              ✅ Brief generato · {result.competitors_analysed} competitor analizzati
            </p>
            <button
              onClick={copyToClipboard}
              className="px-3 py-1.5 rounded-lg border border-white/10 text-white/50 hover:text-white/80 text-xs transition-colors"
            >
              📋 Copia
            </button>
          </div>
          <pre className="p-5 rounded-xl border border-white/[0.07] bg-black/40 text-white/75 text-sm whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
            {result.brief_output}
          </pre>
        </div>
      )}
    </div>
  );
}

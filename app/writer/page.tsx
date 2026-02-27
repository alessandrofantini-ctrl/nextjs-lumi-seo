"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

type Brief = {
  id: string;
  keyword: string;
  market: string;
  intent: string;
  created_at: string;
};

const LENGTHS = ["Standard", "Long form", "Authority guide"];

export default function WriterPage() {
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [briefId, setBriefId] = useState("");
  const [briefText, setBriefText] = useState("");
  const [brandName, setBrandName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [length, setLength] = useState("Long form");
  const [creativity, setCreativity] = useState(0.35);
  const [openaiKey, setOpenaiKey] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [article, setArticle] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOpenaiKey(localStorage.getItem("openai_key") || "");
    }
    fetch(`${API}/api/seo/briefs`)
      .then((r) => r.json())
      .then(setBriefs)
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!briefId && !briefText.trim()) {
      setError("Seleziona un brief salvato o incolla il testo del brief.");
      return;
    }
    if (!openaiKey) {
      setError("OpenAI key mancante — configurala nelle Impostazioni.");
      return;
    }

    setLoading(true);
    setError(null);
    setArticle(null);

    try {
      const res = await fetch(`${API}/api/writer/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief_id: briefId || null,
          brief_text: briefText || null,
          brand_name: brandName,
          target_page_url: targetUrl,
          length,
          creativity,
          openai_api_key: openaiKey,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Errore generazione articolo");
      }

      const data = await res.json();
      setArticle(data.article);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Errore generazione articolo");
    } finally {
      setLoading(false);
    }
  };

  const downloadMarkdown = () => {
    if (!article) return;
    const blob = new Blob([article], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "articolo-seo.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-semibold text-white/90 mb-1">✍️ Redattore articoli</h1>
      <p className="text-white/40 text-sm mb-8">
        Trasforma un brief SEO in un articolo completo con GPT-4o.
      </p>

      {!openaiKey && (
        <div className="mb-6 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm">
          ⚠️ Configura la OpenAI key nelle{" "}
          <a href="/impostazioni" className="underline hover:text-yellow-300">Impostazioni</a>.
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Brief: selezione da salvati o testo manuale */}
        <div className="flex flex-col gap-1">
          <label className="text-white/50 text-xs">Brief salvato (opzionale)</label>
          <select
            value={briefId}
            onChange={(e) => { setBriefId(e.target.value); if (e.target.value) setBriefText(""); }}
            className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white/70 text-sm focus:outline-none focus:border-[#7c6af7]/50"
          >
            <option value="">— Oppure incolla il testo qui sotto —</option>
            {briefs.map((b) => (
              <option key={b.id} value={b.id}>
                {b.keyword} · {b.market} · {new Date(b.created_at).toLocaleDateString()}
              </option>
            ))}
          </select>
        </div>

        {!briefId && (
          <div className="flex flex-col gap-1">
            <label className="text-white/50 text-xs">Brief SEO (testo)</label>
            <textarea
              value={briefText}
              onChange={(e) => setBriefText(e.target.value)}
              placeholder="Incolla qui il brief generato dall'Analisi SEO…"
              rows={10}
              className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white/75 text-sm placeholder:text-white/20 focus:outline-none focus:border-[#7c6af7]/50 resize-y font-mono"
            />
          </div>
        )}

        {/* Impostazioni articolo */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-white/50 text-xs">Brand name (opzionale)</label>
            <input
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="Es. Rossi Impianti"
              className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white/80 text-sm placeholder:text-white/20 focus:outline-none focus:border-[#7c6af7]/50"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-white/50 text-xs">URL CTA (opzionale)</label>
            <input
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://www.cliente.it/contatti"
              className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white/80 text-sm placeholder:text-white/20 focus:outline-none focus:border-[#7c6af7]/50"
            />
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm text-white/50">
          <label className="flex items-center gap-2">
            <span>Lunghezza:</span>
            <select
              value={length}
              onChange={(e) => setLength(e.target.value)}
              className="px-2 py-1 rounded bg-black/30 border border-white/10 text-white/70 text-sm focus:outline-none"
            >
              {LENGTHS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span>Creatività: {creativity.toFixed(2)}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={creativity}
              onChange={(e) => setCreativity(Number(e.target.value))}
              className="w-24 accent-[#7c6af7]"
            />
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
          {loading ? "Generazione in corso…" : "✍️ Genera articolo"}
        </button>
      </form>

      {loading && (
        <div className="mt-8 p-6 rounded-xl border border-white/[0.07] bg-white/[0.02]">
          <p className="text-white/50 text-sm animate-pulse">
            ⏳ GPT-4o sta scrivendo l&apos;articolo…
          </p>
          <p className="text-white/25 text-xs mt-1">Può richiedere 30-60 secondi.</p>
        </div>
      )}

      {article && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <p className="text-white/70 text-sm">✅ Articolo generato</p>
            <div className="flex gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(article)}
                className="px-3 py-1.5 rounded-lg border border-white/10 text-white/50 hover:text-white/80 text-xs transition-colors"
              >
                📋 Copia
              </button>
              <button
                onClick={downloadMarkdown}
                className="px-3 py-1.5 rounded-lg border border-white/10 text-white/50 hover:text-white/80 text-xs transition-colors"
              >
                ⬇️ Scarica .md
              </button>
            </div>
          </div>
          <pre className="p-5 rounded-xl border border-white/[0.07] bg-black/40 text-white/75 text-sm whitespace-pre-wrap leading-relaxed overflow-x-auto">
            {article}
          </pre>
        </div>
      )}
    </div>
  );
}

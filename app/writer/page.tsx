"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader, Section, Label, Select, Textarea, Btn, Alert } from "@/components/ui";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

type Brief = { id: string; keyword: string; market: string; created_at: string };

const LENGTHS = ["Standard", "Long form", "Authority guide"];

export default function WriterPage() {
  const [briefs, setBriefs]         = useState<Brief[]>([]);
  const [briefId, setBriefId]       = useState("");
  const [briefText, setBriefText]   = useState("");
  const [brandName, setBrandName]   = useState("");
  const [targetUrl, setTargetUrl]   = useState("");
  const [length, setLength]         = useState("Long form");
  const [creativity, setCreativity] = useState(0.35);
  const [openaiKey, setOpenaiKey]   = useState("");
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [article, setArticle]       = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") setOpenaiKey(localStorage.getItem("openai_key") || "");
    fetch(`${API}/api/seo/briefs`).then((r) => r.json()).then(setBriefs).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!briefId && !briefText.trim()) {
      setError("Seleziona un brief salvato oppure incolla il testo del brief."); return;
    }
    if (!openaiKey) { setError("OpenAI key mancante — vai in Impostazioni."); return; }
    setLoading(true); setError(null); setArticle(null);
    try {
      const r = await fetch(`${API}/api/writer/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief_id: briefId || null, brief_text: briefText || null,
          brand_name: brandName, target_page_url: targetUrl,
          length, creativity, openai_api_key: openaiKey,
        }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.detail || "Errore"); }
      const data = await r.json();
      setArticle(data.article);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Errore generazione");
    } finally { setLoading(false); }
  }

  function downloadMd() {
    if (!article) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([article], { type: "text/markdown" }));
    a.download = "articolo-seo.md";
    a.click();
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Redattore articoli" subtitle="Trasforma un brief SEO in un articolo completo con GPT-4o." />

      <Section>
        {!openaiKey && (
          <div className="mb-6">
            <Alert type="warn">
              OpenAI key mancante —{" "}
              <Link href="/impostazioni" className="underline underline-offset-2 hover:text-yellow-300">
                Impostazioni
              </Link>
            </Alert>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <Label>Brief salvato</Label>
            <Select
              value={briefId}
              onChange={(e) => { setBriefId(e.target.value); if (e.target.value) setBriefText(""); }}
            >
              <option value="">— Oppure incolla il testo qui sotto —</option>
              {briefs.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.keyword} · {b.market} · {new Date(b.created_at).toLocaleDateString("it-IT")}
                </option>
              ))}
            </Select>
          </div>

          {!briefId && (
            <div>
              <Label>Testo brief</Label>
              <Textarea
                value={briefText}
                onChange={(e) => setBriefText(e.target.value)}
                placeholder="Incolla qui il brief generato dall'Analisi SEO…"
                rows={10}
                className="font-mono text-[12px]"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Brand name (opzionale)</Label>
              <input
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="Rossi Impianti"
                className="w-full px-3 py-2 rounded-lg bg-[#1a1a1a] border border-white/[0.09] text-white/80 text-[13px] placeholder:text-white/20 focus:outline-none focus:border-white/20 transition-colors"
              />
            </div>
            <div>
              <Label>URL CTA (opzionale)</Label>
              <input
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://www.cliente.it/contatti"
                className="w-full px-3 py-2 rounded-lg bg-[#1a1a1a] border border-white/[0.09] text-white/80 text-[13px] placeholder:text-white/20 focus:outline-none focus:border-white/20 transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <Label>Lunghezza:</Label>
              <Select value={length} onChange={(e) => setLength(e.target.value)} className="w-44">
                {LENGTHS.map((l) => <option key={l}>{l}</option>)}
              </Select>
            </div>
            <label className="flex items-center gap-3 text-[13px] text-white/45 select-none">
              <span>Creatività {creativity.toFixed(2)}</span>
              <input
                type="range" min={0} max={1} step={0.05} value={creativity}
                onChange={(e) => setCreativity(Number(e.target.value))}
                className="w-28 accent-[#7c6af7]"
              />
            </label>
          </div>

          {error && <Alert type="error">{error}</Alert>}

          <Btn type="submit" loading={loading}>
            {loading ? "Generazione in corso…" : "Genera articolo"}
          </Btn>
        </form>

        {loading && (
          <div className="mt-8 px-4 py-5 rounded-lg border border-white/[0.06] bg-white/[0.01]">
            <p className="text-[13px] text-white/40 animate-pulse">GPT-4o sta scrivendo l&apos;articolo…</p>
            <p className="text-[11px] text-white/20 mt-1">Può richiedere 30–60 secondi.</p>
          </div>
        )}

        {article && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[12px] text-white/35">Articolo generato</p>
              <div className="flex gap-2">
                <Btn variant="ghost" onClick={() => navigator.clipboard.writeText(article)}>Copia</Btn>
                <Btn variant="ghost" onClick={downloadMd}>Scarica .md</Btn>
              </div>
            </div>
            <pre className="p-5 rounded-xl border border-white/[0.07] bg-black/30 text-white/70 text-[12.5px] whitespace-pre-wrap leading-relaxed overflow-x-auto">
              {article}
            </pre>
          </div>
        )}
      </Section>
    </div>
  );
}

"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageHeader, Section, Label, Input, Select, Btn, Alert } from "@/components/ui";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

type Client = { id: string; name: string };

const MARKETS = [
  "🇮🇹 Italia", "🇺🇸 USA (English)", "🇬🇧 UK",
  "🇪🇸 Spagna", "🇫🇷 Francia", "🇩🇪 Germania",
];
const INTENTS = ["Informativo", "Commerciale", "Navigazionale"];

function SeoForm() {
  const searchParams = useSearchParams();
  const [clients, setClients]       = useState<Client[]>([]);
  const [keyword, setKeyword]       = useState(searchParams.get("keyword") ?? "");
  const [clientId, setClientId]     = useState(searchParams.get("client_id") ?? "");
  const [market, setMarket]         = useState("🇮🇹 Italia");
  const [intent, setIntent]         = useState("Informativo");
  const [maxComp, setMaxComp]       = useState(6);
  const [schema, setSchema]         = useState(true);
  const [openaiKey, setOpenaiKey]   = useState("");
  const [serpKey, setSerpKey]       = useState("");
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [result, setResult]         = useState<{ brief_output: string; competitors_analysed: number } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOpenaiKey(localStorage.getItem("openai_key") || "");
      setSerpKey(localStorage.getItem("serp_key") || "");
    }
    fetch(`${API}/api/clients`).then((r) => r.json()).then((data) => {
      setClients(data);
    }).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!keyword.trim()) { setError("Inserisci la keyword principale."); return; }
    if (!openaiKey)       { setError("OpenAI key mancante — vai in Impostazioni."); return; }
    if (!serpKey)         { setError("SerpAPI key mancante — vai in Impostazioni."); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const r = await fetch(`${API}/api/seo/analyse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword, client_id: clientId || null, market, intent,
          max_competitors: maxComp, include_schema: schema,
          openai_api_key: openaiKey, serp_api_key: serpKey, save_brief: true,
        }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.detail || "Errore analisi"); }
      setResult(await r.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Errore analisi SEO");
    } finally { setLoading(false); }
  }

  const missingKeys = !openaiKey || !serpKey;

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Analisi SEO" subtitle="Genera un brief editoriale analizzando SERP e competitor." />

      <Section>
        {missingKeys && (
          <div className="mb-6">
            <Alert type="warn">
              API key mancanti —{" "}
              <Link href="/impostazioni" className="underline underline-offset-2 hover:text-yellow-700">
                configurale in Impostazioni
              </Link>{" "}
              prima di avviare un&apos;analisi.
            </Alert>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Keyword + intent */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Label>Keyword principale *</Label>
              <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Es. impianti elettrici industriali" />
            </div>
            <div>
              <Label>Intento</Label>
              <Select value={intent} onChange={(e) => setIntent(e.target.value)}>
                {INTENTS.map((i) => <option key={i}>{i}</option>)}
              </Select>
            </div>
          </div>

          {/* Cliente + mercato */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Cliente (opzionale)</Label>
              <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">— Nessun profilo —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div>
              <Label>Mercato</Label>
              <Select value={market} onChange={(e) => setMarket(e.target.value)}>
                {MARKETS.map((m) => <option key={m}>{m}</option>)}
              </Select>
            </div>
          </div>

          {/* Opzioni */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Label>Competitor:</Label>
              <Select value={maxComp} onChange={(e) => setMaxComp(Number(e.target.value))} className="w-16">
                {[3,4,5,6,8,10].map((n) => <option key={n}>{n}</option>)}
              </Select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-[13px] text-[#737373] select-none">
              <input type="checkbox" checked={schema} onChange={(e) => setSchema(e.target.checked)} className="accent-[#1a1a1a]" />
              Estrai JSON-LD schema
            </label>
          </div>

          {error && <Alert type="error">{error}</Alert>}

          <Btn type="submit" loading={loading}>
            {loading ? "Analisi in corso…" : "Avvia analisi"}
          </Btn>
        </form>

        {/* Loading state */}
        {loading && (
          <div className="mt-8 px-4 py-5 rounded-lg border border-[#e8e8e8] bg-[#f7f7f6]">
            <p className="text-[13px] text-[#ababab] animate-pulse">
              Recupero SERP → Scraping competitor → Generazione brief con GPT-4o…
            </p>
            <p className="text-[11px] text-[#c0c0c0] mt-1">Può richiedere 30–60 secondi.</p>
          </div>
        )}

        {/* Risultato */}
        {result && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[12px] text-[#8f8f8f]">
                {result.competitors_analysed} competitor analizzati
              </p>
              <Btn variant="ghost" onClick={() => navigator.clipboard.writeText(result.brief_output)}>
                Copia
              </Btn>
            </div>
            <pre className="p-5 rounded-xl border border-[#e8e8e8] bg-white text-[#444] text-[12.5px] whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
              {result.brief_output}
            </pre>
          </div>
        )}
      </Section>
    </div>
  );
}

export default function SeoPage() {
  return (
    <Suspense fallback={<div className="p-8 text-[#ababab] text-[13px]">Caricamento…</div>}>
      <SeoForm />
    </Suspense>
  );
}

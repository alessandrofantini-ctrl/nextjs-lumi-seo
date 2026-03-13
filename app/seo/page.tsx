"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageHeader, Section, Label, Input, Select, Btn, Alert } from "@/components/ui";
import { apiFetch } from "@/lib/api";

type Client = { id: string; name: string };

type JobStatus = "idle" | "pending" | "running" | "done" | "error";

type RecentJob = {
  id: string;
  keyword: string;
  market: string;
  status: "pending" | "running" | "done" | "error";
  created_at: string;
  updated_at: string;
};

const MARKETS = [
  "\ud83c\uddee\ud83c\uddf9 Italia", "\ud83c\uddfa\ud83c\uddf8 USA (English)", "\ud83c\uddec\ud83c\udde7 UK",
  "\ud83c\uddea\ud83c\uddf8 Spagna", "\ud83c\uddeb\ud83c\uddf7 Francia", "\ud83c\udde9\ud83c\uddea Germania",
];
const INTENTS = ["Informativo", "Commerciale", "Navigazionale"];

function JobStatusDot({ status }: { status: RecentJob["status"] }) {
  const cfg: Record<RecentJob["status"], string> = {
    pending: "bg-[#d0d0d0]",
    running: "bg-[#6366f1] animate-pulse",
    done:    "bg-[#22c55e]",
    error:   "bg-[#ef4444]",
  };
  return <div className={`w-2 h-2 rounded-full shrink-0 ${cfg[status]}`} />;
}

function SeoForm() {
  const searchParams = useSearchParams();
  const [clients, setClients]     = useState<Client[]>([]);
  const [keyword, setKeyword]     = useState(searchParams.get("keyword") ?? "");
  const [clientId, setClientId]   = useState(searchParams.get("client_id") ?? "");
  const [market, setMarket]       = useState("\ud83c\uddee\ud83c\uddf9 Italia");
  const [intent, setIntent]       = useState("Informativo");
  const [maxComp, setMaxComp]     = useState(6);
  const [schema, setSchema]       = useState(true);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [statusUpdated, setStatusUpdated] = useState(false);

  // Job / polling
  const [jobId, setJobId]         = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus>("idle");
  const pollRef                   = useRef<ReturnType<typeof setInterval> | null>(null);

  // Result states
  const [brief, setBrief]             = useState<string | null>(null);
  const [briefId, setBriefId]         = useState<string | null>(null);
  const [competitors, setCompetitors] = useState<number>(0);

  // Recent jobs
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);

  useEffect(() => {
    apiFetch("/api/clients")
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => setClients(Array.isArray(data) ? data : []))
      .catch(() => {});

    apiFetch("/api/seo/jobs")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setRecentJobs(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function startPolling(id: string) {
    if (pollRef.current) clearInterval(pollRef.current);

    const interval = setInterval(async () => {
      try {
        const r = await apiFetch(`/api/seo/jobs/${id}`);
        if (!r.ok) return;
        const job = await r.json();

        setJobStatus(job.status);

        if (job.status === "done") {
          clearInterval(interval);
          pollRef.current = null;
          setBrief(job.result.brief_output);
          setCompetitors(job.result.competitors_analysed);
          setBriefId(job.result.brief_id);
          if (clientId && keyword) {
            updateKeywordStatus(clientId, keyword);
          }
        }

        if (job.status === "error") {
          clearInterval(interval);
          pollRef.current = null;
          setError(job.error || "Errore durante l'analisi. Riprova.");
        }
      } catch { /* ignora errori di rete temporanei */ }
    }, 3000);

    pollRef.current = interval;
  }

  async function updateKeywordStatus(cId: string, kw: string) {
    try {
      const kwRes = await apiFetch(`/api/clients/${cId}`);
      if (!kwRes.ok) return;
      const clientData = await kwRes.json();
      const kwRecord = (clientData.keyword_history ?? []).find(
        (k: { keyword: string }) => k.keyword.toLowerCase() === kw.toLowerCase()
      );
      if (kwRecord && kwRecord.status === "planned") {
        await apiFetch(`/api/clients/${cId}/keywords/${kwRecord.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "brief_done" }),
        });
        setStatusUpdated(true);
      }
    } catch { /* silenzioso */ }
  }

  async function loadJobResult(id: string) {
    try {
      const r = await apiFetch(`/api/seo/jobs/${id}`);
      if (!r.ok) return;
      const job = await r.json();
      if (job.status !== "done" || !job.result) return;
      setBrief(job.result.brief_output);
      setCompetitors(job.result.competitors_analysed);
      setBriefId(job.result.brief_id);
      setJobStatus("done");
    } catch { /* ignora */ }
  }

  // briefId used — suppress unused warning
  void briefId;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!keyword.trim()) { setError("Inserisci la keyword principale."); return; }
    setLoading(true);
    setError(null);
    setBrief(null);
    setBriefId(null);
    setCompetitors(0);
    setJobId(null);
    setJobStatus("idle");
    setStatusUpdated(false);

    try {
      const r = await apiFetch("/api/seo/analyse", {
        method: "POST",
        body: JSON.stringify({
          keyword, client_id: clientId || null, market, intent,
          max_competitors: maxComp, include_schema: schema, save_brief: true,
        }),
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.detail || "Errore avvio analisi");
      }
      const { job_id } = await r.json();
      setJobId(job_id);
      setJobStatus("pending");
      startPolling(job_id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Errore");
      setJobStatus("idle");
    } finally {
      setLoading(false);
    }
  }

  // jobId used — suppress unused warning
  void jobId;

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Analisi SEO" subtitle="Genera un brief editoriale analizzando SERP e competitor." />

      <Section>
        {/* Analisi recenti */}
        {recentJobs.length > 0 && (
          <div className="mb-6">
            <p className="text-[11px] font-medium text-[#ababab] uppercase tracking-wide mb-2">
              Analisi recenti
            </p>
            <div className="flex flex-col gap-1">
              {recentJobs.slice(0, 5).map((job) => (
                <div
                  key={job.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-md border border-[#f0f0f0] bg-white text-[12px]"
                >
                  <JobStatusDot status={job.status} />
                  <span className="flex-1 font-medium text-[#1a1a1a] truncate">{job.keyword}</span>
                  <span className="text-[#ababab]">{job.market}</span>
                  {job.status === "done" && (
                    <button
                      onClick={() => loadJobResult(job.id)}
                      className="text-[#6366f1] text-[11px] font-medium hover:underline"
                    >
                      Carica \u2192
                    </button>
                  )}
                  {(job.status === "pending" || job.status === "running") && (
                    <button
                      onClick={() => {
                        setJobId(job.id);
                        setJobStatus(job.status);
                        startPolling(job.id);
                      }}
                      className="text-[#6366f1] text-[11px] font-medium hover:underline"
                    >
                      Monitora
                    </button>
                  )}
                </div>
              ))}
            </div>
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
                <option value="">\u2014 Nessun profilo \u2014</option>
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

          <Btn type="submit" loading={loading} disabled={loading || jobStatus === "pending" || jobStatus === "running"}>
            {loading ? "Avvio analisi\u2026" : "Avvia analisi"}
          </Btn>
        </form>

        {/* Progress state */}
        {(jobStatus === "pending" || jobStatus === "running") && (
          <div className="mt-6 px-4 py-5 rounded-lg border border-[#e8e8e8] bg-[#f7f7f6]">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-2 h-2 rounded-full bg-[#6366f1] animate-pulse" />
              <p className="text-[13px] font-medium text-[#1a1a1a]">
                {jobStatus === "pending" ? "Analisi in coda\u2026" : "Analisi in corso\u2026"}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              {[
                "Recupero risultati SERP",
                "Analisi competitor",
                "Generazione brief con GPT-4o",
              ].map((step) => (
                <div key={step} className="flex items-center gap-2 text-[12px] text-[#ababab]">
                  <div className="w-1 h-1 rounded-full bg-[#d0d0d0]" />
                  {step}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-[#c0c0c0] mt-3">
              Puoi cambiare pagina \u2014 il risultato sar\u00e0 disponibile in &ldquo;Analisi recenti&rdquo; al termine.
            </p>
          </div>
        )}

        {/* Risultato */}
        {brief && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[12px] text-[#8f8f8f]">
                {competitors} competitor analizzati
              </p>
              <Btn variant="ghost" onClick={() => navigator.clipboard.writeText(brief)}>
                Copia
              </Btn>
            </div>
            <pre className="p-5 rounded-xl border border-[#e8e8e8] bg-white text-[#444] text-[12.5px] whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
              {brief}
            </pre>
            {clientId && (
              <div className="mt-3 flex items-center justify-between">
                {statusUpdated ? (
                  <p className="text-[11px] text-green-600">
                    \u2713 Status keyword aggiornato a &ldquo;Brief pronto&rdquo;
                  </p>
                ) : (
                  <span />
                )}
                <Link
                  href={`/clients/${clientId}`}
                  className="text-[12px] text-[#737373] hover:text-[#1a1a1a] underline underline-offset-2"
                >
                  \u2190 Torna al cliente
                </Link>
              </div>
            )}
          </div>
        )}
      </Section>
    </div>
  );
}

export default function SeoPage() {
  return (
    <Suspense fallback={<div className="p-8 text-[#ababab] text-[13px]">Caricamento\u2026</div>}>
      <SeoForm />
    </Suspense>
  );
}

"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useMemo } from "react";
import Link from "next/link";
import { Label, Input, Textarea, Select, Btn, Alert, Card } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { detectCannibalization } from "@/lib/cannibalization";
import { CheckCircle, Circle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const TONES = ["Autorevole & tecnico", "Empatico & problem solving", "Diretto & commerciale"];

const LOCATION_OPTIONS = [
  { value: 2380, label: "Italia" },
  { value: 2840, label: "Stati Uniti" },
  { value: 2826, label: "Regno Unito" },
  { value: 2276, label: "Germania" },
  { value: 2250, label: "Francia" },
  { value: 2724, label: "Spagna" },
];

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  backlog:    { label: "In lista",     color: "#8f8f8f", bg: "#f5f5f4", border: "#e0e0e0" },
  planned:    { label: "Pianificata",  color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
  brief_done: { label: "Brief pronto", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  written:    { label: "Scritta",      color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  published:  { label: "Pubblicata",   color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
};
const STATUS_ORDER = ["backlog", "planned", "brief_done", "written", "published"];

const INTENT_CFG: Record<string, { label: string; color: string; bg: string }> = {
  informativo:    { label: "Info",   color: "#0369a1", bg: "#e0f2fe" },
  commerciale:    { label: "Comm",   color: "#7c3aed", bg: "#f5f3ff" },
  navigazionale:  { label: "Nav",    color: "#374151", bg: "#f3f4f6" },
  transazionale:  { label: "Trans",  color: "#b45309", bg: "#fef3c7" },
};

const PRIORITY_CFG: Record<string, { label: string; dot: string }> = {
  alta:  { label: "Alta",  dot: "#ef4444" },
  media: { label: "Media", dot: "#d1d5db" },
  bassa: { label: "Bassa", dot: "#86efac" },
};

type KW = {
  id: string; keyword: string; status: string; created_at: string;
  impressions?: number; clicks?: number; position?: number; ctr?: number;
  gsc_updated_at?: string; position_prev?: number; position_updated_at?: string;
  cluster?: string; intent?: string; priority?: string;
  search_volume?: number; volume_updated_at?: string;
};
type Brief = { id: string; keyword: string; market: string; intent: string; created_at: string };

type PositionSnapshot = {
  position: number;
  clicks: number;
  impressions: number;
  ctr: number;
  recorded_at: string;
};

type VisibilitySnapshot = {
  recorded_at: string;
  avg_position: number;
  total_clicks: number;
  total_impressions: number;
};

type ClientFull = {
  id: string; name: string; url?: string; sector?: string; brand_name?: string;
  tone_of_voice?: string; usp?: string; products_services?: string;
  target_audience?: string; geo?: string; notes?: string;
  gsc_property?: string; language_code?: string; location_code?: number;
  keyword_history: KW[]; briefs: Brief[];
  created_at?: string; updated_at?: string;
};

type EditForm = Omit<ClientFull, "id" | "keyword_history" | "briefs" | "created_at" | "updated_at">;


export default function ClientPage() {
  const { id }   = useParams();
  const router   = useRouter();
  const clientId = id as string;

  const [client, setClient]   = useState<ClientFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm]         = useState<EditForm>({ name: "" });
  const [saving, setSaving]     = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting]           = useState(false);

  // Tab navigation
  const [activeTab, setActiveTab] = useState<"keywords" | "monitoraggio" | "profilo">("monitoraggio");

  // GSC sync
  const [gscSyncing, setGscSyncing] = useState(false);
  const [gscResult, setGscResult]   = useState<{ synced: number; total: number } | null>(null);

  // Monitoraggio filters
  const [monFilter, setMonFilter] = useState<"all" | "top10" | "incalo" | "opportunita">("all");
  const [visibilityHistory, setVisibilityHistory] = useState<VisibilitySnapshot[]>([]);

  // keyword controls
  const [newKw, setNewKw]       = useState("");
  const [addingKw, setAddingKw] = useState(false);
  const [kwSearch, setKwSearch] = useState("");
  const [kwFilter, setKwFilter] = useState("all");
  const [kwSort, setKwSort]     = useState<"default" | "alpha" | "position" | "priority">("default");
  const [groupByCluster, setGroupByCluster] = useState(false);
  const [importing, setImporting]   = useState(false);
  const [importResult, setImportResult] = useState<{ added: number; skipped: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      const r = await apiFetch(`/api/clients/${clientId}`);
      if (!r.ok) throw new Error("Cliente non trovato");
      const data: ClientFull = await r.json();
      setClient(data);
      setForm({
        name: data.name, url: data.url || "", sector: data.sector || "",
        brand_name: data.brand_name || "", tone_of_voice: data.tone_of_voice || TONES[0],
        usp: data.usp || "", products_services: data.products_services || "",
        target_audience: data.target_audience || "", geo: data.geo || "", notes: data.notes || "",
        gsc_property: data.gsc_property || "",
        language_code: data.language_code || "it", location_code: data.location_code ?? 2380,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Errore caricamento");
    } finally { setLoading(false); }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const r = await apiFetch(`/api/clients/${clientId}`, {
        method: "PUT",
        body: JSON.stringify(form),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.detail || "Errore salvataggio"); }
      await load(); setEditMode(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Errore salvataggio");
    } finally { setSaving(false); }
  }

  async function deleteClient() {
    setDeleting(true);
    try {
      await apiFetch(`/api/clients/${clientId}`, { method: "DELETE" });
      router.push("/clients");
    } catch {
      setError("Errore eliminazione"); setDeleting(false);
    }
  }

  async function addKeyword(e: React.FormEvent) {
    e.preventDefault();
    if (!newKw.trim()) return;
    setAddingKw(true);
    try {
      await apiFetch(`/api/clients/${clientId}/keywords`, {
        method: "POST",
        body: JSON.stringify({ keyword: newKw }),
      });
      setNewKw(""); await load();
    } finally { setAddingKw(false); }
  }

  async function updateKeyword(kwId: string, fields: Partial<Pick<KW, "status" | "cluster" | "intent" | "priority">>) {
    await apiFetch(`/api/clients/${clientId}/keywords/${kwId}`, {
      method: "PATCH",
      body: JSON.stringify(fields),
    });
    setClient((c) => c ? {
      ...c,
      keyword_history: c.keyword_history.map((k) => k.id === kwId ? { ...k, ...fields } : k),
    } : c);
  }

  async function deleteKeyword(kwId: string) {
    await apiFetch(`/api/clients/${clientId}/keywords/${kwId}`, { method: "DELETE" });
    setClient((c) => c ? {
      ...c, keyword_history: c.keyword_history.filter((k) => k.id !== kwId),
    } : c);
  }

  async function clearKeywords() {
    await apiFetch(`/api/clients/${clientId}/keywords`, { method: "DELETE" });
    setClient((c) => c ? { ...c, keyword_history: [] } : c);
  }

  async function syncGSC() {
    setGscSyncing(true); setGscResult(null);
    try {
      const r = await apiFetch(`/api/clients/${clientId}/gsc-sync`, { method: "POST" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "Errore sincronizzazione GSC");
      setGscResult(data);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Errore sincronizzazione GSC");
    } finally { setGscSyncing(false); }
  }

  function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setImportResult(null);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).map((l) => l.split(",")[0].replace(/^["']|["']$/g, "").trim()).filter(Boolean);
      const firstLow = lines[0]?.toLowerCase();
      const keywords = ["keyword", "query", "parola chiave", "kw"].includes(firstLow)
        ? lines.slice(1) : lines;
      if (!keywords.length) { setImporting(false); return; }
      try {
        const r = await apiFetch(`/api/clients/${clientId}/keywords/bulk`, {
          method: "POST",
          body: JSON.stringify({ keywords }),
        });
        const data = await r.json();
        setImportResult(data);
        await load();
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  }

  useEffect(() => { load(); }, [clientId]);

  useEffect(() => {
    if (activeTab !== "monitoraggio" || !clientId) return;
    apiFetch(`/api/clients/${clientId}/visibility-history`)
      .then((r) => r.json())
      .then((data) => setVisibilityHistory(data.history ?? []))
      .catch(() => {});
  }, [activeTab, clientId]);

  // ── Derived keyword lists ────────────────────────────
  const processedKw = useMemo(() => {
    if (!client) return [];
    let list = client.keyword_history.filter((k) => {
      const matchSearch = !kwSearch || k.keyword.toLowerCase().includes(kwSearch.toLowerCase());
      const matchFilter = kwFilter === "all" || (k.status || "backlog") === kwFilter;
      return matchSearch && matchFilter;
    });
    if (kwSort === "alpha")    list = [...list].sort((a, b) => a.keyword.localeCompare(b.keyword));
    if (kwSort === "position") list = [...list].sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
    if (kwSort === "priority") {
      const order: Record<string, number> = { alta: 0, media: 1, bassa: 2 };
      list = [...list].sort((a, b) => (order[a.priority ?? "media"] ?? 1) - (order[b.priority ?? "media"] ?? 1));
    }
    return list;
  }, [client, kwSearch, kwFilter, kwSort]);

  const clusteredKw = useMemo(() => {
    const groups: Record<string, KW[]> = {};
    processedKw.forEach((k) => {
      const c = k.cluster?.trim() || "—";
      if (!groups[c]) groups[c] = [];
      groups[c].push(k);
    });
    return Object.entries(groups).sort(([a], [b]) => (a === "—" ? 1 : b === "—" ? -1 : a.localeCompare(b)));
  }, [processedKw]);

  const cannibalization = useMemo(() => detectCannibalization(client?.keyword_history ?? []), [client]);

  // ── Monitoraggio ─────────────────────────────
  const cannibSet = useMemo(() => {
    const s = new Set<string>();
    cannibalization.forEach((p) => { s.add(p.a); s.add(p.b); });
    return s;
  }, [cannibalization]);

  const kwWithGsc = useMemo(
    () => client?.keyword_history ?? [],
    [client],
  );

  const isOpportunita = (k: KW) =>
    (k.impressions ?? 0) > 100 && (k.position ?? 999) > 10 && k.status === "backlog";

  const filteredMonKw = useMemo(() => {
    const filtered = kwWithGsc.filter((k) => {
      if (monFilter === "top10")       return k.position != null && k.position <= 10;
      if (monFilter === "incalo")      return k.position_prev != null && k.position != null && k.position > k.position_prev;
      if (monFilter === "opportunita") return isOpportunita(k);
      return true;
    });
    return filtered.sort((a, b) => {
      if (a.position != null && b.position != null) return a.position - b.position;
      if (a.position != null) return -1;
      if (b.position != null) return 1;
      // Entrambe senza posizione: ordina per volume desc se disponibile
      if (a.search_volume != null && b.search_volume != null) return b.search_volume - a.search_volume;
      if (a.search_volume != null) return -1;
      if (b.search_volume != null) return 1;
      return a.keyword.localeCompare(b.keyword);
    });
  }, [kwWithGsc, monFilter]);

  const monKpi = useMemo(() => ({
    totale:      kwWithGsc.length,
    top10:       kwWithGsc.filter((k) => k.position != null && k.position <= 10).length,
    inCalo:      kwWithGsc.filter((k) => k.position_prev != null && k.position != null && k.position > k.position_prev).length,
    opportunita: kwWithGsc.filter(isOpportunita).length,
  }), [kwWithGsc]);

  const lastSync = useMemo(() => {
    const dates = client?.keyword_history
      .map((k) => k.gsc_updated_at)
      .filter(Boolean) as string[];
    if (!dates?.length) return null;
    return new Date(Math.max(...dates.map((d) => new Date(d).getTime())));
  }, [client]);

  if (loading) return <div className="p-8 text-[#ababab] text-[13px]">Caricamento…</div>;
  if (error && !client) return <div className="p-8 max-w-xl"><Alert type="error">{error}</Alert></div>;
  if (!client) return null;

  const kwCounts: Record<string, number> = {};
  client.keyword_history.forEach((k) => {
    const s = k.status || "backlog";
    kwCounts[s] = (kwCounts[s] || 0) + 1;
  });

  const syncLabel = (() => {
    if (!lastSync) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const syncDay = new Date(lastSync);
    syncDay.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today.getTime() - syncDay.getTime()) / 86400000);
    if (diffDays === 0) return { text: "sync oggi",            color: "#16a34a" };
    if (diffDays === 1) return { text: "sync ieri",            color: "#16a34a" };
    if (diffDays <= 7)  return { text: `sync ${diffDays}gg fa`, color: "#8f8f8f" };
    return                      { text: `sync ${diffDays}gg fa`, color: "#d97706" };
  })();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 pt-8 pb-6 border-b border-[#e8e8e8] bg-white">
        <Link href="/clients" className="text-[11px] text-[#ababab] hover:text-[#555] transition-colors mb-3 inline-block">
          ← Tutti i clienti
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[21px] font-semibold text-[#1a1a1a]">{client.name}</h1>
            <p className="text-[#8f8f8f] text-[13px] mt-0.5">
              {[client.sector, client.geo].filter(Boolean).join(" · ") || "—"}
              {client.updated_at && (
                <span className="ml-3 text-[#c0c0c0]">
                  aggiornato {new Date(client.updated_at).toLocaleDateString("it-IT")}
                </span>
              )}
              {syncLabel && (
                <span className="ml-3 text-[11px]" style={{ color: syncLabel.color }}>
                  {syncLabel.text}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {!editMode ? (
              <>
                <Btn variant="ghost" onClick={() => { setEditMode(true); setError(null); }}>Modifica</Btn>
                <Btn variant="danger" onClick={() => setConfirmDelete(true)}>Elimina</Btn>
              </>
            ) : (
              <Btn variant="ghost" onClick={() => { setEditMode(false); setError(null); }}>Annulla</Btn>
            )}
          </div>
        </div>
      </div>

      {confirmDelete && (
        <div className="px-8 pt-5">
          <Alert type="error">
            <p>Eliminare <strong>{client.name}</strong> e tutto il suo storico? L&apos;operazione è irreversibile.</p>
            <div className="flex gap-2 mt-3">
              <Btn variant="danger" onClick={deleteClient} loading={deleting}>Sì, elimina</Btn>
              <Btn variant="ghost" onClick={() => setConfirmDelete(false)}>Annulla</Btn>
            </div>
          </Alert>
        </div>
      )}

      <div className="flex-1 overflow-y-auto bg-[#f7f7f6]">
        <div className="px-8 py-7 flex flex-col gap-8">

          {error && <Alert type="error">{error}</Alert>}

          {!editMode ? (
            <>
              {/* ── KPI bar (sempre visibile) ── */}
              {monKpi.totale > 0 && (
                <div className="grid grid-cols-4 gap-3">
                  <MonKpiCard label="Monitorate" value={monKpi.totale} />
                  <MonKpiCard label="Top 10" value={monKpi.top10} />
                  <MonKpiCard label="In calo" value={monKpi.inCalo} warn={monKpi.inCalo > 0} />
                  <MonKpiCard label="Opportunità" value={monKpi.opportunita} warn={monKpi.opportunita > 0} />
                </div>
              )}

              {/* ── Tab navigation ── */}
              <div className="flex gap-1 border-b border-[#e8e8e8] -mb-4">
                <TabBtn active={activeTab === "monitoraggio"} onClick={() => setActiveTab("monitoraggio")}>
                  Monitoraggio {monKpi.totale > 0 && `(${monKpi.totale})`}
                </TabBtn>
                <TabBtn active={activeTab === "keywords"} onClick={() => setActiveTab("keywords")}>
                  Keyword ({client.keyword_history.length})
                </TabBtn>
                <TabBtn active={activeTab === "profilo"} onClick={() => setActiveTab("profilo")}>
                  Profilo
                </TabBtn>
              </div>

              {/* ── Profilo tab ── */}
              {activeTab === "profilo" && (
                <>
                  {(!client.usp || !client.tone_of_voice || !client.gsc_property) && (
                    <Alert type="warn">
                      <div className="flex items-center justify-between gap-3">
                        <span>
                          <strong>Profilo incompleto</strong> — aggiungi USP, Tono di voce e Proprietà GSC per ottenere brief di qualità migliore.
                        </span>
                        <button
                          onClick={() => { setEditMode(true); setError(null); }}
                          className="shrink-0 text-[12px] font-medium underline underline-offset-2 hover:no-underline whitespace-nowrap"
                        >
                          Modifica profilo →
                        </button>
                      </div>
                    </Alert>
                  )}
                  <SectionTitle>Profilo</SectionTitle>
                  <Card className="p-5">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-5">
                      <InfoItem label="URL sito"         value={client.url}             link />
                      <InfoItem label="Brand name"       value={client.brand_name}      />
                      <InfoItem label="Settore"          value={client.sector}          />
                      <InfoItem label="Zona geografica"  value={client.geo}             />
                      <InfoItem label="Tono di voce"     value={client.tone_of_voice}   />
                      <InfoItem label="Target audience"  value={client.target_audience} />
                      <InfoItem label="GSC Property"     value={client.gsc_property}    />
                    </div>
                    {client.products_services && <InfoBlock label="Prodotti / Servizi"  value={client.products_services} />}
                    {client.usp              && <InfoBlock label="USP / Punti di forza" value={client.usp}               />}
                    {client.notes            && <InfoBlock label="Note strategiche SEO" value={client.notes}             />}
                  </Card>
                </>
              )}

              {/* ── Keyword pipeline ── */}
              {activeTab === "keywords" && <div>
                {/* Toolbar */}
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-medium text-[#ababab] uppercase tracking-wide">
                    Keyword ({client.keyword_history.length})
                  </p>
                  <div className="flex items-center gap-2">
                    {client.gsc_property && (
                      <div className="flex flex-col items-end">
                        <button
                          onClick={syncGSC}
                          disabled={gscSyncing}
                          className="text-[11px] text-[#2563eb] hover:text-[#1d4ed8] border border-[#bfdbfe] hover:border-[#93c5fd] bg-[#eff6ff] rounded-md px-2.5 py-1 transition-colors disabled:opacity-50"
                        >
                          {gscSyncing ? "Sincronizzazione…" : "Sincronizza GSC"}
                        </button>
                        <p className="text-[10px] text-[#ababab] mt-1">
                          Sync automatico ogni lunedì
                        </p>
                      </div>
                    )}
                    <input ref={fileInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileImport} />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={importing}
                      className="text-[11px] text-[#737373] hover:text-[#1a1a1a] border border-[#e0e0e0] hover:border-[#ccc] rounded-md px-2.5 py-1 transition-colors disabled:opacity-50"
                    >
                      {importing ? "Importazione…" : "Importa CSV"}
                    </button>
                  </div>
                </div>

                {importResult && (
                  <div className="mb-3">
                    <Alert type="info">
                      Aggiunte <strong>{importResult.added}</strong> keyword
                      {importResult.skipped > 0 && `, ${importResult.skipped} già presenti saltate`}.
                    </Alert>
                  </div>
                )}
                {gscResult && (
                  <div className="mb-3">
                    <Alert type="info">
                      GSC: metriche aggiornate su <strong>{gscResult.synced}</strong> di <strong>{gscResult.total}</strong> keyword.
                      {gscResult.synced < gscResult.total && (
                        <span className="ml-1 opacity-70">Le restanti non compaiono ancora su Google.</span>
                      )}
                    </Alert>
                  </div>
                )}

                {/* Cannibalization warning */}
                {cannibalization.length > 0 && (
                  <div className="mb-3">
                    <Alert type="warn">
                      <strong>⚠ {cannibalization.length} possibile/i cannibalizzazione/i rilevata/e.</strong>
                      <ul className="mt-1.5 space-y-0.5">
                        {cannibalization.slice(0, 5).map((p, i) => (
                          <li key={i} className="text-[12px]">
                            <span className="font-medium">{p.intent}</span>: &ldquo;{p.a}&rdquo; vs &ldquo;{p.b}&rdquo;
                          </li>
                        ))}
                        {cannibalization.length > 5 && (
                          <li className="text-[12px] text-[#92400e]">+ {cannibalization.length - 5} altri…</li>
                        )}
                      </ul>
                      <p className="mt-1.5 text-[11px] opacity-70">Assegna un cluster diverso o unifica le keyword per evitare conflitti.</p>
                    </Alert>
                  </div>
                )}

                <Card className="p-5">
                  {/* Aggiungi singola */}
                  <form onSubmit={addKeyword} className="flex gap-2 mb-5">
                    <Input
                      value={newKw}
                      onChange={(e) => setNewKw(e.target.value)}
                      placeholder="Aggiungi keyword…"
                      className="flex-1"
                    />
                    <Btn type="submit" loading={addingKw} disabled={!newKw.trim()}>Aggiungi</Btn>
                  </form>

                  {client.keyword_history.length === 0 ? (
                    <OnboardingSteps
                      hasKeywords={client.keyword_history.length > 0}
                      hasGsc={client.keyword_history.some((k) => k.gsc_updated_at != null)}
                      hasBrief={client.briefs.length > 0}
                    />
                  ) : (
                    <>
                      {/* Search + Sort + View */}
                      <div className="flex gap-2 items-center mb-4">
                        <Input
                          value={kwSearch}
                          onChange={(e) => setKwSearch(e.target.value)}
                          placeholder="Cerca keyword…"
                          className="flex-1 !py-1.5 text-[12px]"
                        />
                        <select
                          value={kwSort}
                          onChange={(e) => setKwSort(e.target.value as typeof kwSort)}
                          className="text-[11px] text-[#737373] border border-[#e0e0e0] rounded-md px-2 py-1.5 bg-white focus:outline-none cursor-pointer"
                        >
                          <option value="default">Ordine: default</option>
                          <option value="priority">Ordine: priorità</option>
                          <option value="position">Ordine: posizione GSC</option>
                          <option value="alpha">Ordine: A→Z</option>
                        </select>
                        <button
                          onClick={() => setGroupByCluster((v) => !v)}
                          className={`text-[11px] px-2.5 py-1.5 rounded-md border transition-colors whitespace-nowrap ${
                            groupByCluster
                              ? "bg-[#1a1a1a] text-white border-[#1a1a1a]"
                              : "text-[#737373] border-[#e0e0e0] hover:border-[#ccc]"
                          }`}
                        >
                          Per cluster
                        </button>
                      </div>

                      {/* Filter tabs */}
                      <div className="flex gap-1 flex-wrap pb-4 mb-3 border-b border-[#f0f0f0]">
                        <FilterTab active={kwFilter === "all"} onClick={() => setKwFilter("all")}>
                          Tutte ({client.keyword_history.length})
                        </FilterTab>
                        {STATUS_ORDER.map((s) => kwCounts[s] ? (
                          <FilterTab key={s} active={kwFilter === s} onClick={() => setKwFilter(s)}>
                            {STATUS_CFG[s].label} ({kwCounts[s]})
                          </FilterTab>
                        ) : null)}
                      </div>

                      {processedKw.length === 0 ? (
                        <p className="text-[#ababab] text-[13px] py-1">Nessuna keyword trovata.</p>
                      ) : groupByCluster ? (
                        /* ── Grouped view ── */
                        <div className="flex flex-col gap-5">
                          {clusteredKw.map(([clusterName, kws]) => (
                            <div key={clusterName}>
                              <p className="text-[10px] font-semibold text-[#ababab] uppercase tracking-widest mb-1.5 px-1">
                                {clusterName === "—" ? "Senza cluster" : clusterName}
                                <span className="ml-1.5 font-normal">({kws.length})</span>
                              </p>
                              <div className="flex flex-col border border-[#f0f0f0] rounded-lg overflow-hidden divide-y divide-[#f0f0f0]">
                                {kws.map((kw) => (
                                  <KeywordRow
                                    key={kw.id}
                                    kw={kw}
                                    clientId={clientId}
                                    onUpdate={(fields) => updateKeyword(kw.id, fields)}
                                    onDelete={() => deleteKeyword(kw.id)}
                                  />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        /* ── Flat list ── */
                        <div className="flex flex-col">
                          {processedKw.map((kw) => (
                            <KeywordRow
                              key={kw.id}
                              kw={kw}
                              clientId={clientId}
                              onUpdate={(fields) => updateKeyword(kw.id, fields)}
                              onDelete={() => deleteKeyword(kw.id)}
                            />
                          ))}
                        </div>
                      )}

                      <button
                        onClick={clearKeywords}
                        className="mt-4 text-[11px] text-[#c0c0c0] hover:text-red-500 transition-colors"
                      >
                        Svuota tutto
                      </button>
                    </>
                  )}
                </Card>
              </div>}

              {/* ── Monitoraggio tab ── */}
              {activeTab === "monitoraggio" && (
                <div className="flex flex-col gap-5">
                  {/* Filtri rapidi */}
                  <div className="flex gap-2">
                    <MonFilterBtn active={monFilter === "all"} onClick={() => setMonFilter("all")}>Tutte</MonFilterBtn>
                    <MonFilterBtn active={monFilter === "top10"} onClick={() => setMonFilter("top10")}>Top 10</MonFilterBtn>
                    <MonFilterBtn active={monFilter === "incalo"} onClick={() => setMonFilter("incalo")}>In calo</MonFilterBtn>
                    <MonFilterBtn active={monFilter === "opportunita"} onClick={() => setMonFilter("opportunita")}>Opportunità</MonFilterBtn>
                  </div>

                  {/* Andamento progetto */}
                  {visibilityHistory.length >= 2 && (
                    <div className="flex flex-col gap-4">
                      <p className="text-[11px] font-medium text-[#ababab] uppercase tracking-wide">Andamento progetto</p>

                      {/* Grafico aggregato */}
                      <Card className="p-4">
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={visibilityHistory}>
                            <XAxis
                              dataKey="recorded_at"
                              tickFormatter={(v: string) => new Date(v).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
                              tick={{ fontSize: 10, fill: "#ababab" }}
                            />
                            <YAxis
                              yAxisId="left"
                              reversed
                              domain={["auto", "auto"]}
                              tick={{ fontSize: 10, fill: "#ababab" }}
                              tickFormatter={(v: number) => `#${v}`}
                            />
                            <YAxis
                              yAxisId="right"
                              orientation="right"
                              tick={{ fontSize: 10, fill: "#2563eb" }}
                            />
                            <Tooltip
                              formatter={(value: number, name: string) => {
                                if (name === "avg_position") return [`#${value.toFixed(1)}`, "Pos. media"];
                                return [value.toLocaleString("it-IT"), "Click"];
                              }}
                              labelFormatter={(label: string) => new Date(label).toLocaleDateString("it-IT")}
                            />
                            <Line yAxisId="left"  type="monotone" dataKey="avg_position" stroke="#1a1a1a" strokeWidth={1.5} dot={{ r: 3, fill: "#1a1a1a" }} activeDot={{ r: 4 }} />
                            <Line yAxisId="right" type="monotone" dataKey="total_clicks" stroke="#2563eb" strokeWidth={1.5} dot={{ r: 3, fill: "#2563eb" }} activeDot={{ r: 4 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </Card>

                      {/* Tabella confronto temporale */}
                      {(() => {
                        const now = Date.now();
                        const targets = [0, 30, 60, 90].map((days) => now - days * 86400000);
                        const snaps = targets.map((t) => {
                          let best: VisibilitySnapshot | null = null;
                          let bestDiff = Infinity;
                          for (const s of visibilityHistory) {
                            const d = new Date(s.recorded_at).getTime();
                            const diff = Math.abs(d - t);
                            if (diff < 7 * 86400000 && diff < bestDiff) { bestDiff = diff; best = s; }
                          }
                          return best;
                        });
                        const cols = ["Oggi", "-30gg", "-60gg", "-90gg"];
                        const fmt = (n: number | null | undefined) => n != null ? n.toLocaleString("it-IT") : "—";
                        return (
                          <Card className="overflow-hidden">
                            <table className="w-full text-[12px]">
                              <thead>
                                <tr className="border-b border-[#f0f0f0] text-[10px] font-medium text-[#ababab] uppercase tracking-wide">
                                  <th className="text-left px-4 py-2.5">Metrica</th>
                                  {cols.map((c) => <th key={c} className="text-right px-4 py-2.5">{c}</th>)}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#f8f8f8]">
                                <tr className="hover:bg-[#fafaf9]">
                                  <td className="px-4 py-2.5 text-[#737373]">Posizione media</td>
                                  {snaps.map((s, i) => <td key={i} className="px-4 py-2.5 text-right font-medium text-[#1a1a1a]">{s ? `#${s.avg_position.toFixed(1)}` : "—"}</td>)}
                                </tr>
                                <tr className="hover:bg-[#fafaf9]">
                                  <td className="px-4 py-2.5 text-[#737373]">Click totali</td>
                                  {snaps.map((s, i) => <td key={i} className="px-4 py-2.5 text-right text-[#555]">{fmt(s?.total_clicks)}</td>)}
                                </tr>
                                <tr className="hover:bg-[#fafaf9]">
                                  <td className="px-4 py-2.5 text-[#737373]">Impressioni totali</td>
                                  {snaps.map((s, i) => <td key={i} className="px-4 py-2.5 text-right text-[#555]">{fmt(s?.total_impressions)}</td>)}
                                </tr>
                              </tbody>
                            </table>
                          </Card>
                        );
                      })()}
                    </div>
                  )}

                  {/* Tabella */}
                  {client.keyword_history.length === 0 ? (
                    <p className="text-[#ababab] text-[13px]">
                      Nessuna keyword ancora — aggiungile dalla tab Keyword.
                    </p>
                  ) : filteredMonKw.length === 0 ? (
                    <p className="text-[#ababab] text-[13px]">Nessuna keyword corrisponde al filtro selezionato.</p>
                  ) : (
                    <Card className="overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-[12px]">
                          <thead>
                            <tr className="border-b border-[#f0f0f0] text-[10px] font-medium text-[#ababab] uppercase tracking-wide">
                              <th className="text-left px-4 py-3">Keyword</th>
                              <th className="text-right px-3 py-3">Posizione</th>
                              <th className="text-right px-3 py-3">Delta</th>
                              <th className="text-right px-3 py-3">Click</th>
                              <th className="text-right px-3 py-3">Impressioni</th>
                              <th className="text-right px-3 py-3">CTR</th>
                              <th className="text-right px-3 py-3">Volume</th>
                              <th className="text-center px-3 py-3">Status</th>
                              <th className="text-center px-3 py-3">Opportunità</th>
                              <th className="text-center px-3 py-3">Cannib.</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#f8f8f8]">
                            {filteredMonKw.map((kw) => {
                              const sCfg = STATUS_CFG[kw.status ?? "backlog"] ?? STATUS_CFG.backlog;
                              const isCannib = cannibSet.has(kw.keyword);
                              const isOpp   = isOpportunita(kw);
                              const delta = kw.position_prev != null && kw.position != null
                                ? kw.position_prev - kw.position  // positivo = miglioramento
                                : null;
                              return (
                                <tr key={kw.id} className="hover:bg-[#fafaf9] transition-colors">
                                  <td className="px-4 py-3 font-medium text-[#1a1a1a] max-w-[200px] truncate">
                                    {kw.keyword}
                                  </td>
                                  <td className="px-3 py-3 text-right text-[#555] font-medium">
                                    {kw.position != null ? `#${kw.position.toFixed(1)}` : <span className="text-[#ccc]">—</span>}
                                  </td>
                                  <td className="px-3 py-3 text-right">
                                    <DeltaBadge delta={delta} />
                                  </td>
                                  <td className="px-3 py-3 text-right text-[#737373]">
                                    {kw.clicks?.toLocaleString("it-IT") ?? "—"}
                                  </td>
                                  <td className="px-3 py-3 text-right text-[#737373]">
                                    {kw.impressions?.toLocaleString("it-IT") ?? "—"}
                                  </td>
                                  <td className="px-3 py-3 text-right text-[#737373]">
                                    {kw.ctr != null ? `${(kw.ctr * 100).toFixed(1)}%` : "—"}
                                  </td>
                                  <td className="px-3 py-3 text-right text-[#737373]">
                                    {kw.search_volume?.toLocaleString("it-IT") ?? "—"}
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    <span
                                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border"
                                      style={{ color: sCfg.color, background: sCfg.bg, borderColor: sCfg.border }}
                                    >
                                      {sCfg.label}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    {isOpp && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-50 text-orange-600 border border-orange-200">
                                        ⚡ Opportunità
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    {isCannib && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-50 text-orange-600 border border-orange-200">
                                        ⚠ Cannib.
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {/* ── Brief (sempre visibile) ── */}
              <div>
                <SectionTitle>Brief generati ({client.briefs.length})</SectionTitle>
                {client.briefs.length === 0 ? (
                  <p className="text-[#ababab] text-[13px]">Nessun brief ancora.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {client.briefs.map((b) => (
                      <div key={b.id} className="flex items-center justify-between px-4 py-3.5 rounded-lg border border-[#e8e8e8] bg-white hover:border-[#ccc] transition-colors">
                        <div>
                          <p className="text-[13px] font-medium text-[#1a1a1a]">{b.keyword}</p>
                          <p className="text-[11px] text-[#ababab] mt-0.5">
                            {b.market} · {b.intent} · {new Date(b.created_at).toLocaleDateString("it-IT")}
                          </p>
                        </div>
                        <Link href={`/writer?brief_id=${b.id}`} className="text-[11px] text-[#ababab] hover:text-[#555] transition-colors">
                          Scrivi articolo →
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* ── Modifica ── */
            <Card className="p-6">
              <h2 className="text-[13px] font-semibold text-[#555] mb-1">Modifica profilo</h2>
              <p className="text-[12px] text-[#ababab] mb-5">
                Questi dati vengono usati per generare brief e articoli SEO personalizzati — più sono precisi, migliore sarà l&apos;output.
              </p>
              <form onSubmit={saveEdit} className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
                  <div><Label>URL sito</Label><Input value={form.url || ""} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://…" /></div>
                  <div><Label>Settore</Label><Input value={form.sector || ""} onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value }))} /></div>
                  <div><Label>Brand name</Label><Input value={form.brand_name || ""} onChange={(e) => setForm((f) => ({ ...f, brand_name: e.target.value }))} placeholder="Es. Lumi Company — agenzia SEO B2B" /></div>
                  <div><Label>Area geografica</Label><Input value={form.geo || ""} onChange={(e) => setForm((f) => ({ ...f, geo: e.target.value }))} placeholder="Es. Italia, con focus su Milano e Roma" /></div>
                  <div>
                    <Label>Tono di voce</Label>
                    <Select value={form.tone_of_voice || ""} onChange={(e) => setForm((f) => ({ ...f, tone_of_voice: e.target.value }))}>
                      {TONES.map((t) => <option key={t}>{t}</option>)}
                    </Select>
                  </div>
                  <div className="col-span-2"><Label>Pubblico target</Label><Input value={form.target_audience || ""} onChange={(e) => setForm((f) => ({ ...f, target_audience: e.target.value }))} placeholder="Es. Marketing manager di PMI italiane, 30-50 anni" /></div>
                </div>
                <div><Label>Prodotti / Servizi</Label><Textarea rows={4} value={form.products_services || ""} onChange={(e) => setForm((f) => ({ ...f, products_services: e.target.value }))} placeholder="Es. Consulenza SEO, audit tecnici, content marketing" /></div>
                <div><Label>Proposta di valore unica (USP)</Label><Textarea rows={2} value={form.usp || ""} onChange={(e) => setForm((f) => ({ ...f, usp: e.target.value }))} placeholder="Es. Unici a combinare SEO tecnico e content in un unico team interno" /></div>
                <div><Label>Note strategiche SEO</Label><Textarea rows={2} value={form.notes || ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Lingua (DataForSEO)</Label>
                    <Input value={form.language_code || "it"} onChange={(e) => setForm((f) => ({ ...f, language_code: e.target.value }))} placeholder="it" />
                    <p className="text-[11px] text-[#ababab] mt-1.5">Codice lingua ISO 639-1. Es: it, en, de, fr</p>
                  </div>
                  <div>
                    <Label>Paese (DataForSEO)</Label>
                    <Select value={form.location_code ?? 2380} onChange={(e) => setForm((f) => ({ ...f, location_code: Number(e.target.value) }))}>
                      {LOCATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Proprietà Google Search Console</Label>
                  <Input
                    value={form.gsc_property || ""}
                    onChange={(e) => setForm((f) => ({ ...f, gsc_property: e.target.value }))}
                    placeholder="Es. sc-domain:example.com oppure https://www.example.com/"
                  />
                  <p className="text-[11px] text-[#ababab] mt-1.5">
                    Trovi il formato esatto in Google Search Console → seleziona la proprietà → copia l&apos;URL dalla barra in alto.
                  </p>
                </div>
                <div className="flex gap-2 pt-1">
                  <Btn type="submit" loading={saving}>Salva modifiche</Btn>
                  <Btn type="button" variant="ghost" onClick={() => setEditMode(false)}>Annulla</Btn>
                </div>
              </form>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────

function FilterTab({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${
        active
          ? "bg-[#1a1a1a] text-white"
          : "text-[#737373] hover:text-[#1a1a1a] hover:bg-[#f0f0ef]"
      }`}
    >
      {children}
    </button>
  );
}

function KeywordRow({ kw, clientId, onUpdate, onDelete }: {
  kw: KW;
  clientId: string;
  onUpdate: (fields: Partial<Pick<KW, "status" | "cluster" | "intent" | "priority">>) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [clusterEdit, setClusterEdit] = useState(kw.cluster ?? "");
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [kwHistory, setKwHistory] = useState<PositionSnapshot[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function handleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next && !historyLoaded) {
      setHistoryLoading(true);
      try {
        const r = await apiFetch(`/api/clients/${clientId}/keywords/${kw.id}/history`);
        const data = await r.json();
        setKwHistory(data.history ?? []);
      } catch { /* silenzioso */ }
      finally { setHistoryLoaded(true); setHistoryLoading(false); }
    }
  }

  const s    = kw.status   || "backlog";
  const cfg  = STATUS_CFG[s] ?? STATUS_CFG.backlog;
  const pCfg = PRIORITY_CFG[kw.priority ?? "media"] ?? PRIORITY_CFG.media;
  const iCfg = kw.intent ? INTENT_CFG[kw.intent] : null;
  const hasGsc = kw.impressions != null;

  return (
    <div className="rounded-lg hover:bg-[#f7f7f6] transition-colors group">
      {/* Main row */}
      <div
        className="flex items-center gap-2 px-2 py-2 cursor-pointer"
        onClick={handleExpand}
      >
        {/* Priority dot */}
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0 mt-px"
          style={{ background: pCfg.dot }}
          title={`Priorità: ${pCfg.label}`}
        />

        {/* Status badge */}
        <select
          value={s}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => { e.stopPropagation(); onUpdate({ status: e.target.value }); }}
          style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}
          className="text-[11px] font-medium px-2 py-0.5 rounded-full border cursor-pointer focus:outline-none shrink-0"
        >
          {STATUS_ORDER.map((sv) => (
            <option key={sv} value={sv}>{STATUS_CFG[sv].label}</option>
          ))}
        </select>

        {/* Intent chip */}
        {iCfg && (
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
            style={{ color: iCfg.color, background: iCfg.bg }}
          >
            {iCfg.label}
          </span>
        )}

        {/* Keyword text */}
        <span className="flex-1 text-[13px] text-[#333] truncate">{kw.keyword}</span>

        {/* Cluster tag */}
        {kw.cluster && (
          <span className="hidden group-hover:inline text-[10px] text-[#ababab] bg-[#f0f0ef] rounded px-1.5 py-0.5 truncate max-w-[100px]">
            {kw.cluster}
          </span>
        )}

        {/* GSC metrics */}
        {hasGsc && (
          <span className="hidden group-hover:flex items-center gap-3 text-[11px] text-[#ababab] shrink-0">
            <span title="Impressioni">{kw.impressions?.toLocaleString("it-IT")} imp</span>
            <span title="Click">{kw.clicks?.toLocaleString("it-IT")} click</span>
            <span title="Posizione media" className="font-medium text-[#555]">#{kw.position?.toFixed(1)}</span>
          </span>
        )}

        {/* Analizza */}
        <Link
          href={`/seo?keyword=${encodeURIComponent(kw.keyword)}&client_id=${clientId}`}
          onClick={(e) => e.stopPropagation()}
          className="text-[11px] text-[#ababab] hover:text-[#555] opacity-0 group-hover:opacity-100 transition-all shrink-0 whitespace-nowrap"
        >
          Analizza →
        </Link>

        {/* Delete */}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="text-[#d0d0d0] hover:text-red-500 transition-colors text-[15px] leading-none opacity-0 group-hover:opacity-100 shrink-0"
        >
          ×
        </button>
      </div>

      {/* Expandable detail panel */}
      {expanded && (
        <div
          className="mx-2 mb-2 px-3 py-3 rounded-lg bg-[#fafaf9] border border-[#ebebeb] flex gap-4 flex-wrap text-[12px]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Cluster */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-[#ababab] font-medium uppercase tracking-wide">Cluster</span>
            <input
              className="text-[12px] text-[#333] border border-[#e0e0e0] rounded-md px-2 py-1 bg-white focus:outline-none focus:border-[#999] w-40"
              placeholder="es. Guide prodotto"
              value={clusterEdit}
              onChange={(e) => setClusterEdit(e.target.value)}
              onBlur={() => {
                const val = clusterEdit.trim() || undefined;
                if (val !== (kw.cluster ?? undefined)) onUpdate({ cluster: val ?? "" });
              }}
            />
          </div>

          {/* Intent */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-[#ababab] font-medium uppercase tracking-wide">Intent</span>
            <select
              value={kw.intent ?? ""}
              onChange={(e) => onUpdate({ intent: e.target.value || undefined })}
              className="text-[12px] border border-[#e0e0e0] rounded-md px-2 py-1 bg-white focus:outline-none focus:border-[#999] cursor-pointer"
            >
              <option value="">— non impostato —</option>
              <option value="informativo">Informativo</option>
              <option value="commerciale">Commerciale</option>
              <option value="navigazionale">Navigazionale</option>
              <option value="transazionale">Transazionale</option>
            </select>
          </div>

          {/* Priority */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-[#ababab] font-medium uppercase tracking-wide">Priorità</span>
            <select
              value={kw.priority ?? "media"}
              onChange={(e) => onUpdate({ priority: e.target.value })}
              className="text-[12px] border border-[#e0e0e0] rounded-md px-2 py-1 bg-white focus:outline-none focus:border-[#999] cursor-pointer"
            >
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="bassa">Bassa</option>
            </select>
          </div>

          {/* GSC full metrics */}
          {hasGsc && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-[#ababab] font-medium uppercase tracking-wide">GSC</span>
              <div className="flex gap-3 text-[12px] text-[#555]">
                <span>{kw.impressions?.toLocaleString("it-IT")} imp</span>
                <span>{kw.clicks?.toLocaleString("it-IT")} click</span>
                <span>pos. {kw.position?.toFixed(1)}</span>
                <span>CTR {((kw.ctr ?? 0) * 100).toFixed(1)}%</span>
              </div>
            </div>
          )}

          {/* Search volume */}
          {kw.search_volume != null && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-[#ababab] font-medium uppercase tracking-wide">Volume</span>
              <div className="text-[12px] text-[#555]">
                {kw.search_volume.toLocaleString("it-IT")} vol/mese
              </div>
            </div>
          )}

          {/* Storico posizioni */}
          <div className="w-full mt-1">
            <span className="text-[10px] text-[#ababab] font-medium uppercase tracking-wide block mb-2">Storico posizioni</span>
            {historyLoading ? (
              <p className="text-[12px] text-[#ababab]">Caricamento storico…</p>
            ) : kwHistory.length < 2 ? (
              <p className="text-[12px] text-[#ababab]">Dati insufficienti — servono almeno 2 sync GSC</p>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={kwHistory}>
                  <XAxis
                    dataKey="recorded_at"
                    tickFormatter={(v: string) => new Date(v).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
                    tick={{ fontSize: 10, fill: "#ababab" }}
                  />
                  <YAxis
                    reversed
                    domain={["auto", "auto"]}
                    tick={{ fontSize: 10, fill: "#ababab" }}
                    tickFormatter={(v: number) => `#${v}`}
                  />
                  <Tooltip
                    formatter={(value: number) => [`#${value.toFixed(1)}`, "Posizione"]}
                    labelFormatter={(label: string) => new Date(label).toLocaleDateString("it-IT")}
                  />
                  <Line
                    type="monotone"
                    dataKey="position"
                    stroke="#1a1a1a"
                    strokeWidth={1.5}
                    dot={{ r: 3, fill: "#1a1a1a" }}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-medium text-[#ababab] uppercase tracking-wide mb-3">{children}</p>;
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-[12px] font-medium border-b-2 transition-colors ${
        active
          ? "border-[#1a1a1a] text-[#1a1a1a]"
          : "border-transparent text-[#ababab] hover:text-[#555]"
      }`}
    >
      {children}
    </button>
  );
}

function OnboardingStep({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      {done
        ? <CheckCircle size={17} className="text-green-500 shrink-0 mt-px" />
        : <Circle     size={17} className="text-[#d0d0d0] shrink-0 mt-px" />}
      <span className={`text-[13px] leading-snug ${done ? "text-[#ababab] line-through" : "text-[#333]"}`}>
        {children}
      </span>
    </div>
  );
}

function OnboardingSteps({ hasKeywords, hasGsc, hasBrief }: {
  hasKeywords: boolean; hasGsc: boolean; hasBrief: boolean;
}) {
  return (
    <div className="py-5 px-2">
      <p className="text-[13px] font-semibold text-[#333] mb-4">Inizia il progetto SEO</p>
      <div className="flex flex-col gap-3.5">
        <OnboardingStep done>Cliente creato</OnboardingStep>
        <OnboardingStep done={hasKeywords}>
          Aggiungi le prime keyword target — usa il pulsante &ldquo;Aggiungi keyword&rdquo; qui sopra
        </OnboardingStep>
        <OnboardingStep done={hasGsc}>
          Sincronizza Google Search Console per importare posizioni e traffico
        </OnboardingStep>
        <OnboardingStep done={hasBrief}>
          Genera il primo brief SEO dalla tab Keyword
        </OnboardingStep>
      </div>
    </div>
  );
}

function MonKpiCard({ label, value, warn = false }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-[#e8e8e8] bg-white p-4">
      <p className="text-[10px] font-medium text-[#ababab] uppercase tracking-wide mb-1.5">{label}</p>
      <p className={`text-[22px] font-semibold ${warn && value > 0 ? "text-orange-500" : "text-[#1a1a1a]"}`}>
        {value}
      </p>
    </div>
  );
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#f0f0ef] text-[#ababab] border border-[#e0e0e0]">—</span>;
  }
  const abs = Math.abs(delta).toFixed(1);
  if (delta > 0) {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-50 text-green-600 border border-green-200">↑ +{abs}</span>;
  }
  if (delta < 0) {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-50 text-red-600 border border-red-200">↓ -{abs}</span>;
  }
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#f0f0ef] text-[#ababab] border border-[#e0e0e0]">—</span>;
}

function MonFilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-[11px] font-medium border transition-colors ${
        active
          ? "bg-[#1a1a1a] text-white border-[#1a1a1a]"
          : "text-[#737373] border-[#e0e0e0] hover:border-[#ccc] hover:text-[#1a1a1a]"
      }`}
    >
      {children}
    </button>
  );
}

function InfoItem({ label, value, link }: { label: string; value?: string; link?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-[#ababab] mb-0.5">{label}</p>
      {!value ? (
        <p className="text-[13px] text-[#ccc]">—</p>
      ) : link ? (
        <a href={value} target="_blank" rel="noreferrer" className="text-[13px] text-[#555] hover:text-[#1a1a1a] underline underline-offset-2 transition-colors">
          {value}
        </a>
      ) : (
        <p className="text-[13px] text-[#333]">{value}</p>
      )}
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="pt-4 border-t border-[#f0f0f0] mt-1">
      <p className="text-[11px] text-[#ababab] mb-1">{label}</p>
      <p className="text-[13px] text-[#444] leading-relaxed whitespace-pre-wrap">{value}</p>
    </div>
  );
}

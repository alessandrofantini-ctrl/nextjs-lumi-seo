"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useMemo } from "react";
import Link from "next/link";
import { Label, Input, Textarea, Select, Btn, Alert, Card } from "@/components/ui";
import { apiFetch } from "@/lib/api";

const TONES = ["Autorevole & tecnico", "Empatico & problem solving", "Diretto & commerciale"];

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

// stopwords for cannibalization detection
const STOP = new Set([
  "di","a","da","in","su","per","con","tra","fra","il","lo","la","i","gli","le",
  "un","uno","una","e","o","ma","che","è","si","ha","ho","non","del","della","dei",
  "the","a","an","of","for","in","on","at","to","with","and","or","but","is","are",
  "how","what","when","where","who","why","best","top","come","cosa","quando","dove",
]);

type KW = {
  id: string; keyword: string; status: string; created_at: string;
  impressions?: number; clicks?: number; position?: number; ctr?: number;
  gsc_updated_at?: string;
  cluster?: string; intent?: string; priority?: string;
};
type Brief = { id: string; keyword: string; market: string; intent: string; created_at: string };

type ClientFull = {
  id: string; name: string; url?: string; sector?: string; brand_name?: string;
  tone_of_voice?: string; usp?: string; products_services?: string;
  target_audience?: string; geo?: string; notes?: string;
  gsc_property?: string;
  keyword_history: KW[]; briefs: Brief[];
  created_at?: string; updated_at?: string;
};

type EditForm = Omit<ClientFull, "id" | "keyword_history" | "briefs" | "created_at" | "updated_at">;

// ── Cannibalization detection ────────────────────────────
function detectCannibalization(kws: KW[]): Array<{ a: string; b: string; intent: string }> {
  const intentGroups: Record<string, KW[]> = {};
  kws.forEach((k) => {
    if (k.intent) {
      if (!intentGroups[k.intent]) intentGroups[k.intent] = [];
      intentGroups[k.intent].push(k);
    }
  });
  const pairs: Array<{ a: string; b: string; intent: string }> = [];
  Object.entries(intentGroups).forEach(([intent, group]) => {
    if (group.length < 2) return;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const wordsA = new Set(
          group[i].keyword.toLowerCase().split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w))
        );
        const wordsB = group[j].keyword.toLowerCase().split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
        const overlap = wordsB.filter((w) => wordsA.has(w));
        if (overlap.length >= 2) pairs.push({ a: group[i].keyword, b: group[j].keyword, intent });
      }
    }
  });
  return pairs;
}

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

  // GSC sync
  const [gscSyncing, setGscSyncing] = useState(false);
  const [gscResult, setGscResult]   = useState<{ synced: number; added: number } | null>(null);

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

  if (loading) return <div className="p-8 text-[#ababab] text-[13px]">Caricamento…</div>;
  if (error && !client) return <div className="p-8 max-w-xl"><Alert type="error">{error}</Alert></div>;
  if (!client) return null;

  const kwCounts: Record<string, number> = {};
  client.keyword_history.forEach((k) => {
    const s = k.status || "backlog";
    kwCounts[s] = (kwCounts[s] || 0) + 1;
  });

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
        <div className="px-8 py-7 max-w-3xl flex flex-col gap-8">

          {error && <Alert type="error">{error}</Alert>}

          {!editMode ? (
            <>
              {/* ── Profilo ── */}
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

              {/* ── Keyword pipeline ── */}
              <div>
                {/* Toolbar */}
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-medium text-[#ababab] uppercase tracking-wide">
                    Keyword ({client.keyword_history.length})
                  </p>
                  <div className="flex items-center gap-2">
                    {client.gsc_property && (
                      <button
                        onClick={syncGSC}
                        disabled={gscSyncing}
                        className="text-[11px] text-[#2563eb] hover:text-[#1d4ed8] border border-[#bfdbfe] hover:border-[#93c5fd] bg-[#eff6ff] rounded-md px-2.5 py-1 transition-colors disabled:opacity-50"
                      >
                        {gscSyncing ? "Sincronizzazione…" : "Sincronizza GSC"}
                      </button>
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
                      GSC: aggiornate <strong>{gscResult.synced}</strong> keyword esistenti
                      {gscResult.added > 0 && <>, aggiunte <strong>{gscResult.added}</strong> nuove query</>}.
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
                    <p className="text-[#ababab] text-[13px]">
                      Nessuna keyword ancora. Aggiungile una alla volta o importa un CSV.
                    </p>
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
              </div>

              {/* ── Brief ── */}
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
              <h2 className="text-[13px] font-semibold text-[#555] mb-5">Modifica profilo</h2>
              <form onSubmit={saveEdit} className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
                  <div><Label>URL sito</Label><Input value={form.url || ""} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://…" /></div>
                  <div><Label>Settore</Label><Input value={form.sector || ""} onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value }))} /></div>
                  <div><Label>Brand name</Label><Input value={form.brand_name || ""} onChange={(e) => setForm((f) => ({ ...f, brand_name: e.target.value }))} /></div>
                  <div><Label>Zona geografica</Label><Input value={form.geo || ""} onChange={(e) => setForm((f) => ({ ...f, geo: e.target.value }))} /></div>
                  <div>
                    <Label>Tono di voce</Label>
                    <Select value={form.tone_of_voice || ""} onChange={(e) => setForm((f) => ({ ...f, tone_of_voice: e.target.value }))}>
                      {TONES.map((t) => <option key={t}>{t}</option>)}
                    </Select>
                  </div>
                  <div className="col-span-2"><Label>Target audience</Label><Input value={form.target_audience || ""} onChange={(e) => setForm((f) => ({ ...f, target_audience: e.target.value }))} /></div>
                </div>
                <div><Label>Prodotti / Servizi</Label><Textarea rows={4} value={form.products_services || ""} onChange={(e) => setForm((f) => ({ ...f, products_services: e.target.value }))} placeholder="Un prodotto/servizio per riga" /></div>
                <div><Label>USP / Punti di forza</Label><Textarea rows={2} value={form.usp || ""} onChange={(e) => setForm((f) => ({ ...f, usp: e.target.value }))} /></div>
                <div><Label>Note strategiche SEO</Label><Textarea rows={2} value={form.notes || ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>
                <div>
                  <Label>GSC Property</Label>
                  <Input
                    value={form.gsc_property || ""}
                    onChange={(e) => setForm((f) => ({ ...f, gsc_property: e.target.value }))}
                    placeholder="sc-domain:esempio.it oppure https://www.esempio.it/"
                  />
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
        onClick={() => setExpanded((v) => !v)}
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
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-medium text-[#ababab] uppercase tracking-wide mb-3">{children}</p>;
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

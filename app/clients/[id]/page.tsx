"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Label, Input, Textarea, Select, Btn, Alert, Card } from "@/components/ui";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

const TONES = ["Autorevole & tecnico", "Empatico & problem solving", "Diretto & commerciale"];

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  backlog:    { label: "In lista",     color: "#8f8f8f", bg: "#f5f5f4", border: "#e0e0e0" },
  planned:    { label: "Pianificata",  color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
  brief_done: { label: "Brief pronto", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  written:    { label: "Scritta",      color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  published:  { label: "Pubblicata",   color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
};
const STATUS_ORDER = ["backlog", "planned", "brief_done", "written", "published"];

type KW    = { id: string; keyword: string; status: string; created_at: string };
type Brief = { id: string; keyword: string; market: string; intent: string; created_at: string };

type ClientFull = {
  id: string; name: string; url?: string; sector?: string; brand_name?: string;
  tone_of_voice?: string; usp?: string; products_services?: string;
  target_audience?: string; geo?: string; notes?: string;
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

  // keyword state
  const [newKw, setNewKw]       = useState("");
  const [addingKw, setAddingKw] = useState(false);
  const [kwFilter, setKwFilter] = useState("all");
  const [importing, setImporting]   = useState(false);
  const [importResult, setImportResult] = useState<{ added: number; skipped: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${API}/api/clients/${clientId}`);
      if (!r.ok) throw new Error("Cliente non trovato");
      const data: ClientFull = await r.json();
      setClient(data);
      setForm({
        name: data.name, url: data.url || "", sector: data.sector || "",
        brand_name: data.brand_name || "", tone_of_voice: data.tone_of_voice || TONES[0],
        usp: data.usp || "", products_services: data.products_services || "",
        target_audience: data.target_audience || "", geo: data.geo || "", notes: data.notes || "",
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Errore caricamento");
    } finally { setLoading(false); }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const r = await fetch(`${API}/api/clients/${clientId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
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
      await fetch(`${API}/api/clients/${clientId}`, { method: "DELETE" });
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
      await fetch(`${API}/api/clients/${clientId}/keywords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: newKw }),
      });
      setNewKw(""); await load();
    } finally { setAddingKw(false); }
  }

  async function updateStatus(kwId: string, status: string) {
    await fetch(`${API}/api/clients/${clientId}/keywords/${kwId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    // optimistic update
    setClient((c) => c ? {
      ...c,
      keyword_history: c.keyword_history.map((k) => k.id === kwId ? { ...k, status } : k),
    } : c);
  }

  async function deleteKeyword(kwId: string) {
    await fetch(`${API}/api/clients/${clientId}/keywords/${kwId}`, { method: "DELETE" });
    setClient((c) => c ? {
      ...c, keyword_history: c.keyword_history.filter((k) => k.id !== kwId),
    } : c);
  }

  async function clearKeywords() {
    await fetch(`${API}/api/clients/${clientId}/keywords`, { method: "DELETE" });
    setClient((c) => c ? { ...c, keyword_history: [] } : c);
  }

  function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setImportResult(null);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      // parse CSV: take first column of each line
      const lines = text.split(/\r?\n/).map((l) => l.split(",")[0].replace(/^["']|["']$/g, "").trim()).filter(Boolean);
      // skip header row if it looks like a label
      const firstLow = lines[0]?.toLowerCase();
      const keywords = ["keyword", "query", "parola chiave", "kw"].includes(firstLow)
        ? lines.slice(1) : lines;
      if (!keywords.length) { setImporting(false); return; }
      try {
        const r = await fetch(`${API}/api/clients/${clientId}/keywords/bulk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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

  if (loading) return <div className="p-8 text-[#ababab] text-[13px]">Caricamento…</div>;
  if (error && !client) return <div className="p-8 max-w-xl"><Alert type="error">{error}</Alert></div>;
  if (!client) return null;

  const filteredKw = kwFilter === "all"
    ? client.keyword_history
    : client.keyword_history.filter((k) => (k.status || "backlog") === kwFilter);

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
                </div>
                {client.products_services && <InfoBlock label="Prodotti / Servizi"  value={client.products_services} />}
                {client.usp              && <InfoBlock label="USP / Punti di forza" value={client.usp}               />}
                {client.notes            && <InfoBlock label="Note strategiche SEO" value={client.notes}             />}
              </Card>

              {/* ── Keyword pipeline ── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-medium text-[#ababab] uppercase tracking-wide">
                    Keyword ({client.keyword_history.length})
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.txt"
                      className="hidden"
                      onChange={handleFileImport}
                    />
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

                      {/* Keyword list */}
                      <div className="flex flex-col">
                        {filteredKw.length === 0 ? (
                          <p className="text-[#ababab] text-[13px] py-1">Nessuna keyword in questo stato.</p>
                        ) : filteredKw.map((kw) => (
                          <KeywordRow
                            key={kw.id}
                            kw={kw}
                            clientId={clientId}
                            onStatusChange={(s) => updateStatus(kw.id, s)}
                            onDelete={() => deleteKeyword(kw.id)}
                          />
                        ))}
                      </div>

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

function KeywordRow({ kw, clientId, onStatusChange, onDelete }: {
  kw: KW; clientId: string; onStatusChange: (s: string) => void; onDelete: () => void;
}) {
  const s = kw.status || "backlog";
  const cfg = STATUS_CFG[s] ?? STATUS_CFG.backlog;
  return (
    <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-[#f7f7f6] group transition-colors">
      {/* Status badge (select) */}
      <select
        value={s}
        onChange={(e) => onStatusChange(e.target.value)}
        style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}
        className="text-[11px] font-medium px-2 py-0.5 rounded-full border cursor-pointer focus:outline-none shrink-0"
      >
        {STATUS_ORDER.map((sv) => (
          <option key={sv} value={sv}>{STATUS_CFG[sv].label}</option>
        ))}
      </select>

      {/* Keyword text */}
      <span className="flex-1 text-[13px] text-[#333] truncate">{kw.keyword}</span>

      {/* Analizza → link (visible on hover) */}
      <Link
        href={`/seo?keyword=${encodeURIComponent(kw.keyword)}&client_id=${clientId}`}
        className="text-[11px] text-[#ababab] hover:text-[#555] opacity-0 group-hover:opacity-100 transition-all shrink-0 whitespace-nowrap"
      >
        Analizza →
      </Link>

      {/* Delete (visible on hover) */}
      <button
        onClick={onDelete}
        className="text-[#d0d0d0] hover:text-red-500 transition-colors text-[15px] leading-none opacity-0 group-hover:opacity-100 shrink-0"
      >
        ×
      </button>
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

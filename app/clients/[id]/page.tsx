"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Label, Input, Textarea, Select, Btn, Alert, Card } from "@/components/ui";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

const TONES = ["Autorevole & tecnico", "Empatico & problem solving", "Diretto & commerciale"];

type KW    = { id: string; keyword: string; created_at: string };
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

  // Edit
  const [editMode, setEditMode] = useState(false);
  const [form, setForm]         = useState<EditForm>({ name: "" });
  const [saving, setSaving]     = useState(false);

  // Delete
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting]           = useState(false);

  // Keyword
  const [newKw, setNewKw]     = useState("");
  const [addingKw, setAddingKw] = useState(false);

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
      await load();
      setEditMode(false);
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
      setError("Errore eliminazione");
      setDeleting(false);
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
      setNewKw("");
      await load();
    } finally { setAddingKw(false); }
  }

  async function deleteKeyword(kwId: string) {
    await fetch(`${API}/api/clients/${clientId}/keywords/${kwId}`, { method: "DELETE" });
    await load();
  }

  async function clearKeywords() {
    await fetch(`${API}/api/clients/${clientId}/keywords`, { method: "DELETE" });
    await load();
  }

  useEffect(() => { load(); }, [clientId]);

  if (loading) return <div className="p-8 text-white/30 text-[13px]">Caricamento…</div>;
  if (error && !client) return <div className="p-8"><Alert type="error">{error}</Alert></div>;
  if (!client) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 pt-8 pb-6 border-b border-white/[0.06]">
        <Link href="/clients" className="text-[11px] text-white/30 hover:text-white/60 transition-colors mb-3 inline-block">
          ← Tutti i clienti
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold text-white/90">{client.name}</h1>
            <p className="text-white/35 text-[13px] mt-0.5">
              {[client.sector, client.geo].filter(Boolean).join(" · ") || "—"}
              {client.updated_at && (
                <span className="ml-3 text-white/20">
                  aggiornato {new Date(client.updated_at).toLocaleDateString("it-IT")}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {!editMode ? (
              <>
                <Btn onClick={() => { setEditMode(true); setError(null); }}>Modifica</Btn>
                <Btn variant="ghost" onClick={() => setConfirmDelete(true)}>Elimina</Btn>
              </>
            ) : (
              <Btn variant="ghost" onClick={() => { setEditMode(false); setError(null); }}>
                Annulla
              </Btn>
            )}
          </div>
        </div>
      </div>

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="mx-8 mt-6">
          <Alert type="error">
            <span>Eliminare <strong>{client.name}</strong> e tutto il suo storico? L&apos;operazione è irreversibile.</span>
            <div className="flex gap-2 mt-3">
              <Btn onClick={deleteClient} loading={deleting}>Sì, elimina</Btn>
              <Btn variant="ghost" onClick={() => setConfirmDelete(false)}>Annulla</Btn>
            </div>
          </Alert>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="px-8 py-7 max-w-3xl flex flex-col gap-8">

          {error && <Alert type="error">{error}</Alert>}

          {/* ── VISUALIZZA ── */}
          {!editMode ? (
            <>
              <InfoSection title="Profilo">
                <InfoGrid>
                  <InfoItem label="URL sito" value={client.url} link />
                  <InfoItem label="Brand name" value={client.brand_name} />
                  <InfoItem label="Settore" value={client.sector} />
                  <InfoItem label="Zona geografica" value={client.geo} />
                  <InfoItem label="Tono di voce" value={client.tone_of_voice} />
                  <InfoItem label="Target audience" value={client.target_audience} />
                </InfoGrid>
                {client.products_services && (
                  <InfoBlock label="Prodotti / Servizi" value={client.products_services} />
                )}
                {client.usp && <InfoBlock label="USP / Punti di forza" value={client.usp} />}
                {client.notes && <InfoBlock label="Note strategiche SEO" value={client.notes} />}
              </InfoSection>

              {/* Storico keyword */}
              <InfoSection title={`Storico keyword (${client.keyword_history.length})`}>
                <form onSubmit={addKeyword} className="flex gap-2 mb-4">
                  <Input
                    value={newKw}
                    onChange={(e) => setNewKw(e.target.value)}
                    placeholder="Aggiungi keyword…"
                    className="flex-1"
                  />
                  <Btn type="submit" loading={addingKw} disabled={!newKw.trim()}>
                    Aggiungi
                  </Btn>
                </form>

                {client.keyword_history.length === 0 ? (
                  <p className="text-white/25 text-[13px]">Nessuna keyword ancora.</p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {client.keyword_history.map((kw) => (
                        <span
                          key={kw.id}
                          className="group flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.05] border border-white/[0.07] text-[12px] text-white/60"
                        >
                          {kw.keyword}
                          <button
                            onClick={() => deleteKeyword(kw.id)}
                            className="text-white/20 hover:text-red-400 transition-colors leading-none"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={clearKeywords}
                      className="mt-3 text-[11px] text-white/20 hover:text-red-400 transition-colors"
                    >
                      Svuota storico
                    </button>
                  </>
                )}
              </InfoSection>

              {/* Brief generati */}
              <InfoSection title={`Brief generati (${client.briefs.length})`}>
                {client.briefs.length === 0 ? (
                  <p className="text-white/25 text-[13px]">Nessun brief ancora.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {client.briefs.map((b) => (
                      <div
                        key={b.id}
                        className="flex items-center justify-between px-4 py-3 rounded-lg border border-white/[0.06] bg-white/[0.01]"
                      >
                        <div>
                          <p className="text-[13px] text-white/75 font-medium">{b.keyword}</p>
                          <p className="text-[11px] text-white/30 mt-0.5">
                            {b.market} · {b.intent} · {new Date(b.created_at).toLocaleDateString("it-IT")}
                          </p>
                        </div>
                        <Link
                          href={`/writer?brief_id=${b.id}`}
                          className="text-[11px] text-white/25 hover:text-white/60 transition-colors"
                        >
                          Scrivi articolo →
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </InfoSection>
            </>
          ) : (
            /* ── MODIFICA ── */
            <Card className="p-6">
              <h2 className="text-[13px] font-semibold text-white/60 mb-5">Modifica profilo</h2>
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

/* ── Componenti locali ── */

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-white/30 uppercase tracking-wide mb-3">{title}</p>
      {children}
    </div>
  );
}

function InfoGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-8 gap-y-3 mb-4">{children}</div>;
}

function InfoItem({ label, value, link }: { label: string; value?: string; link?: boolean }) {
  if (!value) return (
    <div>
      <p className="text-[11px] text-white/25">{label}</p>
      <p className="text-[13px] text-white/20 mt-0.5">—</p>
    </div>
  );
  return (
    <div>
      <p className="text-[11px] text-white/25">{label}</p>
      {link ? (
        <a href={value} target="_blank" rel="noreferrer" className="text-[13px] text-white/60 hover:text-white/80 underline underline-offset-2 mt-0.5 inline-block transition-colors">
          {value}
        </a>
      ) : (
        <p className="text-[13px] text-white/70 mt-0.5">{value}</p>
      )}
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-3">
      <p className="text-[11px] text-white/25 mb-1">{label}</p>
      <p className="text-[13px] text-white/65 leading-relaxed whitespace-pre-wrap">{value}</p>
    </div>
  );
}

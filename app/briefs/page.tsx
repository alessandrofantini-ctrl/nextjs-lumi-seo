"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader, Section, Label, Textarea, Btn, Alert } from "@/components/ui";
import { apiFetch } from "@/lib/api";

type Brief = {
  id: string;
  keyword: string;
  market: string;
  intent: string | null;
  created_at: string;
  client_id: string | null;
  brief_output: string;
};

export default function BriefsPage() {
  const [briefs, setBriefs]             = useState<Brief[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [editTexts, setEditTexts]       = useState<Record<string, string>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [savingId, setSavingId]         = useState<string | null>(null);
  const [savedId, setSavedId]           = useState<string | null>(null);
  const [rowError, setRowError]         = useState<Record<string, string>>({});

  useEffect(() => {
    apiFetch("/api/seo/briefs")
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => setBriefs(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return briefs;
    const q = search.toLowerCase();
    return briefs.filter((b) => b.keyword.toLowerCase().includes(q));
  }, [briefs, search]);

  function openEdit(brief: Brief) {
    // Aprire un'altra riga chiude quella corrente
    setExpandedId(brief.id);
    setConfirmDeleteId(null);
    if (!(brief.id in editTexts)) {
      setEditTexts((prev) => ({ ...prev, [brief.id]: brief.brief_output }));
    }
    setRowError((prev) => ({ ...prev, [brief.id]: "" }));
  }

  function closeEdit() {
    setExpandedId(null);
  }

  async function handleSave(brief: Brief) {
    setSavingId(brief.id);
    setRowError((prev) => ({ ...prev, [brief.id]: "" }));
    try {
      const r = await apiFetch(`/api/seo/briefs/${brief.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          brief_output: editTexts[brief.id] ?? brief.brief_output,
        }),
      });
      if (!r.ok) throw new Error();
      setBriefs((prev) =>
        prev.map((b) =>
          b.id === brief.id
            ? { ...b, brief_output: editTexts[brief.id] ?? b.brief_output }
            : b
        )
      );
      setExpandedId(null);
      setSavedId(brief.id);
      setTimeout(() => setSavedId(null), 2000);
    } catch {
      setRowError((prev) => ({ ...prev, [brief.id]: "Errore nel salvataggio. Riprova." }));
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(briefId: string) {
    try {
      const r = await apiFetch(`/api/seo/briefs/${briefId}`, {
        method: "DELETE",
      });
      if (!r.ok) throw new Error();
      setBriefs((prev) => prev.filter((b) => b.id !== briefId));
      setConfirmDeleteId(null);
    } catch {
      setRowError((prev) => ({ ...prev, [briefId]: "Errore nell'eliminazione. Riprova." }));
    }
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Brief salvati"
        subtitle="Visualizza, modifica ed elimina i brief generati."
      />

      <Section>
        {/* Barra ricerca */}
        <div className="mb-4">
          <Label>Cerca per keyword</Label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="es. impianti fotovoltaici…"
            className="w-full px-3 py-2 rounded-lg bg-white border border-[#d9d9d9] text-[#1a1a1a] text-[13px] placeholder:text-[#c0c0c0] focus:outline-none focus:border-[#999] transition-colors"
          />
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-lg bg-[#f0f0ef] animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-[13px] text-[#ababab] py-8 text-center">
            {search ? "Nessun brief trovato per questa ricerca." : "Nessun brief salvato."}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((brief) => (
              <BriefRow
                key={brief.id}
                brief={brief}
                expanded={expandedId === brief.id}
                editText={editTexts[brief.id] ?? brief.brief_output}
                confirmDelete={confirmDeleteId === brief.id}
                saving={savingId === brief.id}
                saved={savedId === brief.id}
                error={rowError[brief.id] ?? ""}
                onEditOpen={() => openEdit(brief)}
                onEditClose={closeEdit}
                onEditChange={(val) =>
                  setEditTexts((prev) => ({ ...prev, [brief.id]: val }))
                }
                onSave={() => handleSave(brief)}
                onDeleteRequest={() => {
                  setConfirmDeleteId(brief.id);
                  setExpandedId(null);
                  setRowError((prev) => ({ ...prev, [brief.id]: "" }));
                }}
                onDeleteConfirm={() => handleDelete(brief.id)}
                onDeleteCancel={() => setConfirmDeleteId(null)}
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ══════════════════════════════════════════════
//  BriefRow
// ══════════════════════════════════════════════

type BriefRowProps = {
  brief: Brief;
  expanded: boolean;
  editText: string;
  confirmDelete: boolean;
  saving: boolean;
  saved: boolean;
  error: string;
  onEditOpen: () => void;
  onEditClose: () => void;
  onEditChange: (val: string) => void;
  onSave: () => void;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
};

function BriefRow({
  brief, expanded, editText, confirmDelete, saving, saved, error,
  onEditOpen, onEditClose, onEditChange, onSave,
  onDeleteRequest, onDeleteConfirm, onDeleteCancel,
}: BriefRowProps) {
  const date = new Date(brief.created_at).toLocaleDateString("it-IT");
  const meta = [brief.market, brief.intent, date].filter(Boolean).join(" · ");

  return (
    <div className="rounded-lg border border-[#e8e8e8] bg-white overflow-hidden">
      {/* Header riga */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-[#1a1a1a] truncate">{brief.keyword}</p>
          <p className="text-[11px] text-[#ababab] mt-0.5">{meta}</p>
        </div>

        {saved && (
          <span className="text-[11px] text-green-600 font-medium shrink-0">✓ Salvato</span>
        )}

        {!confirmDelete && (
          <>
            <Btn
              variant="ghost"
              onClick={expanded ? onEditClose : onEditOpen}
              className="text-[12px] shrink-0"
            >
              {expanded ? "Annulla" : "Modifica"}
            </Btn>
            <Btn
              variant="ghost"
              onClick={onDeleteRequest}
              className="text-[12px] text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0"
            >
              Elimina
            </Btn>
          </>
        )}

        {confirmDelete && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-[#737373]">Sei sicuro? Questa azione è irreversibile.</span>
            <Btn
              variant="ghost"
              onClick={onDeleteConfirm}
              className="text-[12px] text-red-500 hover:text-red-700 hover:bg-red-50"
            >
              Sì, elimina
            </Btn>
            <Btn variant="ghost" onClick={onDeleteCancel} className="text-[12px]">
              Annulla
            </Btn>
          </div>
        )}
      </div>

      {/* Pannello editing espandibile */}
      {expanded && (
        <div className="border-t border-[#f0f0ef] px-4 pb-4 pt-3 flex flex-col gap-3 bg-[#fafafa]">
          {error && <Alert type="error">{error}</Alert>}
          <div>
            <Label>Testo del brief</Label>
            <Textarea
              value={editText}
              onChange={(e) => onEditChange(e.target.value)}
              rows={20}
              className="font-mono text-[12px]"
            />
          </div>
          <div className="flex gap-2">
            <Btn onClick={onSave} loading={saving}>
              {saving ? "Salvataggio…" : "Salva modifiche"}
            </Btn>
            <Btn variant="ghost" onClick={onEditClose}>
              Annulla
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

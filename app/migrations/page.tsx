"use client";

import { useState, useEffect } from "react";
import { Download, Trash2 } from "lucide-react";
import { PageHeader, Section, Card, Btn, Alert } from "@/components/ui";
import { apiFetch } from "@/lib/api";

// ── Tipi ────────────────────────────────────────────────────────────────────

type MigrationRecord = {
  id: string;
  name: string;
  old_domain: string;
  new_domains: Array<{ domain: string; label?: string }>;
  total_urls: number;
  matched_urls: number;
  created_at: string;
};

// ── Pagina ──────────────────────────────────────────────────────────────────

export default function MigrationsPage() {
  const [migrations, setMigrations] = useState<MigrationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/migrations")
      .then((r) => r.json())
      .then((data) => setMigrations(data))
      .catch(() => setError("Errore nel caricamento delle migrazioni"))
      .finally(() => setLoading(false));
  }, []);

  function handleDelete(id: string) {
    setMigrations((prev) => prev.filter((m) => m.id !== id));
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Migrazioni archiviate"
        subtitle="Storico analisi di migrazione redirect."
      />
      <Section>
        {error && <Alert type="error">{error}</Alert>}

        {loading && (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-lg bg-[#f4f4f3] animate-pulse" />
            ))}
          </div>
        )}

        {!loading && migrations.length === 0 && !error && (
          <p className="text-[13px] text-[#ababab] py-8 text-center">
            Nessuna migrazione archiviata.
          </p>
        )}

        {!loading && migrations.length > 0 && (
          <Card className="overflow-hidden">
            <div className="divide-y divide-[#f0f0f0]">
              {migrations.map((m) => (
                <MigrationRow key={m.id} migration={m} onDelete={handleDelete} />
              ))}
            </div>
          </Card>
        )}
      </Section>
    </div>
  );
}

// ── MigrationRow ─────────────────────────────────────────────────────────────

function MigrationRow({
  migration,
  onDelete,
}: {
  migration: MigrationRecord;
  onDelete: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const date = new Date(migration.created_at).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const pct =
    migration.total_urls > 0
      ? Math.round((migration.matched_urls / migration.total_urls) * 100)
      : 0;

  async function handleReexport() {
    setExporting(true);
    setRowError(null);
    try {
      const full = await apiFetch(`/api/migrations/${migration.id}`).then((r) => r.json());
      const r = await apiFetch("/api/migration/export-csv", {
        method: "POST",
        body: JSON.stringify({ results: full.results, old_domain: full.old_domain }),
      });
      if (!r.ok) throw new Error("Errore esportazione");
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${migration.old_domain.replace(/https?:\/\//, "")}-redirects.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      setRowError("Errore durante l'esportazione CSV");
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setRowError(null);
    try {
      const r = await apiFetch(`/api/migrations/${migration.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Errore eliminazione");
      onDelete(migration.id);
    } catch {
      setRowError("Errore durante l'eliminazione");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="px-4 py-3">
      {rowError && (
        <Alert type="error">{rowError}</Alert>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        {/* Info principale */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-[#1a1a1a] truncate">{migration.name}</p>
          <p className="text-[11px] text-[#ababab] mt-0.5">
            {migration.old_domain} · {date}
          </p>
        </div>

        {/* Match rate */}
        <div className="text-right shrink-0">
          <p className="text-[13px] font-semibold text-[#1a1a1a]">
            {migration.matched_urls}/{migration.total_urls}
          </p>
          <p className="text-[10.5px] text-[#ababab]">{pct}% matched</p>
        </div>

        {/* Azioni */}
        {!confirmDelete ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <Btn
              variant="ghost"
              onClick={handleReexport}
              loading={exporting}
              disabled={exporting}
            >
              <Download size={13} />
              Riesporta CSV
            </Btn>
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded text-[#ccc] hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Elimina migrazione"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[12px] text-[#555]">Eliminare definitivamente?</span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-[12px] font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
            >
              {deleting ? "…" : "Sì, elimina"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-[12px] text-[#ababab] hover:text-[#555]"
            >
              Annulla
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

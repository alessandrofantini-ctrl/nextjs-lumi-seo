"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader, Section, Label, Textarea, Btn, Alert } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { saveAs } from "file-saver";
import {
  Document, Packer, Paragraph, TextRun,
  HeadingLevel, AlignmentType, LevelFormat,
} from "docx";

type Article = {
  id: string;
  keyword: string;
  market: string;
  intent: string | null;
  created_at: string;
  client_id: string | null;
  article_output: string;
};

// ══════════════════════════════════════════════
//  DOCX HELPERS
// ══════════════════════════════════════════════

function parseInlineMarkdown(text: string): TextRun[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return new TextRun({ text: part.slice(2, -2), bold: true, font: "Arial", size: 24 });
    }
    return new TextRun({ text: part, font: "Arial", size: 24 });
  });
}

function parseMarkdownToDocx(markdown: string) {
  const lines = markdown.split("\n");

  const numbering = {
    config: [{
      reference: "bullets",
      levels: [{
        level: 0,
        format: LevelFormat.BULLET,
        text: "•",
        alignment: AlignmentType.LEFT,
        style: {
          paragraph: { indent: { left: 720, hanging: 360 } },
        },
      }],
    }],
  };

  const children: Paragraph[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      children.push(new Paragraph({ children: [] }));
      continue;
    }
    if (trimmed.startsWith("# ")) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: trimmed.replace(/^# /, ""), bold: true, font: "Arial", size: 32 })],
      }));
    } else if (trimmed.startsWith("## ")) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: trimmed.replace(/^## /, ""), bold: true, font: "Arial", size: 28 })],
      }));
    } else if (trimmed.startsWith("### ")) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: trimmed.replace(/^### /, ""), bold: true, font: "Arial", size: 26 })],
      }));
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      children.push(new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: parseInlineMarkdown(trimmed.replace(/^[-*] /, "")),
      }));
    } else {
      children.push(new Paragraph({ children: parseInlineMarkdown(trimmed) }));
    }
  }

  return { children, numbering };
}

async function handleExportDocx(article: Article) {
  const { children, numbering } = parseMarkdownToDocx(article.article_output);

  const doc = new Document({
    numbering,
    styles: {
      default: { document: { run: { font: "Arial", size: 24 } } },
      paragraphStyles: [
        {
          id: "Heading1", name: "Heading 1",
          basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 32, bold: true, font: "Arial" },
          paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 0 },
        },
        {
          id: "Heading2", name: "Heading 2",
          basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 28, bold: true, font: "Arial" },
          paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 1 },
        },
        {
          id: "Heading3", name: "Heading 3",
          basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 26, bold: true, font: "Arial" },
          paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 2 },
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const filename = `${article.keyword.replace(/\s+/g, "-").toLowerCase()}-articolo.docx`;
  saveAs(blob, filename);
}

// ══════════════════════════════════════════════
//  PAGE
// ══════════════════════════════════════════════

export default function ArticlesPage() {
  const [articles, setArticles]         = useState<Article[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [editTexts, setEditTexts]       = useState<Record<string, string>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [savingId, setSavingId]         = useState<string | null>(null);
  const [savedId, setSavedId]           = useState<string | null>(null);
  const [rowError, setRowError]         = useState<Record<string, string>>({});

  useEffect(() => {
    apiFetch("/api/writer/articles")
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => setArticles(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return articles;
    const q = search.toLowerCase();
    return articles.filter((a) => a.keyword.toLowerCase().includes(q));
  }, [articles, search]);

  function openEdit(article: Article) {
    setExpandedId(article.id);
    setConfirmDeleteId(null);
    if (!(article.id in editTexts)) {
      setEditTexts((prev) => ({ ...prev, [article.id]: article.article_output }));
    }
    setRowError((prev) => ({ ...prev, [article.id]: "" }));
  }

  function closeEdit() {
    setExpandedId(null);
  }

  async function handleSave(article: Article) {
    setSavingId(article.id);
    setRowError((prev) => ({ ...prev, [article.id]: "" }));
    try {
      const r = await apiFetch(`/api/writer/articles/${article.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          article_output: editTexts[article.id] ?? article.article_output,
        }),
      });
      if (!r.ok) throw new Error();
      setArticles((prev) =>
        prev.map((a) =>
          a.id === article.id
            ? { ...a, article_output: editTexts[article.id] ?? a.article_output }
            : a
        )
      );
      setExpandedId(null);
      setSavedId(article.id);
      setTimeout(() => setSavedId(null), 2000);
    } catch {
      setRowError((prev) => ({ ...prev, [article.id]: "Errore nel salvataggio. Riprova." }));
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(articleId: string) {
    try {
      const r = await apiFetch(`/api/writer/articles/${articleId}`, {
        method: "DELETE",
      });
      if (!r.ok) throw new Error();
      setArticles((prev) => prev.filter((a) => a.id !== articleId));
      setConfirmDeleteId(null);
    } catch {
      setRowError((prev) => ({ ...prev, [articleId]: "Errore nell'eliminazione. Riprova." }));
    }
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Articoli generati"
        subtitle="Visualizza, modifica ed elimina gli articoli SEO."
      />

      <Section>
        <div className="mb-4">
          <Label>Cerca per keyword</Label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="es. impianti fotovoltaici…"
            className="w-full px-3 py-2 rounded-lg bg-white border border-[#d9d9d9] text-[#1a1a1a] text-[13px] placeholder:text-[#c0c0c0] focus:outline-none focus:border-[#999] transition-colors"
          />
        </div>

        {loading ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-lg bg-[#f0f0ef] animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-[13px] text-[#ababab] py-8 text-center">
            {search ? "Nessun articolo trovato per questa ricerca." : "Nessun articolo generato."}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((article) => (
              <ArticleRow
                key={article.id}
                article={article}
                expanded={expandedId === article.id}
                editText={editTexts[article.id] ?? article.article_output}
                confirmDelete={confirmDeleteId === article.id}
                saving={savingId === article.id}
                saved={savedId === article.id}
                error={rowError[article.id] ?? ""}
                onEditOpen={() => openEdit(article)}
                onEditClose={closeEdit}
                onEditChange={(val) =>
                  setEditTexts((prev) => ({ ...prev, [article.id]: val }))
                }
                onSave={() => handleSave(article)}
                onExport={() => handleExportDocx(article)}
                onDeleteRequest={() => {
                  setConfirmDeleteId(article.id);
                  setExpandedId(null);
                  setRowError((prev) => ({ ...prev, [article.id]: "" }));
                }}
                onDeleteConfirm={() => handleDelete(article.id)}
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
//  ArticleRow
// ══════════════════════════════════════════════

type ArticleRowProps = {
  article: Article;
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
  onExport: () => void;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
};

function ArticleRow({
  article, expanded, editText, confirmDelete, saving, saved, error,
  onEditOpen, onEditClose, onEditChange, onSave, onExport,
  onDeleteRequest, onDeleteConfirm, onDeleteCancel,
}: ArticleRowProps) {
  const date = new Date(article.created_at).toLocaleDateString("it-IT");
  const meta = [article.market, article.intent, date].filter(Boolean).join(" · ");

  return (
    <div className="rounded-lg border border-[#e8e8e8] bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-[#1a1a1a] truncate">{article.keyword}</p>
          <p className="text-[11px] text-[#ababab] mt-0.5">{meta}</p>
        </div>

        {saved && (
          <span className="text-[11px] text-green-600 font-medium shrink-0">✓ Salvato</span>
        )}

        {!confirmDelete && (
          <>
            <Btn variant="ghost" onClick={onExport} className="text-[12px] shrink-0">
              Esporta .docx
            </Btn>
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
            <span className="text-[11px] text-[#737373]">
              Sei sicuro? L&apos;articolo verrà rimosso (il brief resterà disponibile).
            </span>
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

      {expanded && (
        <div className="border-t border-[#f0f0ef] px-4 pb-4 pt-3 flex flex-col gap-3 bg-[#fafafa]">
          {error && <Alert type="error">{error}</Alert>}
          <div>
            <Label>Testo dell&apos;articolo</Label>
            <Textarea
              value={editText}
              onChange={(e) => onEditChange(e.target.value)}
              rows={24}
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

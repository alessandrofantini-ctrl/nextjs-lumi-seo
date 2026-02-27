import Link from "next/link";

const TOOLS = [
  {
    href: "/clients",
    emoji: "👤",
    title: "Gestione clienti",
    desc: "Crea e gestisci i profili dei tuoi clienti: prodotti, USP e tono di voce.",
  },
  {
    href: "/seo",
    emoji: "🔎",
    title: "Analisi & Strategia SEO",
    desc: "Analizza le keyword, studia i competitor e genera il brief editoriale.",
  },
  {
    href: "/writer",
    emoji: "✍️",
    title: "Redattore articoli AI",
    desc: "Trasforma il brief in un articolo completo, formattato e ottimizzato.",
  },
];

export default function HomePage() {
  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-semibold text-white/90 mb-1">
        ✨ Lumi SEO Suite
      </h1>
      <p className="text-white/40 text-sm mb-10">
        Gli strumenti interni per la strategia SEO di Lumi Company.
      </p>

      <div className="flex flex-col gap-4">
        {TOOLS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="flex items-start gap-4 p-5 rounded-xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05] hover:border-[#7c6af7]/40 transition-all group"
          >
            <span className="text-2xl mt-0.5">{t.emoji}</span>
            <div>
              <p className="text-white/90 font-medium group-hover:text-[#a89ff9] transition-colors">
                {t.title}
              </p>
              <p className="text-white/40 text-sm mt-0.5">{t.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      <p className="mt-10 text-[11px] text-white/20">
        Workflow consigliato: Clienti → Analisi SEO → Redattore
      </p>
    </div>
  );
}

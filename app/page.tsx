import Link from "next/link";
import { Users, BarChart2, PenLine } from "lucide-react";

const TOOLS = [
  {
    href: "/clients",
    icon: Users,
    step: "01",
    title: "Gestione clienti",
    desc: "Crea i profili clienti con prodotti, USP e tono di voce. Vengono caricati automaticamente negli altri strumenti.",
  },
  {
    href: "/seo",
    icon: BarChart2,
    step: "02",
    title: "Analisi & Strategia SEO",
    desc: "Analizza le keyword, studia i competitor in SERP e genera il brief editoriale con GPT-4o.",
  },
  {
    href: "/writer",
    icon: PenLine,
    step: "03",
    title: "Redattore articoli AI",
    desc: "Trasforma il brief in un articolo completo, formattato in Markdown e pronto per la pubblicazione.",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 pt-12 pb-8 border-b border-white/[0.06]">
        <p className="text-xs text-white/30 uppercase tracking-widest mb-3 font-medium">
          Lumi Company · Strumenti interni
        </p>
        <h1 className="text-[28px] font-semibold text-white/90 leading-tight mb-2">
          SEO Suite
        </h1>
        <p className="text-white/40 text-sm max-w-md">
          Pipeline operativa per keyword strategy, brief editoriali e articoli ottimizzati.
        </p>
      </div>

      {/* Cards */}
      <div className="flex-1 px-8 py-8">
        <div className="flex flex-col gap-2 max-w-2xl">
          {TOOLS.map(({ href, icon: Icon, step, title, desc }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-start gap-4 p-5 rounded-xl border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.04] hover:border-white/[0.12] transition-all duration-150"
            >
              {/* Step badge */}
              <div className="shrink-0 w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center group-hover:bg-[#7c6af7]/20 group-hover:border-[#7c6af7]/30 transition-all">
                <Icon size={14} strokeWidth={1.8} className="text-white/40 group-hover:text-[#a89ff9] transition-colors" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-medium text-white/20 tabular-nums">{step}</span>
                  <p className="text-[13px] font-medium text-white/80 group-hover:text-white transition-colors">
                    {title}
                  </p>
                </div>
                <p className="text-[12px] text-white/35 leading-relaxed">{desc}</p>
              </div>

              <span className="shrink-0 text-white/15 group-hover:text-white/40 transition-colors mt-0.5">
                →
              </span>
            </Link>
          ))}
        </div>

        <p className="mt-8 text-[11px] text-white/20">
          Workflow consigliato: Clienti → Analisi SEO → Redattore
        </p>
      </div>
    </div>
  );
}

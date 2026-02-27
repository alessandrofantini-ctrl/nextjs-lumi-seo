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
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-8 pt-12 pb-8 border-b border-[#e8e8e8]">
        <p className="text-[11px] text-[#ababab] uppercase tracking-widest mb-3 font-medium">
          Lumi Company · Strumenti interni
        </p>
        <h1 className="text-[26px] font-semibold text-[#1a1a1a] leading-tight mb-2">
          SEO Suite
        </h1>
        <p className="text-[#8f8f8f] text-[13px] max-w-md">
          Pipeline operativa per keyword strategy, brief editoriali e articoli ottimizzati.
        </p>
      </div>

      {/* Cards */}
      <div className="flex-1 px-8 py-8 bg-[#f7f7f6]">
        <div className="flex flex-col gap-2 max-w-2xl">
          {TOOLS.map(({ href, icon: Icon, step, title, desc }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-start gap-4 p-5 rounded-xl border border-[#e8e8e8] bg-white hover:border-[#ccc] hover:shadow-sm transition-all duration-150"
            >
              {/* Icon */}
              <div className="shrink-0 w-8 h-8 rounded-lg bg-[#f5f5f4] border border-[#e8e8e8] flex items-center justify-center group-hover:bg-[#f0f0ef] transition-colors">
                <Icon size={14} strokeWidth={1.8} className="text-[#737373]" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-medium text-[#c0c0c0] tabular-nums">{step}</span>
                  <p className="text-[13px] font-medium text-[#1a1a1a]">{title}</p>
                </div>
                <p className="text-[12px] text-[#8f8f8f] leading-relaxed">{desc}</p>
              </div>

              <span className="shrink-0 text-[#ccc] group-hover:text-[#999] transition-colors mt-0.5 text-sm">
                →
              </span>
            </Link>
          ))}
        </div>

        <p className="mt-8 text-[11px] text-[#c0c0c0]">
          Workflow consigliato: Clienti → Analisi SEO → Redattore
        </p>
      </div>
    </div>
  );
}

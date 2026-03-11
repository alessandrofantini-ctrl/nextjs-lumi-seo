import Link from "next/link";
import {
  Users, Calendar,
  BarChart2, PenLine, ArrowLeftRight,
} from "lucide-react";

const ICONS = {
  Users, Calendar,
  BarChart2, PenLine, ArrowLeftRight,
};

export default function HomePage() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-8 pt-9 pb-6 border-b border-[#e8e8e8] bg-white">
        <p className="text-[11px] font-medium text-[#ababab] uppercase tracking-wide mb-1">
          Lumi Company · Strumenti interni
        </p>
        <h1 className="text-[24px] font-semibold text-[#1a1a1a]">
          SEO Suite
        </h1>
        <p className="text-[#8f8f8f] text-[13px] mt-1 max-w-lg">
          Pipeline operativa per keyword strategy, monitoraggio posizioni, brief editoriali
          e gestione migrazioni SEO.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto bg-[#f7f7f6]">
        <div className="px-8 py-7 flex flex-col gap-3 max-w-2xl">
          <ToolCard
            number="01"
            title="Clienti & Dashboard"
            description="Panoramica cross-cliente con trend keyword, profili e pipeline editoriale."
            href="/clients"
            icon="Users"
          />
          <ToolCard
            number="02"
            title="Calendario"
            description="Pianifica le lavorazioni mensili delle keyword cross-cliente."
            href="/calendar"
            icon="Calendar"
          />
          <ToolCard
            number="03"
            title="Analisi SEO"
            description="Analizza le SERP, studia i competitor e genera brief con GPT-4o."
            href="/seo"
            icon="BarChart2"
          />
          <ToolCard
            number="04"
            title="Redattore"
            description="Trasforma il brief in un articolo completo, ottimizzato e pronto per la pubblicazione."
            href="/writer"
            icon="PenLine"
          />
          <ToolCard
            number="05"
            title="Migrazione"
            description="Mappa i redirect 301 tra sito vecchio e nuovo con matching GPT-4o."
            href="/migration"
            icon="ArrowLeftRight"
          />
          <p className="text-[11px] text-[#c0c0c0] mt-2">
            Workflow consigliato: Clienti → Analisi SEO → Calendario → Redattore
          </p>
        </div>
      </div>
    </div>
  );
}

function ToolCard({
  number, title, description, href, icon,
}: {
  number: string; title: string; description: string;
  href: string; icon: keyof typeof ICONS;
}) {
  const Icon = ICONS[icon];
  return (
    <Link href={href}>
      <div className="flex items-center gap-4 px-5 py-4 rounded-xl border border-[#e8e8e8] bg-white hover:border-[#ccc] hover:shadow-sm transition-all cursor-pointer">
        <div className="w-8 h-8 rounded-lg bg-[#f7f7f6] border border-[#e8e8e8] flex items-center justify-center shrink-0">
          <Icon size={15} className="text-[#737373]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-medium text-[#c0c0c0]">{number}</span>
            <p className="text-[13px] font-semibold text-[#1a1a1a]">{title}</p>
          </div>
          <p className="text-[12px] text-[#8f8f8f] truncate">{description}</p>
        </div>
        <span className="text-[#ccc] text-sm shrink-0">→</span>
      </div>
    </Link>
  );
}

"use client";

import { useEffect, useState } from "react";
import { PageHeader, Section, Label, Btn } from "@/components/ui";

export default function ImpostazioniPage() {
  const [openaiKey, setOpenaiKey] = useState("");
  const [serpKey, setSerpKey]     = useState("");
  const [saved, setSaved]         = useState(false);

  useEffect(() => {
    setOpenaiKey(localStorage.getItem("openai_key") || "");
    setSerpKey(localStorage.getItem("serp_key") || "");
  }, []);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("openai_key", openaiKey);
    localStorage.setItem("serp_key", serpKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Impostazioni"
        subtitle="Le API key vengono salvate solo nel browser (localStorage) e non nel database."
      />

      <Section className="max-w-xl">
        <form onSubmit={save} className="flex flex-col gap-6">

          <KeyField
            label="OpenAI API Key"
            value={openaiKey}
            onChange={setOpenaiKey}
            placeholder="sk-..."
            hint={<>Per generare brief e articoli con GPT-4o. <ExternalLink href="https://platform.openai.com/api-keys">platform.openai.com</ExternalLink></>}
          />

          <KeyField
            label="SerpAPI Key"
            value={serpKey}
            onChange={setSerpKey}
            placeholder="La tua SerpAPI key…"
            hint={<>Per recuperare i risultati SERP di Google. <ExternalLink href="https://serpapi.com/dashboard">serpapi.com</ExternalLink></>}
          />

          <div>
            <Btn type="submit">
              {saved ? "✓ Salvato" : "Salva"}
            </Btn>
          </div>
        </form>

        {/* Info box */}
        <div className="mt-10 p-4 rounded-lg border border-white/[0.06] bg-white/[0.01]">
          <p className="text-[11px] font-medium text-white/35 uppercase tracking-wide mb-2">Come funziona</p>
          <ul className="flex flex-col gap-1.5 text-[12px] text-white/30 list-disc list-inside">
            <li>Le key vengono lette dal browser e inviate al backend ad ogni richiesta</li>
            <li>Non vengono mai salvate nel database Supabase</li>
            <li>Se cambi browser o usi la modalità anonima dovrai reinserirle</li>
          </ul>
        </div>
      </Section>
    </div>
  );
}

function KeyField({ label, value, onChange, placeholder, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; hint?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg bg-[#1a1a1a] border border-white/[0.09] text-white/80 text-[13px] placeholder:text-white/20 focus:outline-none focus:border-white/20 transition-colors"
      />
      {hint && <p className="text-[11px] text-white/25">{hint}</p>}
    </div>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-white/45 hover:text-white/70 underline underline-offset-2">
      {children}
    </a>
  );
}

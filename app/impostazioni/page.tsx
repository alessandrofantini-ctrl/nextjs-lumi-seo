"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, Section, Label, Input, Btn, Alert } from "@/components/ui";
import { createClient } from "@/utils/supabase/client";

const OPENAI_KEY = "lumi_openai_key";
const SERP_KEY   = "lumi_serpapi_key";

export default function ImpostazioniPage() {
  const router = useRouter();
  const [email, setEmail]       = useState<string | null>(null);
  const [openaiKey, setOpenaiKey] = useState("");
  const [serpKey, setSerpKey]   = useState("");
  const [saved, setSaved]       = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
    setOpenaiKey(localStorage.getItem(OPENAI_KEY) ?? "");
    setSerpKey(localStorage.getItem(SERP_KEY) ?? "");
  }, []);

  function handleSaveKeys(e: React.FormEvent) {
    e.preventDefault();
    if (openaiKey.trim()) localStorage.setItem(OPENAI_KEY, openaiKey.trim());
    else localStorage.removeItem(OPENAI_KEY);
    if (serpKey.trim()) localStorage.setItem(SERP_KEY, serpKey.trim());
    else localStorage.removeItem(SERP_KEY);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Impostazioni" subtitle="Gestione account e configurazione." />

      <Section className="max-w-xl">
        <div className="flex flex-col gap-6">

          {/* Account info */}
          <div className="bg-white border border-[#e8e8e8] rounded-xl p-5">
            <p className="text-[11px] font-medium text-[#ababab] uppercase tracking-wide mb-3">Account</p>
            <p className="text-[13px] text-[#1a1a1a]">{email ?? "Caricamento…"}</p>
          </div>

          {/* API Keys */}
          <div className="bg-white border border-[#e8e8e8] rounded-xl p-5">
            <p className="text-[11px] font-medium text-[#ababab] uppercase tracking-wide mb-4">API Key</p>
            <form onSubmit={handleSaveKeys} className="flex flex-col gap-4">
              <div>
                <Label>OpenAI API Key</Label>
                <Input
                  type="password"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-..."
                />
              </div>
              <div>
                <Label>SerpAPI Key</Label>
                <Input
                  type="password"
                  value={serpKey}
                  onChange={(e) => setSerpKey(e.target.value)}
                  placeholder="La tua SerpAPI key"
                />
              </div>
              {saved && <Alert type="info">Chiavi salvate nel browser.</Alert>}
              <p className="text-[11px] text-[#ababab]">
                Le chiavi vengono salvate solo nel browser (localStorage) e inviate in modo sicuro ad ogni richiesta. Non vengono mai memorizzate sul server.
              </p>
              <Btn type="submit">Salva chiavi</Btn>
            </form>
          </div>

          {/* Note */}
          <div className="p-4 rounded-lg border border-[#e8e8e8] bg-[#f7f7f6]">
            <p className="text-[11px] font-medium text-[#ababab] uppercase tracking-wide mb-2">Note</p>
            <ul className="flex flex-col gap-1.5 text-[12px] text-[#8f8f8f] list-disc list-inside">
              <li>Per aggiungere utenti usa la Dashboard Supabase → Authentication</li>
              <li>Per recuperare l&apos;accesso contatta l&apos;amministratore</li>
            </ul>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2.5 rounded-lg border border-red-200 text-red-600 text-[13px] font-medium hover:bg-red-50 transition-colors text-left"
          >
            Esci dall&apos;account
          </button>

        </div>
      </Section>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, Section } from "@/components/ui";
import { createClient } from "@/utils/supabase/client";

export default function ImpostazioniPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

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

          {/* Info box */}
          <div className="p-4 rounded-lg border border-[#e8e8e8] bg-[#f7f7f6]">
            <p className="text-[11px] font-medium text-[#ababab] uppercase tracking-wide mb-2">Note</p>
            <ul className="flex flex-col gap-1.5 text-[12px] text-[#8f8f8f] list-disc list-inside">
              <li>Le API key (OpenAI, SerpAPI) sono configurate sul server</li>
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

"use client";

import { useEffect, useState } from "react";

export default function ImpostazioniPage() {
  const [openaiKey, setOpenaiKey] = useState("");
  const [serpKey, setSerpKey] = useState("");
  const [saved, setSaved] = useState(false);

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
    <div className="p-8 max-w-xl">
      <h1 className="text-2xl font-semibold text-white/90 mb-1">⚙️ Impostazioni</h1>
      <p className="text-white/40 text-sm mb-8">
        Le API key vengono salvate solo nel tuo browser (localStorage) e non inviate a nessun server.
      </p>

      <form onSubmit={save} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <label className="text-white/60 text-sm font-medium">OpenAI API Key</label>
          <input
            type="password"
            value={openaiKey}
            onChange={(e) => setOpenaiKey(e.target.value)}
            placeholder="sk-..."
            className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white/80 text-sm placeholder:text-white/20 focus:outline-none focus:border-[#7c6af7]/50"
          />
          <p className="text-white/25 text-xs mt-0.5">
            Usata per generare brief (GPT-4o) e articoli. Ottienila su{" "}
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noreferrer"
              className="text-[#7c6af7] hover:underline"
            >
              platform.openai.com
            </a>
            .
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-white/60 text-sm font-medium">SerpAPI Key</label>
          <input
            type="password"
            value={serpKey}
            onChange={(e) => setSerpKey(e.target.value)}
            placeholder="La tua SerpAPI key..."
            className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white/80 text-sm placeholder:text-white/20 focus:outline-none focus:border-[#7c6af7]/50"
          />
          <p className="text-white/25 text-xs mt-0.5">
            Usata per recuperare i risultati SERP di Google. Ottienila su{" "}
            <a
              href="https://serpapi.com/dashboard"
              target="_blank"
              rel="noreferrer"
              className="text-[#7c6af7] hover:underline"
            >
              serpapi.com
            </a>
            .
          </p>
        </div>

        <button
          type="submit"
          className="mt-2 px-6 py-2.5 rounded-lg bg-[#7c6af7] hover:bg-[#6b5ae6] text-white text-sm font-medium transition-colors w-fit"
        >
          {saved ? "✅ Salvato!" : "Salva"}
        </button>
      </form>

      <div className="mt-8 p-4 rounded-lg bg-white/[0.02] border border-white/[0.06] text-white/30 text-xs">
        <p className="font-medium text-white/40 mb-1">Come funziona</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Le key vengono lette dal browser e inviate al backend Render ad ogni richiesta</li>
          <li>Non vengono mai salvate nel database</li>
          <li>Se cambi browser o apri in modalità anonima dovrai reinserirle</li>
        </ul>
      </div>
    </div>
  );
}

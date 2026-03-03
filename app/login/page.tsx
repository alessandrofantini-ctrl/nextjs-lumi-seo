"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("Email o password non corretti.");
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#f7f7f6] flex items-center justify-center">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-7 h-7 rounded-md bg-[#1a1a1a] flex items-center justify-center">
            <span className="text-[12px] font-bold text-white">L</span>
          </div>
          <span className="text-base font-semibold text-[#1a1a1a] tracking-tight">
            Lumi SEO Suite
          </span>
        </div>

        {/* Card */}
        <div className="bg-white border border-[#e8e8e8] rounded-xl p-8">
          <h1 className="text-[15px] font-semibold text-[#1a1a1a] mb-1">Accedi</h1>
          <p className="text-[12px] text-[#ababab] mb-6">
            Usa le credenziali fornite dal tuo amministratore.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-[#737373] uppercase tracking-wide">
                Email
              </label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white border border-[#d9d9d9] text-[#1a1a1a] text-[13px] placeholder:text-[#c0c0c0] focus:outline-none focus:border-[#999] transition-colors"
                placeholder="nome@esempio.com"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-[#737373] uppercase tracking-wide">
                Password
              </label>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white border border-[#d9d9d9] text-[#1a1a1a] text-[13px] placeholder:text-[#c0c0c0] focus:outline-none focus:border-[#999] transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-1 px-4 py-2.5 rounded-lg bg-[#1a1a1a] text-white text-[13px] font-medium hover:bg-[#2d2d2d] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Accesso in corso…" : "Accedi"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

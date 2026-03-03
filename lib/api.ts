import { createClient } from "@/utils/supabase/client";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

export async function apiFetch(path: string, options: RequestInit = {}) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const apiHeaders: Record<string, string> = {};

  if (typeof window !== "undefined") {
    const openaiKey = localStorage.getItem("lumi_openai_key");
    const serpKey   = localStorage.getItem("lumi_serpapi_key");
    if (openaiKey) apiHeaders["X-OpenAI-Key"] = openaiKey;
    if (serpKey)   apiHeaders["X-SerpAPI-Key"] = serpKey;
  }

  return fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {}),
      ...apiHeaders,
      ...(options.headers as Record<string, string>),
    },
  });
}

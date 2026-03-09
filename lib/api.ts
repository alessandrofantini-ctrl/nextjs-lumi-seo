import { createClient } from "@/utils/supabase/client";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

export async function apiFetch(path: string, options: RequestInit = {}) {
  const supabase = createClient();

  // Prova a refreshare il token se scaduto
  const { data: { session } } = await supabase.auth.getSession();

  const apiHeaders: Record<string, string> = {};

  if (typeof window !== "undefined") {
    const openaiKey = localStorage.getItem("lumi_openai_key");
    const serpKey   = localStorage.getItem("lumi_serpapi_key");
    if (openaiKey) apiHeaders["X-OpenAI-Key"] = openaiKey;
    if (serpKey)   apiHeaders["X-SerpAPI-Key"] = serpKey;
  }

  const response = await fetch(`${API}${path}`, {
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

  // Token scaduto: forza logout e reindirizza al login
  if (response.status === 401 && typeof window !== "undefined") {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return response;
}

export async function apiFetchForm(path: string, body: FormData, options: RequestInit = {}) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  const apiHeaders: Record<string, string> = {};
  if (typeof window !== "undefined") {
    const openaiKey = localStorage.getItem("lumi_openai_key");
    const serpKey   = localStorage.getItem("lumi_serpapi_key");
    if (openaiKey) apiHeaders["X-OpenAI-Key"] = openaiKey;
    if (serpKey)   apiHeaders["X-SerpAPI-Key"] = serpKey;
  }

  const response = await fetch(`${API}${path}`, {
    ...options,
    method: options.method ?? "POST",
    body,
    headers: {
      // No Content-Type — browser sets multipart/form-data + boundary automatically
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...apiHeaders,
      ...(options.headers as Record<string, string>),
    },
  });

  if (response.status === 401 && typeof window !== "undefined") {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return response;
}

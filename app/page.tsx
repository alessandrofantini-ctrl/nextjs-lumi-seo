"use client";

import { useEffect, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function HomePage() {
  const [status, setStatus] = useState("verifico...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!API_BASE_URL) {
      setStatus("NEXT_PUBLIC_API_BASE_URL non impostata");
      return;
    }

    fetch(`${API_BASE_URL}/`)
      .then(async (res) => {
        const data = await res.json();
        setStatus(JSON.stringify(data));
      })
      .catch((err) => {
        console.error(err);
        setError("errore chiamando il backend");
      });
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <h1>Lumi seo suite</h1>
      <p>stato backend:</p>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <pre>{status}</pre>
    </main>
  );
}

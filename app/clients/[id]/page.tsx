"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

type KeywordHistory = {
  id: string;
  keyword: string;
  created_at: string;
};

type Brief = {
  id: string;
  keyword: string;
  market: string;
  intent: string;
  created_at: string;
};

type ClientFull = {
  id: string;
  name: string;
  url?: string;
  sector?: string;
  brand_name?: string;
  tone_of_voice?: string;
  usp?: string;
  products_services?: string;
  target_audience?: string;
  geo?: string;
  notes?: string;
  keyword_history: KeywordHistory[];
  briefs: Brief[];
};

export default function ClientPage() {
  const { id } = useParams();
  const clientId = id as string;

  const [client, setClient] = useState<ClientFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newKeyword, setNewKeyword] = useState("");

  const loadClient = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API}/api/clients/${clientId}`);
      if (!res.ok) throw new Error("Errore nel caricamento cliente");

      const data = await res.json();
      setClient(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addKeyword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newKeyword.trim()) return;

    try {
      const res = await fetch(`${API}/api/clients/${clientId}/keywords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: newKeyword }),
      });

      if (!res.ok) throw new Error("Errore nell'aggiunta keyword");

      setNewKeyword("");
      loadClient();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteKeyword = async (keywordId: string) => {
    try {
      const res = await fetch(`${API}/api/clients/${clientId}/keywords/${keywordId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Errore nella cancellazione keyword");

      loadClient();
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadClient();
  }, [clientId]);

  if (loading) return <p style={{ padding: 24 }}>Caricamento...</p>;
  if (error) return <p style={{ padding: 24, color: "red" }}>Errore: {error}</p>;
  if (!client) return <p style={{ padding: 24 }}>Cliente non trovato</p>;

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1>{client.name}</h1>

      {client.url && (
        <p>
          <strong>Sito:</strong>{" "}
          <a href={client.url} target="_blank" rel="noreferrer">
            {client.url}
          </a>
        </p>
      )}

      {client.sector && (
        <p>
          <strong>Settore:</strong> {client.sector}
        </p>
      )}

      <hr style={{ margin: "24px 0" }} />

      <h2>Storico keyword</h2>

      <form onSubmit={addKeyword} style={{ marginBottom: 16 }}>
        <input
          value={newKeyword}
          onChange={(e) => setNewKeyword(e.target.value)}
          placeholder="Aggiungi keyword"
          style={{ padding: 6, width: 250 }}
        />
        <button type="submit" style={{ marginLeft: 8 }}>
          Aggiungi
        </button>
      </form>

      <ul>
        {client.keyword_history.map((kw) => (
          <li key={kw.id} style={{ marginBottom: 8 }}>
            <strong>{kw.keyword}</strong>{" "}
            <small>({new Date(kw.created_at).toLocaleDateString()})</small>{" "}
            <button
              onClick={() => deleteKeyword(kw.id)}
              style={{ marginLeft: 8, color: "red" }}
            >
              x
            </button>
          </li>
        ))}
      </ul>

      <hr style={{ margin: "24px 0" }} />

      <h2>Brief generati</h2>

      {client.briefs.length === 0 && <p>Nessun brief ancora.</p>}

      <ul>
        {client.briefs.map((b) => (
          <li key={b.id} style={{ marginBottom: 12 }}>
            <strong>{b.keyword}</strong> — {b.market} — {b.intent}
            <br />
            <small>{new Date(b.created_at).toLocaleString()}</small>
          </li>
        ))}
      </ul>
    </main>
  );
}

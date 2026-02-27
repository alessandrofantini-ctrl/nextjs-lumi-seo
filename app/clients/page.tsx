"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

type Client = {
  id: string;
  name: string;
  url?: string;
  sector?: string;
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadClients = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API}/api/clients`);
      const data = await res.json();
      setClients(data);
    } catch (err: any) {
      setError("Errore nel caricamento clienti");
    } finally {
      setLoading(false);
    }
  };

  const createClient = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch(`${API}/api/clients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) throw new Error();

      setName("");
      loadClients();
    } catch (err) {
      setError("Impossibile creare cliente (probabile duplicato).");
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <h1>Clienti</h1>

      <form onSubmit={createClient} style={{ marginTop: 20 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome cliente"
        />
        <button type="submit">Crea</button>
      </form>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <h2 style={{ marginTop: 40 }}>Lista clienti</h2>

      {loading && <p>Caricamento…</p>}

      <ul>
        {clients.map((c) => (
          <li key={c.id}>
            <strong>{c.name}</strong>  
            {c.url && (
              <>
                {" "}<small>({c.url})</small>
              </>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}

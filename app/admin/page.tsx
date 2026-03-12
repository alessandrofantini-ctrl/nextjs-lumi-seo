"use client";

import { useState, useEffect } from "react";
import { PageHeader, Section, Card, Btn, Alert, Input } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";

// ── Tipi ────────────────────────────────────────────────────────────────────

type UserProfile = {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "specialist";
  created_at: string;
};

type ClientAdmin = {
  id: string;
  name: string;
  owner_id: string | null;
  assigned_to: string | null;
  owner: { id: string; email: string; full_name: string } | null;
  assigned: { id: string; email: string; full_name: string } | null;
};

// ── Pagina ──────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user, loading, isAdmin } = useCurrentUser();
  const [tab, setTab] = useState<"users" | "assignments">("users");

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title="Amministrazione" subtitle="Gestione utenti e assegnazioni." />
        <Section>
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-lg bg-[#f4f4f3] animate-pulse" />
            ))}
          </div>
        </Section>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title="Amministrazione" subtitle="Gestione utenti e assegnazioni." />
        <Section>
          <Alert type="error">Accesso riservato agli amministratori.</Alert>
        </Section>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Amministrazione"
        subtitle={`Connesso come ${user?.full_name || user?.email} (${user?.role})`}
      />

      {/* Tab switcher */}
      <div className="px-6 flex gap-2 mb-4">
        {(["users", "assignments"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded text-[12.5px] font-medium transition-colors ${
              tab === t
                ? "bg-[#6366f1] text-white"
                : "text-[#888] hover:text-[#333] hover:bg-[#f4f4f3]"
            }`}
          >
            {t === "users" ? "Utenti" : "Assegnazioni"}
          </button>
        ))}
      </div>

      <Section>
        {tab === "users" ? <UsersTab /> : <AssignmentsTab />}
      </Section>
    </div>
  );
}

// ── Tab Utenti ───────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form nuovo utente
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"specialist" | "admin">("specialist");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await apiFetch("/api/admin/users");
      setUsers(await r.json());
    } catch {
      setError("Errore nel caricamento degli utenti");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const r = await apiFetch("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ email, password, full_name: fullName, role }),
      });
      if (!r.ok) {
        const data = await r.json();
        throw new Error(data.detail || "Errore creazione utente");
      }
      const newUser = await r.json();
      setUsers((prev) => [...prev, newUser]);
      setEmail(""); setPassword(""); setFullName(""); setRole("specialist");
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function handleRoleToggle(user: UserProfile) {
    const newRole = user.role === "admin" ? "specialist" : "admin";
    try {
      const r = await apiFetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ role: newRole }),
      });
      if (!r.ok) throw new Error();
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, role: newRole } : u));
    } catch {
      setError("Errore aggiornamento ruolo");
    }
  }

  async function handleDelete(userId: string) {
    try {
      const r = await apiFetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      if (!r.ok) throw new Error();
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch {
      setError("Errore eliminazione utente");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Form nuovo utente */}
      <Card className="p-4">
        <p className="text-[12px] font-semibold text-[#1a1a1a] mb-3">Nuovo utente</p>
        {createError && <Alert type="error">{createError}</Alert>}
        <form onSubmit={handleCreate} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Input
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Nome completo (opzionale)"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "specialist" | "admin")}
              className="flex-1 border border-[#e8e8e8] rounded-lg px-3 py-2 text-[13px] text-[#1a1a1a]"
            >
              <option value="specialist">SEO Specialist</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex justify-end">
            <Btn type="submit" loading={creating} disabled={creating}>
              Crea utente
            </Btn>
          </div>
        </form>
      </Card>

      {/* Lista utenti */}
      {error && <Alert type="error">{error}</Alert>}
      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2].map((i) => <div key={i} className="h-12 rounded-lg bg-[#f4f4f3] animate-pulse" />)}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-[#f0f0f0]">
            {users.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                onRoleToggle={handleRoleToggle}
                onDelete={handleDelete}
              />
            ))}
            {users.length === 0 && (
              <p className="text-[13px] text-[#ababab] py-8 text-center">Nessun utente.</p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function UserRow({
  user,
  onRoleToggle,
  onDelete,
}: {
  user: UserProfile;
  onRoleToggle: (u: UserProfile) => void;
  onDelete: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const date = new Date(user.created_at).toLocaleDateString("it-IT", {
    day: "2-digit", month: "short", year: "numeric",
  });

  return (
    <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-[#1a1a1a] truncate">
          {user.full_name || user.email}
        </p>
        <p className="text-[11px] text-[#ababab] mt-0.5">{user.email} · {date}</p>
      </div>

      <span className={`text-[11px] font-medium px-2 py-0.5 rounded border ${
        user.role === "admin"
          ? "bg-[#ede9fe] text-[#6d28d9] border-[#ddd6fe]"
          : "bg-[#f4f4f3] text-[#555] border-[#e8e8e8]"
      }`}>
        {user.role === "admin" ? "Admin" : "Specialist"}
      </span>

      {!confirmDelete ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <Btn variant="ghost" onClick={() => onRoleToggle(user)}>
            {user.role === "admin" ? "→ Specialist" : "→ Admin"}
          </Btn>
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-[12px] text-[#ccc] hover:text-red-500 px-2 py-1 rounded hover:bg-red-50 transition-colors"
          >
            Elimina
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[12px] text-[#555]">Eliminare definitivamente?</span>
          <button
            onClick={() => onDelete(user.id)}
            className="text-[12px] font-medium text-red-600 hover:text-red-800"
          >
            Sì, elimina
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            className="text-[12px] text-[#ababab] hover:text-[#555]"
          >
            Annulla
          </button>
        </div>
      )}
    </div>
  );
}

// ── Tab Assegnazioni ─────────────────────────────────────────────────────────

function AssignmentsTab() {
  const [clients, setClients] = useState<ClientAdmin[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch("/api/admin/clients").then((r) => r.json()),
      apiFetch("/api/admin/users").then((r) => r.json()),
    ])
      .then(([c, u]) => { setClients(c); setUsers(u); })
      .catch(() => setError("Errore nel caricamento"))
      .finally(() => setLoading(false));
  }, []);

  async function handleAssign(clientId: string, assignedTo: string | null) {
    try {
      const r = await apiFetch(`/api/admin/clients/${clientId}/assign`, {
        method: "PATCH",
        body: JSON.stringify({ assigned_to: assignedTo }),
      });
      if (!r.ok) throw new Error();
      const updated = await r.json();
      setClients((prev) =>
        prev.map((c) => {
          if (c.id !== clientId) return c;
          const assignedUser = users.find((u) => u.id === assignedTo) || null;
          return {
            ...c,
            assigned_to: assignedTo,
            assigned: assignedUser
              ? { id: assignedUser.id, email: assignedUser.email, full_name: assignedUser.full_name }
              : null,
          };
        })
      );
    } catch {
      setError("Errore durante l'assegnazione");
    }
  }

  const specialists = users.filter((u) => u.role === "specialist");

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert type="error">{error}</Alert>}
      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-lg bg-[#f4f4f3] animate-pulse" />)}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-[#f0f0f0]">
            {clients.map((c) => (
              <div key={c.id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#1a1a1a] truncate">{c.name}</p>
                  <p className="text-[11px] text-[#ababab] mt-0.5">
                    Owner: {c.owner?.full_name || c.owner?.email || "—"}
                  </p>
                </div>
                <div className="shrink-0">
                  <select
                    value={c.assigned_to || ""}
                    onChange={(e) => handleAssign(c.id, e.target.value || null)}
                    className="border border-[#e8e8e8] rounded-lg px-2 py-1.5 text-[12.5px] text-[#1a1a1a]"
                  >
                    <option value="">Nessuna assegnazione</option>
                    {specialists.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name || u.email}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
            {clients.length === 0 && (
              <p className="text-[13px] text-[#ababab] py-8 text-center">Nessun cliente.</p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

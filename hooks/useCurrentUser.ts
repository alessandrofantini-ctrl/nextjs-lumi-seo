"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";

type UserProfile = {
  id: string;
  email: string;
  role: "admin" | "specialist";
  full_name: string;
};

export function useCurrentUser() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setUser(data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  return {
    user,
    loading,
    isAdmin: user?.role === "admin",
  };
}

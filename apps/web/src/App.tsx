import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";

import { apiFetch } from "./lib/api";
import type { SessionPayload } from "./lib/types";
import { CampaignPage } from "./pages/CampaignPage";
import { HomePage } from "./pages/HomePage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";

export function App() {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function refreshSession() {
    try {
      const nextSession = await apiFetch<SessionPayload>("/auth/me");
      setSession(nextSession);
    } catch {
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function logout() {
    await apiFetch("/auth/logout", { method: "POST" });
    setSession(null);
  }

  useEffect(() => {
    refreshSession();
  }, []);

  if (isLoading) {
    return <div className="app-shell loading-screen">Chargement...</div>;
  }

  return (
    <Routes>
      <Route
        path="/"
        element={<HomePage session={session} onSessionRefresh={refreshSession} onLogout={logout} />}
      />
      <Route
        path="/campaigns/:campaignId"
        element={<CampaignPage session={session} onLogout={logout} />}
      />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
    </Routes>
  );
}

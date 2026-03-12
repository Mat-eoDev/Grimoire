import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { apiFetch } from "./lib/api";
import type { SessionPayload } from "./lib/types";
import { CampaignPage } from "./pages/CampaignPage";
import { HomePage } from "./pages/HomePage";
import { InvitePage } from "./pages/InvitePage";

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
    await apiFetch("/auth/logout", {
      method: "POST"
    });
    setSession(null);
  }

  useEffect(() => {
    refreshSession();
  }, []);

  if (isLoading) {
    return <div className="app-shell loading-screen">Chargement de la table du MJ...</div>;
  }

  return (
    <Routes>
      <Route
        path="/"
        element={<HomePage session={session} onSessionRefresh={refreshSession} onLogout={logout} />}
      />
      <Route
        path="/invite/:token"
        element={<InvitePage session={session} onSessionRefresh={refreshSession} />}
      />
      <Route
        path="/campaigns/:campaignId/mj"
        element={
          session ? (
            <CampaignPage session={session} expectedRole="GM" onLogout={logout} />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route
        path="/campaigns/:campaignId/player"
        element={
          session ? (
            <CampaignPage session={session} expectedRole="PLAYER" onLogout={logout} />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
    </Routes>
  );
}


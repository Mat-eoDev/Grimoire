import { useEffect, useRef, useState } from "react";

import { apiFetch } from "../lib/api";

type Props = {
  campaignId: string;
};

export function PlayerNotes({ campaignId }: Props) {
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Chargement initial
  useEffect(() => {
    apiFetch<{ content: string }>(`/campaigns/${campaignId}/notes`)
      .then((data) => setContent(data.content))
      .catch(() => setStatus("error"));
  }, [campaignId]);

  // Sauvegarde automatique 1s après la dernière frappe
  function handleChange(value: string) {
    setContent(value);
    setStatus("idle");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setStatus("saving");
      try {
        await apiFetch(`/campaigns/${campaignId}/notes`, {
          method: "PUT",
          body: JSON.stringify({ content: value })
        });
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    }, 1000);
  }

  return (
    <section className="notes-section">
      <div className="notes-header">
        <h2 className="notes-title">📝 Notes privées</h2>
        <span className={`notes-status notes-status--${status}`}>
          {status === "saving" && "Sauvegarde..."}
          {status === "saved" && "Sauvegardé ✓"}
          {status === "error" && "Erreur de sauvegarde"}
        </span>
      </div>
      <p className="notes-hint">Visibles uniquement par toi.</p>
      <textarea
        className="notes-textarea"
        value={content}
        placeholder="Écris tes notes ici..."
        onChange={(e) => handleChange(e.target.value)}
        rows={10}
      />
    </section>
  );
}

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { apiFetch } from "../lib/api";
import type { CampaignDetail, SessionPayload } from "../lib/types";

type Props = {
  session: SessionPayload | null;
  onLogout: () => Promise<void>;
};

type MobilePanel = "controls" | "player";
type MicroPermissionState = "prompt" | "granted" | "denied" | "unknown";

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<{
    0: {
      transcript: string;
    };
  }>;
};

declare global {
  interface Window {
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    SpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "En attente",
  ACTIVE: "En cours",
  CLOSED: "Terminee"
};

const APPROVAL_LABEL: Record<string, string> = {
  PENDING: "En attente",
  APPROVED: "Valide",
  REJECTED: "Refuse"
};

export function CampaignPage({ session, onLogout }: Props) {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [data, setData] = useState<CampaignDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [saveContextLoading, setSaveContextLoading] = useState(false);
  const [reviewLoadingId, setReviewLoadingId] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("controls");

  const [selectedImageId, setSelectedImageId] = useState<string>("");
  const [selectedTextId, setSelectedTextId] = useState<string>("");

  const [newImageName, setNewImageName] = useState("");
  const [newImageDataUrl, setNewImageDataUrl] = useState("");
  const [newTextTitle, setNewTextTitle] = useState("");
  const [newTextContent, setNewTextContent] = useState("");
  const [dictationSupported, setDictationSupported] = useState(false);
  const [dictationActive, setDictationActive] = useState(false);
  const [microPermission, setMicroPermission] = useState<MicroPermissionState>("unknown");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const load = useCallback(async () => {
    if (!campaignId) {
      return;
    }

    try {
      const result = await apiFetch<CampaignDetail>(`/campaigns/${campaignId}`);
      setData(result);
      setSelectedImageId(result.campaign.currentImageContext?.id ?? "");
      setSelectedTextId(result.campaign.currentTextContext?.id ?? "");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!data || data.campaign.status === "CLOSED") {
      return;
    }

    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
  }, [data, load]);

  useEffect(() => {
    setDictationSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
  }, []);

  useEffect(() => {
    async function readPermission() {
      if (!("permissions" in navigator) || !navigator.permissions?.query) {
        setMicroPermission("unknown");
        return;
      }

      try {
        const result = await navigator.permissions.query({ name: "microphone" as PermissionName });
        setMicroPermission(result.state as MicroPermissionState);
        result.onchange = () => {
          setMicroPermission(result.state as MicroPermissionState);
        };
      } catch {
        setMicroPermission("unknown");
      }
    }

    readPermission();
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  const isGm = data?.viewer.role === "GM";
  const isSecureDictationContext = window.isSecureContext || ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const canUseDictation = dictationSupported && isSecureDictationContext;

  const previewImage = useMemo(() => {
    return data?.libraries.imageContexts.find((item) => item.id === selectedImageId) ?? data?.campaign.currentImageContext ?? null;
  }, [data, selectedImageId]);

  const previewText = useMemo(() => {
    return data?.libraries.textContexts.find((item) => item.id === selectedTextId) ?? data?.campaign.currentTextContext ?? null;
  }, [data, selectedTextId]);

  async function handleLaunch() {
    if (!campaignId) {
      return;
    }

    setActionLoading(true);
    try {
      await apiFetch(`/campaigns/${campaignId}/launch`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStop() {
    if (!campaignId) {
      return;
    }

    setActionLoading(true);
    try {
      await apiFetch(`/campaigns/${campaignId}/stop`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleContextApply(event: FormEvent) {
    event.preventDefault();

    if (!campaignId || !data) {
      return;
    }

    const currentImageId = data.campaign.currentImageContext?.id ?? null;

    setSaveContextLoading(true);
    try {
      const result = await apiFetch<CampaignDetail>(`/campaigns/${campaignId}/context`, {
        method: "POST",
        json: {
          imageContextId: selectedImageId || currentImageId,
          textContextId: selectedTextId || null
        }
      });
      setData(result);
      setError(null);
      setMobilePanel("player");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaveContextLoading(false);
    }
  }

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setMediaLoading(true);
    try {
      const imageDataUrl = await readFileAsDataUrl(file);
      setNewImageDataUrl(imageDataUrl);
      if (!newImageName) {
        setNewImageName(file.name.replace(/\.[^.]+$/, ""));
      }
    } catch {
      setError("Impossible de lire l'image selectionnee");
    } finally {
      setMediaLoading(false);
      event.target.value = "";
    }
  }

  async function handleCreateImageContext(event: FormEvent) {
    event.preventDefault();

    if (!newImageDataUrl) {
      setError("Ajoute d'abord une image depuis l'interface");
      return;
    }

    setSaveContextLoading(true);
    try {
      const result = await apiFetch<{ imageContext: CampaignDetail["libraries"]["imageContexts"][number] }>("/context-images", {
        method: "POST",
        json: {
          name: newImageName,
          imageDataUrl: newImageDataUrl
        }
      });

      setData((current) =>
        current
          ? {
              ...current,
              libraries: {
                ...current.libraries,
                imageContexts: [result.imageContext, ...current.libraries.imageContexts]
              }
            }
          : current
      );
      setSelectedImageId(result.imageContext.id);
      setNewImageName("");
      setNewImageDataUrl("");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaveContextLoading(false);
    }
  }

  async function handleCreateTextContext(event: FormEvent) {
    event.preventDefault();

    setSaveContextLoading(true);
    try {
      const result = await apiFetch<{ textContext: CampaignDetail["libraries"]["textContexts"][number] }>("/context-texts", {
        method: "POST",
        json: {
          title: newTextTitle,
          content: newTextContent
        }
      });

      setData((current) =>
        current
          ? {
              ...current,
              libraries: {
                ...current.libraries,
                textContexts: [result.textContext, ...current.libraries.textContexts]
              },
              moderationQueue:
                session?.user.isAdmin || result.textContext.approvalStatus !== "PENDING"
                  ? current.moderationQueue
                  : [...current.moderationQueue, result.textContext]
            }
          : current
      );
      setSelectedTextId(result.textContext.id);
      setNewTextTitle("");
      setNewTextContent("");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaveContextLoading(false);
    }
  }

  function toggleDictation() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!Recognition) {
      setError("La reconnaissance vocale n'est pas prise en charge par ce navigateur. Essaie Chrome ou Edge.");
      return;
    }

    if (!isSecureDictationContext) {
      setError("Le dictaphone du navigateur demande un contexte securise. Ouvre l'application en localhost ou en HTTPS.");
      return;
    }

    if (dictationActive) {
      recognitionRef.current?.stop();
      setDictationActive(false);
      return;
    }

    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = "fr-FR";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(" ")
        .trim();

      setNewTextContent((current) => `${current} ${transcript}`.trim());
    };
    recognition.onerror = () => {
      setDictationActive(false);
      recognitionRef.current = null;
      setError("Le dictaphone a rencontre un probleme. Verifie l'autorisation micro du navigateur.");
    };
    recognition.onend = () => {
      setDictationActive(false);
      recognitionRef.current = null;
    };
    try {
      setError(null);
      recognition.start();
      setDictationActive(true);
    } catch {
      recognitionRef.current = null;
      setDictationActive(false);
      setError("Impossible de demarrer le dictaphone. Verifie l'autorisation micro du navigateur.");
    }
  }

  async function handleReview(textContextId: string, action: "approve" | "reject") {
    setReviewLoadingId(textContextId);
    try {
      await apiFetch(`/context-texts/${textContextId}/${action}`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setReviewLoadingId(null);
    }
  }

  if (loading) {
    return <div className="app-shell">Chargement...</div>;
  }

  if (error && !data) {
    return (
      <div className="app-shell">
        <p className="feedback feedback--error">{error}</p>
        <Link to="/">Retour</Link>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="app-shell stack-layout">
      <header className="campaign-header">
        <div>
          <p className="eyebrow">Campagne</p>
          <Link to="/">Retour a l'accueil</Link>
          <h1>{data.campaign.title}</h1>
          <p>
            MJ: {data.campaign.gmUser.username} - Statut: {STATUS_LABEL[data.campaign.status] ?? data.campaign.status}
          </p>
        </div>
        {session ? (
          <button type="button" onClick={onLogout}>
            Deconnexion ({session.user.username})
          </button>
        ) : (
          <Link to="/">Connexion</Link>
        )}
      </header>

      {error && <p className="feedback feedback--error">{error}</p>}

      <section className="campaign-grid">
        <article className="mini-panel">
          <strong>Code joueur</strong>
          <span className="join-code">{data.campaign.joinCode}</span>
          <span>Ce code permet aux joueurs de rejoindre la partie.</span>
        </article>
        <article className="mini-panel">
          <strong>Contexte actif</strong>
          <span>{data.campaign.currentImageContext?.name ?? "Aucune image active"}</span>
          <span>{data.campaign.currentTextContext?.title ?? "Aucun texte actif"}</span>
        </article>
        <article className="mini-panel">
          <strong>Textes envoyes</strong>
          <span>{data.publishedTexts.length}</span>
          <span>Ils restent visibles cote joueurs dans des cadres lisibles.</span>
        </article>
      </section>

      {isGm ? (
        <>
          <div className="mobile-tabbar">
            <button
              type="button"
              className={mobilePanel === "controls" ? "" : "button-ghost"}
              onClick={() => setMobilePanel("controls")}
            >
              Regie MJ
            </button>
            <button
              type="button"
              className={mobilePanel === "player" ? "" : "button-ghost"}
              onClick={() => setMobilePanel("player")}
            >
              Vue joueur
            </button>
          </div>

          <section className="gm-layout">
            <div className={`gm-layout__panel ${mobilePanel !== "controls" ? "gm-layout__panel--hidden-mobile" : ""}`}>
              <div className="stack-layout">
                <section className="section-card">
                  <div className="section-card__header">
                    <div>
                      <h2>Pilotage de partie</h2>
                      <p>Lance la campagne puis mets a jour le contexte visible par les joueurs.</p>
                    </div>
                  </div>
                  <div className="section-card__body stack-layout">
                    <div className="toolbar">
                      {data.campaign.status === "DRAFT" && (
                        <button type="button" onClick={handleLaunch} disabled={actionLoading}>
                          {actionLoading ? "..." : "Lancer la campagne"}
                        </button>
                      )}
                      {data.campaign.status === "ACTIVE" && (
                        <button type="button" onClick={handleStop} disabled={actionLoading}>
                          {actionLoading ? "..." : "Stopper la campagne"}
                        </button>
                      )}
                      {data.campaign.status === "CLOSED" && <span className="pill">Campagne terminee</span>}
                    </div>
                  </div>
                </section>

                <section className="section-card">
                  <div className="section-card__header">
                    <div>
                      <h2>Bibliotheque d'images contextes</h2>
                      <p>Choisis une image en base ou ajoute la tienne depuis l'interface.</p>
                    </div>
                  </div>
                  <div className="section-card__body stack-layout">
                    <form className="stack-form" onSubmit={handleCreateImageContext}>
                      <label>
                        Nom de l'image context
                        <input value={newImageName} onChange={(event) => setNewImageName(event.target.value)} required />
                      </label>
                      <label>
                        Charger une image
                        <input type="file" accept="image/*" onChange={handleImageUpload} />
                      </label>
                      {newImageDataUrl && <img className="context-upload-preview" src={newImageDataUrl} alt={newImageName || "Apercu"} />}
                      <button type="submit" disabled={saveContextLoading || mediaLoading}>
                        {mediaLoading ? "Chargement..." : "Ajouter a ma bibliotheque"}
                      </button>
                    </form>

                    <div className="context-grid">
                      {data.libraries.imageContexts.map((item) => (
                        <label key={item.id} className={`context-card ${selectedImageId === item.id ? "context-card--selected" : ""}`}>
                          <input
                            type="radio"
                            name="image-context"
                            checked={selectedImageId === item.id}
                            onChange={() => setSelectedImageId(item.id)}
                          />
                          <img src={item.imageDataUrl} alt={item.name} />
                          <strong>{item.name}</strong>
                          <span>{item.isBuiltin ? "Base partagee" : "Ma bibliotheque"}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="section-card">
                  <div className="section-card__header">
                    <div>
                      <h2>Bibliotheque de textes contextes</h2>
                      <p>Le texte est reutilisable dans tes parties. Les autres MJ le verront apres validation admin.</p>
                    </div>
                  </div>
                  <div className="section-card__body stack-layout">
                    <form className="stack-form" onSubmit={handleCreateTextContext}>
                      <label>
                        Titre du contexte
                        <input value={newTextTitle} onChange={(event) => setNewTextTitle(event.target.value)} required />
                      </label>
                      <label>
                        Texte de contexte
                        <textarea
                          rows={6}
                          value={newTextContent}
                          onChange={(event) => setNewTextContent(event.target.value)}
                          required
                        />
                      </label>
                      <div className="toolbar">
                        <button
                          type="button"
                          className="button-ghost"
                          onClick={toggleDictation}
                          disabled={!canUseDictation}
                        >
                          {dictationActive ? "Dictaphone en cours" : "Dicter le texte"}
                        </button>
                        <button type="submit" disabled={saveContextLoading}>
                          Enregistrer le texte
                        </button>
                      </div>
                      <div className="dictation-status">
                        <strong>Etat du micro</strong>
                        <span>{dictationSupported ? "Reconnaissance vocale detectee" : "Reconnaissance vocale non prise en charge"}</span>
                        <span>{isSecureDictationContext ? "Contexte securise valide" : `Contexte non securise (${window.location.origin})`}</span>
                        <span>
                          Permission micro:{" "}
                          {microPermission === "granted"
                            ? "autorisee"
                            : microPermission === "denied"
                              ? "refusee"
                              : microPermission === "prompt"
                                ? "a confirmer"
                                : "inconnue"}
                        </span>
                      </div>
                      <p>
                        Le texte peut etre publie tout de suite dans cette partie. La validation admin sert seulement a le rendre reutilisable par d'autres MJ.
                      </p>
                    </form>

                    <div className="list-stack">
                      {data.libraries.textContexts.map((item) => (
                        <label key={item.id} className={`context-text-card ${selectedTextId === item.id ? "context-text-card--selected" : ""}`}>
                          <div className="toolbar">
                            <div>
                              <strong>{item.title}</strong>
                              <p>{item.owner?.username ? `Propose par ${item.owner.username}` : "Ton texte"}</p>
                            </div>
                            <div className="pill-row">
                              {item.isPublishedInCurrentCampaign && <span className="pill pill--success">Publie dans cette partie</span>}
                              <span className={`pill ${item.approvalStatus === "APPROVED" ? "pill--success" : "pill--warning"}`}>
                                {item.canBeSharedAcrossMj ? "Partage MJ valide" : APPROVAL_LABEL[item.approvalStatus]}
                              </span>
                            </div>
                          </div>
                          <p>{item.content}</p>
                          <input
                            type="radio"
                            name="text-context"
                            checked={selectedTextId === item.id}
                            onChange={() => setSelectedTextId(item.id)}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="section-card">
                  <div className="section-card__header">
                    <div>
                      <h2>Publier pour les joueurs</h2>
                      <p>La colonne de droite correspond a ce que voient les joueurs en direct.</p>
                    </div>
                  </div>
                  <div className="section-card__body">
                    <form className="stack-form" onSubmit={handleContextApply}>
                      <button type="submit" disabled={saveContextLoading}>
                        {saveContextLoading ? "Publication..." : "Publier ce contexte dans la partie"}
                      </button>
                    </form>
                  </div>
                </section>

                {session?.user.isAdmin && data.moderationQueue.length > 0 && (
                  <section className="section-card">
                    <div className="section-card__header">
                      <div>
                        <h2>Validation admin</h2>
                        <p>Les textes en attente deviennent reutilisables dans les parties des autres MJ apres validation.</p>
                      </div>
                    </div>
                    <div className="section-card__body list-stack">
                      {data.moderationQueue.map((item) => (
                        <article key={item.id} className="context-text-card">
                          <div className="toolbar">
                            <div>
                              <strong>{item.title}</strong>
                              <p>Propose par {item.owner?.username ?? "Auteur inconnu"}</p>
                            </div>
                            <span className="pill pill--warning">En attente</span>
                          </div>
                          <p>{item.content}</p>
                          <div className="toolbar">
                            <button
                              type="button"
                              onClick={() => handleReview(item.id, "approve")}
                              disabled={reviewLoadingId === item.id}
                            >
                              Valider
                            </button>
                            <button
                              type="button"
                              className="button-ghost"
                              onClick={() => handleReview(item.id, "reject")}
                              disabled={reviewLoadingId === item.id}
                            >
                              Refuser
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </div>

            <aside className={`gm-layout__panel ${mobilePanel !== "player" ? "gm-layout__panel--hidden-mobile" : ""}`}>
              <PlayerPreview
                title={data.campaign.title}
                imageName={previewImage?.name ?? data.campaign.currentImageContext?.name ?? "Aucune image"}
                imageDataUrl={previewImage?.imageDataUrl ?? data.campaign.currentImageContext?.imageDataUrl ?? ""}
                textTitle={previewText?.title ?? data.campaign.currentTextContext?.title ?? "Aucun texte"}
                textContent={previewText?.content ?? data.campaign.currentTextContext?.content ?? "Le MJ n'a pas encore publie de contexte."}
                publishedTexts={data.publishedTexts}
                status={STATUS_LABEL[data.campaign.status] ?? data.campaign.status}
              />
            </aside>
          </section>
        </>
      ) : (
        <PlayerPreview
          title={data.campaign.title}
          imageName={data.campaign.currentImageContext?.name ?? "Aucune image"}
          imageDataUrl={data.campaign.currentImageContext?.imageDataUrl ?? ""}
          textTitle={data.campaign.currentTextContext?.title ?? "En attente"}
          textContent={data.campaign.currentTextContext?.content ?? "Le MJ n'a pas encore publie de contexte."}
          publishedTexts={data.publishedTexts}
          status={STATUS_LABEL[data.campaign.status] ?? data.campaign.status}
        />
      )}

      <section className="section-card">
        <div className="section-card__header">
          <div>
            <h2>Participants ({data.members.length})</h2>
            <p>Les joueurs connectes a cette campagne.</p>
          </div>
        </div>
        <div className="section-card__body list-stack">
          {data.members.map((member) => (
            <article key={member.id} className="list-row">
              <strong>{member.user.username}</strong>
              <span>{member.role === "GM" ? "MJ" : "Joueur"}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function PlayerPreview(props: {
  title: string;
  imageName: string;
  imageDataUrl: string;
  textTitle: string;
  textContent: string;
  publishedTexts: CampaignDetail["publishedTexts"];
  status: string;
}) {
  return (
    <section className="section-card section-card--sticky">
      <div className="section-card__header">
        <div>
          <p className="eyebrow">Vue joueur</p>
          <h2>{props.title}</h2>
          <p>{props.status}</p>
        </div>
      </div>
      <div className="section-card__body stack-layout">
        <div
          className="scene-stage"
          style={props.imageDataUrl ? { backgroundImage: `linear-gradient(rgba(28, 21, 16, 0.22), rgba(28, 21, 16, 0.72)), url(${props.imageDataUrl})` } : undefined}
        >
          <div className="scene-stage__content">
            <p className="eyebrow">Image context</p>
            <h2>{props.imageName}</h2>
          </div>
        </div>

        <article className="context-preview-copy">
          <p className="eyebrow">Texte context</p>
          <h3>{props.textTitle}</h3>
          <p>{props.textContent}</p>
        </article>

        <div className="player-text-feed">
          <p className="eyebrow">Textes envoyes aux joueurs</p>
          {props.publishedTexts.length > 0 ? (
            props.publishedTexts.map((item) => (
              <article key={item.publishedEntryId} className="player-text-card">
                <h3>{item.title}</h3>
                <p>{item.content}</p>
              </article>
            ))
          ) : (
            <article className="player-text-card">
              <h3>Aucun texte publie</h3>
              <p>Les prochains textes envoyes par le MJ apparaitront ici dans un cadre a contraste renforce.</p>
            </article>
          )}
        </div>
      </div>
    </section>
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Lecture impossible"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Lecture impossible"));
    reader.readAsDataURL(file);
  });
}

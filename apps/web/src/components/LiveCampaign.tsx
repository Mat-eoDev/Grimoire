import { Link } from "react-router-dom";
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import "@3d-dice/dice-box/dist/style.css";

import { apiFetch, API_URL } from "../lib/api";
import type { ActionRoll, CampaignDetail } from "../lib/types";
import { Inventory } from "./Inventory";
import { TradePanel } from "./TradePanel";
import { CharacterSheet } from "./CharacterSheet";
import { PlayerDetailModal } from "./PlayerDetailModal";

type Props = {
  data: CampaignDetail;
  onReload: () => Promise<void>;
  onStop: () => Promise<void>;
  refreshKey: number;
};

const BACKGROUND_FILES = [
  "IMG_3184.png",
  "IMG_3184_colorize (1).png",
  "IMG_3184_colorize.png",
  "IMG_3185.png",
  "IMG_3185_colorize (1).png",
  "IMG_3185_colorize (2).png",
  "IMG_3185_colorize.png",
  "IMG_3186.png",
  "IMG_3186_colorize (2).png",
  "IMG_3186_colorize.png",
  "IMG_3187.png",
  "IMG_3187_colorize (1).png",
  "IMG_3187_colorize (2).png",
  "IMG_3187_colorize.png",
  "IMG_3196.png",
  "IMG_3196_colorize (1).png",
  "IMG_3196_colorize (2).png",
  "IMG_3196_colorize.png",
  "IMG_3197.png",
  "IMG_3197_colorize (1).png",
  "IMG_3197_colorize (2).png",
  "IMG_3197_colorize (3).png",
  "IMG_3197_colorize.png",
  "IMG_3198.png",
  "IMG_3198_colorize (1).png",
  "IMG_3198_colorize.png",
  "IMG_3199.png",
  "IMG_3199_colorize (1).png",
  "IMG_3199_colorize (2).png",
  "IMG_3199_colorize (3).png",
  "IMG_3199_colorize.png",
  "IMG_3200.png",
  "IMG_3200_colorize (1).png",
  "IMG_3200_colorize.png"
];

const BACKGROUND_CONTEXTS = BACKGROUND_FILES.map((file) => {
  const id = file.replace(/\.[^.]+$/, "");
  const label = id.replace(/_/g, " ").replace(/\s+/g, " ");
  return {
    id,
    label,
    title: `Contexte ${label}`,
    image: `/lib_picture/background/${file}`
  };
});

function resolveSceneContext(preset: string) {
  return BACKGROUND_CONTEXTS.find((context) => context.id === preset) ?? BACKGROUND_CONTEXTS[0];
}

function sceneBackgroundStyle(preset: string): CSSProperties {
  const context = resolveSceneContext(preset);
  return {
    "--scene-bg": `url("${context.image}")`
  } as CSSProperties;
}

const ELEMENT_LABELS = {
  ENEMY: "Ennemi",
  NPC: "PNJ",
  OBJECT: "Objet visuel",
  NARRATION: "Narration",
  PLAYER: "Joueur"
} as const;

const ELEMENT_DEFAULTS = {
  ENEMY: { name: "Garde spectral", description: "Une silhouette armee barre le passage." },
  NPC: { name: "Voyageur inconnu", description: "Une presence semble vouloir vous parler." },
  OBJECT: { name: "Coffre scelle", description: "Un objet attire votre attention." },
  NARRATION: { name: "Brouillard ancien", description: "L'atmosphere de la scene change." },
  PLAYER: { name: "", description: "" }
} as const;

const ELEMENT_ICONS = {
  ENEMY: "!",
  NPC: "?",
  OBJECT: "*",
  NARRATION: "...",
  PLAYER: "⚔"
} as const;

const CHAR_CLASS: Record<number, string> = {
  1: "ASSASSIN",
  2: "CHEVALIER",
  3: "ELFE",
  4: "MAG"
};

const NARRATION_SUGGESTIONS = [
  "",
  "Un grondement sourd traverse les pierres anciennes.",
  "Un silence pesant s'installe soudainement.",
  "Une brume froide envahit lentement les lieux.",
  "Quelque chose vient de bouger dans l'ombre."
];

const CHAR_LABELS: Record<number, string> = {
  1: "Assassin",
  2: "Chevalier",
  3: "Elfe",
  4: "Mage"
};

const OUTCOME_LABELS: Record<NonNullable<ActionRoll["outcome"]>, string> = {
  TOTAL_FAILURE: "Echec total",
  FAILURE: "Echec",
  SUCCESS: "Reussite",
  TOTAL_SUCCESS: "Reussite totale"
};

const CONSEQUENCE_LABELS: Record<ActionRoll["consequenceType"], string> = {
  NONE: "Aucun effet automatique",
  NARRATION: "Ajouter une narration",
  DAMAGE_TARGET: "Retirer des PV a la cible",
  DAMAGE_PLAYER: "Retirer des PV au joueur",
  DELETE_TARGET: "Supprimer la cible"
};

const OUTCOME_ORDER: Array<NonNullable<ActionRoll["outcome"]>> = ["TOTAL_FAILURE", "FAILURE", "SUCCESS", "TOTAL_SUCCESS"];

type ActionRollConsequence = ActionRoll["consequences"][NonNullable<ActionRoll["outcome"]>];

function defaultConsequences(): ActionRoll["consequences"] {
  return {
    TOTAL_FAILURE: { type: "NONE", amount: 0, text: "" },
    FAILURE: { type: "NONE", amount: 0, text: "" },
    SUCCESS: { type: "NONE", amount: 0, text: "" },
    TOTAL_SUCCESS: { type: "NONE", amount: 0, text: "" }
  };
}

type ElementPos = { posX: number; posY: number };

function elementHpLabel(element: Pick<CampaignDetail["live"]["elements"][number], "hp" | "maxHp" | "type">) {
  if (element.type === "NARRATION") return "";
  if (element.maxHp <= 0) return "";
  return `PV ${element.hp} / ${element.maxHp}`;
}

export function LiveCampaign({ data, onReload, onStop, refreshKey }: Props) {
  const isGm = data.viewer.role === "GM";
  const [selectedPlayer, setSelectedPlayer] = useState<CampaignDetail["live"]["players"][number] | null>(null);
  const [title, setTitle] = useState(data.live.scene.title);
  const [text, setText] = useState(data.live.scene.text);
  const [preset, setPreset] = useState(() => resolveSceneContext(data.live.scene.preset).id);
  const [loading, setLoading] = useState(false);
  const [draftType, setDraftType] = useState<keyof typeof ELEMENT_LABELS | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftQuantity, setDraftQuantity] = useState(1);
  const [draftAssetId, setDraftAssetId] = useState("");
  const [libraryTab, setLibraryTab] = useState<"JOUEURS" | keyof typeof ELEMENT_LABELS>("ENEMY");
  const [gmTab, setGmTab] = useState<"scene" | "elements" | "rolls" | "group">("scene");
  const [search, setSearch] = useState("");
  const [actionRolls, setActionRolls] = useState<ActionRoll[]>(data.live.actionRolls ?? []);

  const [positions, setPositions] = useState<Map<string, ElementPos>>(() =>
    new Map(data.live.elements.map((el) => [el.id, { posX: el.posX, posY: el.posY }]))
  );

  // Sync new elements from polling without overwriting live-dragged positions
  useEffect(() => {
    setPositions((prev) => {
      const next = new Map(prev);
      for (const el of data.live.elements) {
        if (!next.has(el.id)) next.set(el.id, { posX: el.posX, posY: el.posY });
      }
      // Remove positions for deleted elements
      for (const id of next.keys()) {
        if (!data.live.elements.some((el) => el.id === id)) next.delete(id);
      }
      return next;
    });
  }, [data.live.elements]);

  useEffect(() => {
    setActionRolls(data.live.actionRolls ?? []);
  }, [data.live.actionRolls]);

  // SSE: real-time position updates
  useEffect(() => {
    const es = new EventSource(`${API_URL}/campaigns/${data.campaign.id}/stream`, { withCredentials: true });
    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data as string) as {
          type: string;
          elementId?: string;
          posX?: number;
          posY?: number;
          actionRoll?: ActionRoll;
          actionRollId?: string;
        };
        if (event.type === "element:moved") {
          if (event.elementId && typeof event.posX === "number" && typeof event.posY === "number") {
            setPositions((prev) => new Map(prev).set(event.elementId!, { posX: event.posX!, posY: event.posY! }));
          }
        }
        if (event.type === "action-roll:changed" && event.actionRoll) {
          setActionRolls((prev) => [event.actionRoll!, ...prev.filter((roll) => roll.id !== event.actionRoll!.id)]);
        }
        if (event.type === "action-roll:closed" && event.actionRollId) {
          setActionRolls((prev) => prev.filter((roll) => roll.id !== event.actionRollId));
          void onReload();
        }
        if (event.type === "campaign:changed") {
          void onReload();
        }
      } catch {}
    };
    return () => es.close();
  }, [data.campaign.id, onReload]);

  const handlePositionDrop = useCallback(async (elementId: string, posX: number, posY: number) => {
    try {
      await apiFetch(`/campaigns/${data.campaign.id}/scene-elements/${elementId}/position`, {
        method: "PATCH",
        json: { posX, posY }
      });
    } catch {}
  }, [data.campaign.id]);

  const visibleElements = data.live.elements.filter((element) => element.isVisible);

  async function publishScene() {
    setLoading(true);
    try {
      await apiFetch(`/campaigns/${data.campaign.id}/live-scene`, {
        method: "PUT",
        json: { preset, title, text }
      });
      await onReload();
    } finally {
      setLoading(false);
    }
  }

  function prepareElement(type: keyof typeof ELEMENT_LABELS) {
    const defaults = ELEMENT_DEFAULTS[type];
    setDraftType(type);
    setDraftName(defaults.name);
    setDraftDescription(defaults.description);
    setDraftQuantity(1);
    setDraftAssetId("");
  }

  function selectAsset(type: keyof typeof ELEMENT_LABELS, assetId: string, assetName: string) {
    const defaults = ELEMENT_DEFAULTS[type];
    setDraftType(type);
    setDraftName(assetName || defaults.name);
    setDraftDescription(defaults.description);
    setDraftQuantity(1);
    setDraftAssetId(assetId);
  }

  async function revealElement() {
    if (!draftType || !draftName.trim()) return;
    await apiFetch(`/campaigns/${data.campaign.id}/scene-elements`, {
      method: "POST",
      json: {
        type: draftType,
        name: draftName.trim(),
        description: draftDescription.trim(),
        quantity: draftType === "ENEMY" ? draftQuantity : 1,
        assetId: draftAssetId || undefined
      }
    });
    setDraftType(null);
    await onReload();
  }

  async function setElementVisibility(id: string, isVisible: boolean) {
    await apiFetch(`/campaigns/${data.campaign.id}/scene-elements/${id}`, {
      method: "PATCH",
      json: { isVisible }
    });
    await onReload();
  }

  async function removeElement(id: string) {
    await apiFetch(`/campaigns/${data.campaign.id}/scene-elements/${id}`, {
      method: "DELETE"
    });
    await onReload();
  }

  async function addPlayerToScene(player: CampaignDetail["live"]["players"][number]) {
    const className = CHAR_CLASS[player.charId];
    const asset = data.live.assets.find((a) => a.type === "PLAYER" && a.name.toUpperCase() === className);
    await apiFetch(`/campaigns/${data.campaign.id}/scene-elements`, {
      method: "POST",
      json: {
        type: "PLAYER",
        name: player.charName,
        description: `${CHAR_LABELS[player.charId] ?? player.username}`,
        quantity: 1,
        assetId: asset?.id
      }
    });
    await onReload();
  }

  if (!isGm) {
    return (
      <PlayerView
        data={data}
        visibleElements={visibleElements}
        positions={positions}
        actionRolls={actionRolls}
        sceneStyle={sceneBackgroundStyle(data.live.scene.preset)}
        refreshKey={refreshKey}
      />
    );
  }

  const visibleCount = data.live.elements.filter((element) => element.isVisible).length;
  const hiddenCount = data.live.elements.length - visibleCount;
  const enemyCount = visibleElements.filter((element) => element.type === "ENEMY").length;
  const activeRollCount = actionRolls.filter((r) => r.status === "PENDING" || r.status === "ROLLED").length;

  const GM_TABS: Array<{ id: typeof gmTab; label: string; badge?: number }> = [
    { id: "scene", label: "Scène" },
    { id: "elements", label: "Éléments", badge: visibleCount || undefined },
    { id: "rolls", label: "Jets", badge: activeRollCount || undefined },
    { id: "group", label: "Groupe", badge: data.live.players.length || undefined }
  ];

  return (
    <main className="live-gm gm">
      <header className="live-topbar">
        <strong>GRIMOIRE</strong>
        <span>{data.campaign.title}</span>
        <span className="live-badge live-badge--danger">En direct</span>
        <Link to="/" className="live-link">Accueil</Link>
      </header>

      <div className="gm__body">
        {/* Aperçu — ce que voient les joueurs */}
        <section className="gm__stage">
          <div className="gm__preview-head">
            <div>
              <p className="live-kicker">Régie</p>
              <h1>Ce que voient les joueurs</h1>
            </div>
            <button type="button" onClick={publishScene} disabled={loading}>
              {loading ? "Diffusion…" : "Diffuser la scène"}
            </button>
          </div>
          <div className="live-preview live-scene" style={sceneBackgroundStyle(preset)}>
            <p className="live-kicker">{title}</p>
            <h2>{text}</h2>
            <SceneCanvas
              elements={visibleElements}
              positions={positions}
              onPositionChange={(id, pos) => setPositions((prev) => new Map(prev).set(id, pos))}
              onPositionDrop={handlePositionDrop}
              isGm
            />
            {enemyCount > 0 && (
              <div className="live-preview__threat">
                <span>Ennemis visibles</span>
                <strong>{enemyCount} sur la scène</strong>
              </div>
            )}
          </div>
        </section>

        {/* Outils MJ — onglets */}
        <div className="gm__side">
          <nav className="gm__nav">
            {GM_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`gm__tab${gmTab === t.id ? " gm__tab--active" : ""}`}
                onClick={() => setGmTab(t.id)}
              >
                {t.label}{t.badge ? ` · ${t.badge}` : ""}
              </button>
            ))}
          </nav>

          {/* Onglet Scène : décor + narration */}
          {gmTab === "scene" && (
            <div className="gm__panel">
              <div>
                <h2 className="gm__panel-title">Décor & narration</h2>
                <p className="gm__panel-lead">Choisis un lieu, écris l'ambiance, puis diffuse.</p>
              </div>
              <div className="live-scene-form">
                <label>
                  Titre de la scène
                  <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex : La taverne du Sanglier" />
                </label>
                <label>
                  Narration visible
                  <textarea value={text} onChange={(event) => setText(event.target.value)} rows={3} placeholder="Ce que lisent les joueurs…" />
                </label>
              </div>
              <div className="media-section-heading">
                <h2>Décors</h2>
                <input value={search} placeholder="Rechercher un décor…" onChange={(event) => setSearch(event.target.value)} />
              </div>
              <div className="media-grid">
                {BACKGROUND_CONTEXTS
                  .filter((item) => item.label.toLowerCase().includes(search.toLowerCase()))
                  .map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`media-card media-card--context${preset === item.id ? " media-card--selected" : ""}`}
                      onClick={() => { setPreset(item.id); if (!title.trim()) setTitle(item.title); }}
                    >
                      <img src={item.image} alt="" />
                      <span>{item.label}</span>
                    </button>
                  ))}
              </div>
              <button type="button" onClick={publishScene} disabled={loading}>
                {loading ? "Diffusion…" : "Diffuser la scène"}
              </button>
            </div>
          )}

          {/* Onglet Éléments : ajouter + gérer */}
          {gmTab === "elements" && (
            <div className="gm__panel">
              <div>
                <h2 className="gm__panel-title">Éléments de la scène</h2>
                <p className="gm__panel-lead">Fais apparaître ennemis, PNJ, objets, joueurs — puis affiche ou masque.</p>
              </div>

              <div className="media-tabs">
                {(Object.keys(ELEMENT_LABELS) as Array<keyof typeof ELEMENT_LABELS>)
                  .filter((type) => type !== "PLAYER")
                  .map((type) => (
                    <button key={type} type="button" className={libraryTab === type ? "media-tab--active" : ""} onClick={() => setLibraryTab(type)}>
                      {ELEMENT_LABELS[type]}
                    </button>
                  ))}
                <button type="button" className={libraryTab === "JOUEURS" ? "media-tab--active" : ""} onClick={() => setLibraryTab("JOUEURS")}>Joueurs</button>
              </div>

              <div className="media-grid">
                {libraryTab === "JOUEURS" && (
                  data.live.players.length === 0
                    ? <p className="live-empty" style={{ gridColumn: "1/-1" }}>Aucun joueur avec une fiche personnage.</p>
                    : data.live.players.map((player) => {
                        const className = CHAR_CLASS[player.charId];
                        const asset = data.live.assets.find((a) => a.type === "PLAYER" && a.name.toUpperCase() === className);
                        return (
                          <button
                            key={player.userId}
                            type="button"
                            className="media-card media-card--asset"
                            onClick={() => addPlayerToScene(player)}
                            title={`Ajouter ${player.charName} sur la scène`}
                          >
                            {asset
                              ? <img src={asset.imageDataUrl} alt={player.charName} />
                              : <span style={{ fontSize: "1.6rem" }}>{ELEMENT_ICONS.PLAYER}</span>}
                            <span>{player.charName}</span>
                            <span>{CHAR_LABELS[player.charId] ?? player.username}</span>
                          </button>
                        );
                      })
                )}
                {libraryTab !== "JOUEURS" && data.live.assets
                  .filter((asset) => asset.type === libraryTab)
                  .map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      className={`media-card media-card--asset${draftAssetId === asset.id ? " media-card--selected" : ""}`}
                      onClick={() => selectAsset(asset.type, asset.id, asset.name)}
                    >
                      <img src={asset.imageDataUrl} alt="" />
                      <span>{asset.name}</span>
                    </button>
                  ))}
                {libraryTab !== "JOUEURS" && (
                  <button type="button" className="media-card media-card--fallback" onClick={() => prepareElement(libraryTab)}>
                    <b>{ELEMENT_ICONS[libraryTab]}</b>
                    <span>{libraryTab === "NARRATION" ? "Écrire" : "Sans image"}</span>
                  </button>
                )}
              </div>

              {draftType && (
                <div className="live-reveal-form">
                  <h3>Ajouter : {ELEMENT_LABELS[draftType]}</h3>
                  <label>
                    Nom
                    <input value={draftName} onChange={(event) => setDraftName(event.target.value)} />
                  </label>
                  {draftType === "NARRATION" && (
                    <label>
                      Proposition facultative
                      <select
                        value=""
                        onChange={(event) => event.target.value && setDraftDescription(event.target.value)}
                      >
                        <option value="">Choisir un texte…</option>
                        {NARRATION_SUGGESTIONS.slice(1).map((suggestion) => (
                          <option key={suggestion} value={suggestion}>{suggestion}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label>
                    Texte visible
                    <textarea value={draftDescription} onChange={(event) => setDraftDescription(event.target.value)} rows={3} />
                  </label>
                  {draftType === "ENEMY" && (
                    <label>
                      Quantité
                      <input type="number" min={1} max={20} value={draftQuantity} onChange={(event) => setDraftQuantity(Number(event.target.value))} />
                    </label>
                  )}
                  {draftType !== "NARRATION" && (
                    <label>
                      Image
                      <select value={draftAssetId} onChange={(event) => setDraftAssetId(event.target.value)}>
                        <option value="">Aucune image : pictogramme par défaut</option>
                        {data.live.assets.filter((asset) => asset.type === draftType).map((asset) => (
                          <option key={asset.id} value={asset.id}>{asset.name}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  <div className="live-reveal-form__actions">
                    <button type="button" className="live-text-button" onClick={() => setDraftType(null)}>Annuler</button>
                    <button type="button" onClick={revealElement}>Afficher aux joueurs</button>
                  </div>
                </div>
              )}

              <section className="media-scene">
                <SceneElementGroup
                  title="Sur la scène"
                  elements={data.live.elements.filter((element) => element.isVisible)}
                  onVisibilityChange={setElementVisibility}
                  onRemove={removeElement}
                />
                {hiddenCount > 0 && (
                  <SceneElementGroup
                    title="En coulisse"
                    elements={data.live.elements.filter((element) => !element.isVisible)}
                    onVisibilityChange={setElementVisibility}
                    onRemove={removeElement}
                  />
                )}
              </section>
            </div>
          )}

          {/* Onglet Jets */}
          {gmTab === "rolls" && (
            <div className="gm__panel">
              <ActionRollGmPanel
                campaignId={data.campaign.id}
                members={data.members}
                players={data.live.players}
                elements={data.live.elements}
                actionRolls={actionRolls}
                onRollChange={async (roll) => {
                  setActionRolls((prev) => [roll, ...prev.filter((item) => item.id !== roll.id)]);
                  await onReload();
                }}
                onRollClose={async (rollId) => {
                  setActionRolls((prev) => prev.filter((roll) => roll.id !== rollId));
                  await onReload();
                }}
              />
            </div>
          )}

          {/* Onglet Groupe */}
          {gmTab === "group" && (
            <div className="gm__panel">
              <div>
                <h2 className="gm__panel-title">Le groupe</h2>
                <p className="gm__panel-lead">Touche un joueur pour voir ses stats, son sac et lui donner un objet.</p>
              </div>
              <PlayerHealth players={data.live.players} onSelectPlayer={setSelectedPlayer} />
              <button type="button" className="live-stop" onClick={onStop}>Terminer la partie</button>
            </div>
          )}
        </div>
      </div>

      {selectedPlayer && (
        <PlayerDetailModal
          campaignId={data.campaign.id}
          player={selectedPlayer}
          members={data.members}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </main>
  );
}

function ActionRollGmPanel({
  campaignId,
  members,
  players,
  elements,
  actionRolls,
  onRollChange,
  onRollClose
}: {
  campaignId: string;
  members: CampaignDetail["members"];
  players: CampaignDetail["live"]["players"];
  elements: CampaignDetail["live"]["elements"];
  actionRolls: ActionRoll[];
  onRollChange: (roll: ActionRoll) => Promise<void>;
  onRollClose: (rollId: string) => Promise<void>;
}) {
  const activeRoll = actionRolls[0] ?? null;
  const [step, setStep] = useState(1);
  const [playerUserId, setPlayerUserId] = useState(players[0]?.userId ?? "");
  const [actionText, setActionText] = useState("");
  const [dieSides, setDieSides] = useState(20);
  const [totalFailureMax, setTotalFailureMax] = useState(4);
  const [successMin, setSuccessMin] = useState(12);
  const [totalSuccessMin, setTotalSuccessMin] = useState(18);
  const [target, setTarget] = useState("NONE:");
  const [consequences, setConsequences] = useState<ActionRoll["consequences"]>(() => defaultConsequences());
  const [status, setStatus] = useState("");

  const selectableElements = elements.filter((element) => element.type !== "NARRATION");

  useEffect(() => {
    if (!playerUserId && players[0]) {
      setPlayerUserId(players[0].userId);
    }
    if (playerUserId && players.length > 0 && !players.some((player) => player.userId === playerUserId)) {
      setPlayerUserId(players[0].userId);
    }
  }, [playerUserId, players]);

  function resetForm() {
    setStep(1);
    setActionText("");
    setTarget("NONE:");
    setConsequences(defaultConsequences());
  }

  function updateConsequence(outcome: NonNullable<ActionRoll["outcome"]>, patch: Partial<ActionRollConsequence>) {
    setConsequences((prev) => ({
      ...prev,
      [outcome]: { ...prev[outcome], ...patch }
    }));
  }

  async function createRoll() {
    if (!playerUserId || !actionText.trim()) return;
    const [targetType, targetId] = target.split(":");
    setStatus("Creation...");
    try {
      const data = await apiFetch<{ actionRoll: ActionRoll }>(`/campaigns/${campaignId}/action-rolls`, {
        method: "POST",
        json: {
          playerUserId,
          actionText: actionText.trim(),
          dieSides,
          totalFailureMax,
          successMin,
          totalSuccessMin,
          targetType,
          targetElementId: targetType === "ELEMENT" ? targetId : undefined,
          targetUserId: targetType === "PLAYER" ? targetId : undefined,
          consequenceType: consequences.SUCCESS.type,
          consequenceAmount: consequences.SUCCESS.amount,
          consequenceText: consequences.SUCCESS.text,
          consequences
        }
      });
      await onRollChange(data.actionRoll);
      resetForm();
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Impossible de creer le jet");
    }
  }

  async function resolveRoll(roll: ActionRoll) {
    const data = await apiFetch<{ actionRoll: ActionRoll }>(`/campaigns/${campaignId}/action-rolls/${roll.id}/resolve`, {
      method: "POST"
    });
    await onRollClose(data.actionRoll.id);
  }

  async function reroll(roll: ActionRoll) {
    const data = await apiFetch<{ actionRoll: ActionRoll }>(`/campaigns/${campaignId}/action-rolls/${roll.id}/reroll`, {
      method: "POST"
    });
    await onRollChange(data.actionRoll);
  }

  async function cancelRoll(roll: ActionRoll) {
    await apiFetch(`/campaigns/${campaignId}/action-rolls/${roll.id}/cancel`, { method: "POST" });
    await onRollClose(roll.id);
  }

  return (
    <section className="action-roll live-panel">
      <p className="live-kicker">Resolution d'action</p>
      {activeRoll ? (
        <div className="action-roll__active">
          <h3>{activeRoll.actionText}</h3>
          <p>{activeRoll.playerUsername} lance un d{activeRoll.dieSides}{activeRoll.targetName ? ` contre ${activeRoll.targetName}` : ""}.</p>
          <div className="action-roll__thresholds">
            <span>Critique {"<="} {activeRoll.totalFailureMax}</span>
            <span>Reussite {">="} {activeRoll.successMin}</span>
            <span>Totale {">="} {activeRoll.totalSuccessMin}</span>
          </div>
          {activeRoll.status === "PENDING" && <strong className="action-roll__waiting">En attente du joueur...</strong>}
          {activeRoll.status === "ROLLED" && (
            <>
              <div className="action-roll__result">
                <span>Resultat</span>
                <b>{activeRoll.result}</b>
                <strong>{activeRoll.outcome ? OUTCOME_LABELS[activeRoll.outcome] : ""}</strong>
              </div>
              {activeRoll.outcome && (
                <>
                  <p className="action-roll__effect">
                    {CONSEQUENCE_LABELS[activeRoll.consequences[activeRoll.outcome].type]}
                    {activeRoll.consequences[activeRoll.outcome].amount > 0 ? ` (${activeRoll.consequences[activeRoll.outcome].amount})` : ""}
                  </p>
                  {activeRoll.consequences[activeRoll.outcome].text && (
                    <p className="action-roll__effect">{activeRoll.consequences[activeRoll.outcome].text}</p>
                  )}
                </>
              )}
            </>
          )}
          <div className="action-roll__actions">
            <button type="button" className="live-text-button" onClick={() => cancelRoll(activeRoll)}>Annuler</button>
            <button type="button" onClick={() => reroll(activeRoll)} disabled={activeRoll.status !== "ROLLED"}>Relancer</button>
            <button type="button" onClick={() => resolveRoll(activeRoll)} disabled={activeRoll.status !== "ROLLED"}>Valider</button>
          </div>
        </div>
      ) : (
        <div className="action-roll__wizard">
          {status && <p className="action-roll__status">{status}</p>}
          <div className="action-roll__steps">
            {[1, 2].map((item) => (
              <button key={item} type="button" className={step >= item ? "action-roll__step--active" : ""} onClick={() => setStep(item)}>
                {item}
              </button>
            ))}
          </div>

          {step === 1 && (
            <div className="action-roll__page">
              <strong className="action-roll__section-title">1 · L'action</strong>
              <label>
                Joueur
                <select value={playerUserId} onChange={(event) => setPlayerUserId(event.target.value)}>
                  {players.map((player) => <option key={player.userId} value={player.userId}>{player.charName}</option>)}
                </select>
              </label>
              <label>
                Action tentée
                <textarea value={actionText} onChange={(event) => setActionText(event.target.value)} rows={2} placeholder="Ex : attaque le marchand" />
              </label>
              <label>
                Cible (facultatif)
                <select value={target} onChange={(event) => setTarget(event.target.value)}>
                  <option value="NONE:">Aucune cible</option>
                  <optgroup label="Éléments">
                    {selectableElements.map((element) => (
                      <option key={element.id} value={`ELEMENT:${element.id}`}>{element.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Joueurs">
                    {members.filter((member) => member.role === "PLAYER").map((member) => (
                      <option key={member.user.id} value={`PLAYER:${member.user.id}`}>{member.user.username}</option>
                    ))}
                  </optgroup>
                </select>
              </label>
              <div className="action-roll__grid">
                <label>Dé<select value={dieSides} onChange={(event) => setDieSides(Number(event.target.value))}>{[4, 6, 8, 10, 12, 20, 100].map((die) => <option key={die} value={die}>d{die}</option>)}</select></label>
                <label>Échec {"<="}<input type="number" value={totalFailureMax} onChange={(event) => setTotalFailureMax(Number(event.target.value))} /></label>
                <label>Réussite {">="}<input type="number" value={successMin} onChange={(event) => setSuccessMin(Number(event.target.value))} /></label>
                <label>Totale {">="}<input type="number" value={totalSuccessMin} onChange={(event) => setTotalSuccessMin(Number(event.target.value))} /></label>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="action-roll__page">
              <strong className="action-roll__section-title">2 · Effets par palier (facultatif)</strong>
              <p className="gm__panel-lead">Laisse sur « aucun effet » pour arbitrer toi-même.</p>
              <div className="action-roll__outcomes">
                {OUTCOME_ORDER.map((outcome) => {
                  const item = consequences[outcome];
                  return (
                    <section key={outcome} className="action-roll__outcome-card">
                      <h4>{OUTCOME_LABELS[outcome]}</h4>
                      <label>
                        Effet
                        <select value={item.type} onChange={(event) => updateConsequence(outcome, { type: event.target.value as ActionRollConsequence["type"] })}>
                          {Object.entries(CONSEQUENCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </label>
                      {(item.type === "DAMAGE_TARGET" || item.type === "DAMAGE_PLAYER") && (
                        <label>
                          Montant
                          <input type="number" min={0} value={item.amount} onChange={(event) => updateConsequence(outcome, { amount: Number(event.target.value) })} />
                        </label>
                      )}
                      {(item.type === "NARRATION" || item.type === "NONE") && (
                        <label>
                          Texte
                          <textarea value={item.text} onChange={(event) => updateConsequence(outcome, { text: event.target.value })} rows={2} />
                        </label>
                      )}
                    </section>
                  );
                })}
              </div>
            </div>
          )}

          <div className="action-roll__nav">
            {step === 2
              ? <button type="button" className="live-text-button" onClick={() => setStep(1)}>Retour</button>
              : <button type="button" className="live-text-button" onClick={() => setStep(2)}>Régler les effets</button>}
            <button type="button" onClick={createRoll} disabled={!playerUserId || !actionText.trim()}>Envoyer au joueur</button>
          </div>
        </div>
      )}
    </section>
  );
}

function SceneElementGroup({
  title,
  elements,
  onVisibilityChange,
  onRemove
}: {
  title: string;
  elements: CampaignDetail["live"]["elements"];
  onVisibilityChange: (id: string, isVisible: boolean) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  return (
    <section className="media-scene__group">
      <h3>{title} <span>{elements.length}</span></h3>
      {elements.map((element) => (
        <article key={element.id} className="media-scene__element">
          <div className={`media-scene__icon media-scene__icon--${element.type.toLowerCase()}`}>
            {element.asset ? <img src={element.asset.imageDataUrl} alt="" /> : ELEMENT_ICONS[element.type]}
          </div>
          <div>
            <strong>{element.name}{element.quantity > 1 ? ` x${element.quantity}` : ""}</strong>
            <span>{ELEMENT_LABELS[element.type]}</span>
            {element.type !== "NARRATION" && <span>{elementHpLabel(element)}</span>}
          </div>
          <div className="media-scene__actions">
            <button type="button" onClick={() => onVisibilityChange(element.id, !element.isVisible)}>
              {element.isVisible ? "Masquer" : "Afficher"}
            </button>
            <button type="button" onClick={() => onRemove(element.id)}>Supprimer</button>
          </div>
        </article>
      ))}
      {elements.length === 0 && <p className="live-empty">Aucun element.</p>}
    </section>
  );
}

type SceneCanvasProps = {
  elements: CampaignDetail["live"]["elements"];
  positions: Map<string, ElementPos>;
  onPositionChange?: (id: string, pos: ElementPos) => void;
  onPositionDrop?: (id: string, posX: number, posY: number) => void;
  isGm?: boolean;
};

function SceneCanvas({ elements, positions, onPositionChange, onPositionDrop, isGm = false }: SceneCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ elementId: string; lastPos: ElementPos } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  function getPos(id: string, fallbackX: number, fallbackY: number): ElementPos {
    return positions.get(id) ?? { posX: fallbackX, posY: fallbackY };
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>, element: CampaignDetail["live"]["elements"][number]) {
    if (!isGm) return;
    e.preventDefault();
    e.stopPropagation();
    const pos = getPos(element.id, element.posX, element.posY);
    dragRef.current = { elementId: element.id, lastPos: pos };
    setDraggingId(element.id);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>, elementId: string) {
    if (!dragRef.current || dragRef.current.elementId !== elementId || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const posX = Math.max(2, Math.min(98, ((e.clientX - rect.left) / rect.width) * 100));
    const posY = Math.max(2, Math.min(98, ((e.clientY - rect.top) / rect.height) * 100));
    const pos = { posX, posY };
    dragRef.current.lastPos = pos;
    onPositionChange?.(elementId, pos);
  }

  function onPointerUp(_e: React.PointerEvent<HTMLDivElement>, elementId: string) {
    if (!dragRef.current || dragRef.current.elementId !== elementId) return;
    const { posX, posY } = dragRef.current.lastPos;
    dragRef.current = null;
    setDraggingId(null);
    onPositionDrop?.(elementId, posX, posY);
  }

  // Éventaille les jetons qui partagent exactement la même position
  // (ex. fraîchement révélés au centre 50/50) pour éviter qu'ils se superposent.
  const posCounts = new Map<string, number>();
  for (const el of elements) {
    const p = getPos(el.id, el.posX, el.posY);
    const key = `${Math.round(p.posX)}:${Math.round(p.posY)}`;
    posCounts.set(key, (posCounts.get(key) ?? 0) + 1);
  }
  const posSeen = new Map<string, number>();
  function displayPos(element: CampaignDetail["live"]["elements"][number]): ElementPos {
    const base = getPos(element.id, element.posX, element.posY);
    if (draggingId === element.id) return base;
    const key = `${Math.round(base.posX)}:${Math.round(base.posY)}`;
    const total = posCounts.get(key) ?? 1;
    if (total <= 1) return base;
    const i = posSeen.get(key) ?? 0;
    posSeen.set(key, i + 1);
    const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
    return {
      posX: Math.max(10, Math.min(90, base.posX + Math.cos(angle) * 24)),
      posY: Math.max(16, Math.min(86, base.posY + Math.sin(angle) * 22))
    };
  }

  return (
    <div ref={containerRef} className="scene-revelations">
      {elements.map((element) => {
        const { posX, posY } = displayPos(element);
        const isDragging = draggingId === element.id;
        return (
          <div
            key={element.id}
            className={`scene-revelation scene-revelation--${element.type.toLowerCase()}${isGm ? " scene-revelation--draggable" : ""}${isDragging ? " scene-revelation--dragging" : ""}`}
            style={{ left: `${posX}%`, top: `${posY}%`, transform: isDragging ? "translate(-50%, -50%) scale(1.06)" : "translate(-50%, -50%)" }}
            onPointerDown={isGm ? (e) => onPointerDown(e, element) : undefined}
            onPointerMove={isGm ? (e) => onPointerMove(e, element.id) : undefined}
            onPointerUp={isGm ? (e) => onPointerUp(e, element.id) : undefined}
          >
            {element.asset
              ? <img src={element.asset.imageDataUrl} alt={element.asset.name} draggable={false} />
              : <span className="scene-revelation__fallback">{ELEMENT_ICONS[element.type]}</span>}
            <strong>{element.name}{element.quantity > 1 ? ` x${element.quantity}` : ""}</strong>
            {element.type !== "NARRATION" && <span className="scene-revelation__hp">{elementHpLabel(element)}</span>}
            {element.type === "NARRATION" && <p>{element.description}</p>}
          </div>
        );
      })}
    </div>
  );
}

function SceneRevelations({ elements, positions }: { elements: CampaignDetail["live"]["elements"]; positions: Map<string, ElementPos> }) {
  return <SceneCanvas elements={elements} positions={positions} isGm={false} />;
}

function PlayerHealth({
  players,
  onSelectPlayer,
}: {
  players: CampaignDetail["live"]["players"];
  onSelectPlayer?: (player: CampaignDetail["live"]["players"][number]) => void;
}) {
  return (
    <section className="live-health live-panel">
      <p className="live-kicker">Etat du groupe</p>
      {players.map((player) => (
        <div
          key={player.userId}
          className={`live-health__row ${onSelectPlayer ? "live-health__row--clickable" : ""}`}
          onClick={() => onSelectPlayer?.(player)}
        >
          <div><strong>{player.charName}</strong><span>{CHAR_LABELS[player.charId] ?? player.username}</span></div>
          <b>{player.hp} / {player.maxHp}</b>
          <div className="live-health__bar"><span style={{ width: `${Math.round((player.hp / player.maxHp) * 100)}%` }} /></div>
          {onSelectPlayer && <span className="live-health__arrow">›</span>}
        </div>
      ))}
      {players.length === 0 && <p className="live-empty">Aucune fiche personnage pour le moment.</p>}
    </section>
  );
}

function ElementCard({ element }: { element: CampaignDetail["live"]["elements"][number] }) {
  return (
    <article className={`live-element-card live-element-card--${element.type.toLowerCase()}`}>
      <p className="live-kicker">{ELEMENT_LABELS[element.type]}</p>
      <h2>{element.name}{element.quantity > 1 ? ` x${element.quantity}` : ""}</h2>
      {element.type !== "NARRATION" && <strong className="live-element-card__hp">{elementHpLabel(element)}</strong>}
      <p>{element.description}</p>
    </article>
  );
}

type PlayerViewProps = {
  data: CampaignDetail;
  visibleElements: CampaignDetail["live"]["elements"];
  positions: Map<string, ElementPos>;
  actionRolls: ActionRoll[];
  sceneStyle: CSSProperties;
  refreshKey: number;
};

type PlayerTab = "scene" | "character" | "inventory";

function PlayerView({ data, visibleElements, positions, actionRolls, sceneStyle, refreshKey }: PlayerViewProps) {
  const [tab, setTab] = useState<PlayerTab>("scene");
  const currentUserId = data.viewer.userId || data.members.find((member) => member.id === data.viewer.memberId)?.user.id || "";

  return (
    <main className="live-player live-scene" style={sceneStyle}>
      <header className="live-topbar">
        <strong>GRIMOIRE</strong>
        <span>{data.campaign.title}</span>
        <span className="live-badge live-badge--danger">En direct</span>
      </header>

      {tab === "scene" && (
        <div className="player-stage">
          <SceneRevelations elements={visibleElements} positions={positions} />
          <div className="player-hud">
            <section className="live-player__story">
              <p className="live-kicker">{data.live.scene.title}</p>
              <h1>{data.live.scene.text || "Le MJ prépare la suite de votre aventure…"}</h1>
            </section>
            <PlayerHealth players={data.live.players} />
          </div>
          <PlayerActionRollPanel
            campaignId={data.campaign.id}
            currentUserId={currentUserId}
            actionRolls={actionRolls}
          />
        </div>
      )}

      {tab === "character" && (
        <div className="player-sheet">
          <CharacterSheet campaignId={data.campaign.id} refreshKey={refreshKey} />
        </div>
      )}

      {tab === "inventory" && (
        <div className="player-sheet">
          <Inventory campaignId={data.campaign.id} refreshKey={refreshKey} />
          <TradePanel
            campaignId={data.campaign.id}
            currentUserId={data.members.find((m) => m.id === data.viewer.memberId)?.user.id ?? ""}
            members={data.members}
          />
        </div>
      )}

      <nav className="player-tabs">
        <button
          className={`player-tab ${tab === "scene" ? "player-tab--active" : ""}`}
          onClick={() => setTab("scene")}
        >
          Scène
        </button>
        <button
          className={`player-tab ${tab === "character" ? "player-tab--active" : ""}`}
          onClick={() => setTab("character")}
        >
          Personnage
        </button>
        <button
          className={`player-tab ${tab === "inventory" ? "player-tab--active" : ""}`}
          onClick={() => setTab("inventory")}
        >
          Inventaire
        </button>
      </nav>
    </main>
  );
}

function PlayerActionRollPanel({
  campaignId,
  currentUserId,
  actionRolls
}: {
  campaignId: string;
  currentUserId: string;
  actionRolls: ActionRoll[];
}) {
  const [localRolls, setLocalRolls] = useState(actionRolls);
  const [error, setError] = useState("");
  const [rollStatus, setRollStatus] = useState("");
  const [isRolling, setIsRolling] = useState(false);
  const diceContainerId = `dice-box-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const diceBoxRef = useRef<unknown>(null);
  const diceBoxReadyRef = useRef<Promise<unknown> | null>(null);
  const activeRolls = localRolls.filter((item) => item.status === "PENDING" || item.status === "ROLLED");
  const roll = activeRolls.find((item) => item.playerUserId === currentUserId) ?? activeRolls[0] ?? null;

  useEffect(() => {
    setLocalRolls((prev) => {
      const merged = [...actionRolls];
      for (const rollItem of prev) {
        if (!merged.some((item) => item.id === rollItem.id)) merged.push(rollItem);
      }
      return merged.filter((item) => item.status === "PENDING" || item.status === "ROLLED");
    });
  }, [actionRolls]);

  useEffect(() => {
    let cancelled = false;

    async function loadActiveRolls() {
      try {
        const data = await apiFetch<{ actionRolls: ActionRoll[] }>(`/campaigns/${campaignId}/action-rolls/active`);
        if (!cancelled) {
          setLocalRolls(data.actionRolls);
          setError("");
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Jet indisponible");
      }
    }

    void loadActiveRolls();
    const interval = window.setInterval(loadActiveRolls, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [campaignId]);

  async function getDiceBox() {
    if (diceBoxRef.current) return diceBoxRef.current;
    if (!diceBoxReadyRef.current) {
      diceBoxReadyRef.current = import("@3d-dice/dice-box").then(async ({ default: DiceBox }) => {
        const box = new DiceBox({
          container: `#${diceContainerId}`,
          assetPath: "/assets/",
          themeColor: "#d9b36c",
          scale: 6,
          gravity: 1,
          mass: 1,
          friction: 0.8,
          restitution: 0.1,
          enableShadows: true
        });
        await box.init();
        diceBoxRef.current = box;
        return box;
      });
    }
    return diceBoxReadyRef.current;
  }

  function extractDiceResult(value: unknown, sides: number): number | null {
    if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= sides) return value;
    if (!value || typeof value !== "object") return null;
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = extractDiceResult(item, sides);
        if (found !== null) return found;
      }
      return null;
    }
    const record = value as Record<string, unknown>;
    if ("value" in record) {
      const found = extractDiceResult(record.value, sides);
      if (found !== null) return found;
    }
    if ("rolls" in record) {
      const found = extractDiceResult(record.rolls, sides);
      if (found !== null) return found;
    }
    return null;
  }

  async function rollDice(activeRoll: ActionRoll) {
    setIsRolling(true);
    setRollStatus("Lancer du de...");
    let animatedResult: number | null = null;
    try {
      const diceBox = await getDiceBox() as { roll: (notation: string) => Promise<unknown> };
      const results = await diceBox.roll(`1d${activeRoll.dieSides}`);
      animatedResult = extractDiceResult(results, activeRoll.dieSides);
    } catch {
      setRollStatus("Animation indisponible, lancer serveur...");
    }

    try {
      const data = await apiFetch<{ actionRoll: ActionRoll }>(`/campaigns/${campaignId}/action-rolls/${activeRoll.id}/roll`, {
        method: "POST",
        json: animatedResult ? { result: animatedResult } : undefined
      });
      setLocalRolls((prev) => [data.actionRoll, ...prev.filter((item) => item.id !== data.actionRoll.id)]);
      setRollStatus("");
    } catch (rollError) {
      setRollStatus(rollError instanceof Error ? rollError.message : "Lancer impossible");
    } finally {
      setIsRolling(false);
    }
  }

  if (!roll && !error) return null;

  return (
    <section className="player-roll-card">
      <p className="live-kicker">Jet demande par le MJ</p>
      {!roll && error && <p>{error}</p>}
      {roll && (
        <>
      <h2>{roll.actionText}</h2>
      {roll.targetName && <p>Cible : {roll.targetName}</p>}
      <div id={diceContainerId} className="player-roll-card__dice" />
      <div className="player-roll-card__rules">
        <span>d{roll.dieSides}</span>
        <span>Echec total {"<="} {roll.totalFailureMax}</span>
        <span>Reussite {">="} {roll.successMin}</span>
        <span>Totale {">="} {roll.totalSuccessMin}</span>
      </div>
      {rollStatus && <p className="player-roll-card__status">{rollStatus}</p>}
      {roll.status === "PENDING" ? (
        <button type="button" onClick={() => rollDice(roll)} disabled={isRolling}>
          {isRolling ? "Le de roule..." : `Lancer le d${roll.dieSides}`}
        </button>
      ) : (
        <div className="player-roll-card__result">
          <span>Resultat</span>
          <b>{roll.result}</b>
          <strong>{roll.outcome ? OUTCOME_LABELS[roll.outcome] : "En attente"}</strong>
          <p>Le MJ valide la resolution ou demande une relance.</p>
        </div>
      )}
        </>
      )}
    </section>
  );
}

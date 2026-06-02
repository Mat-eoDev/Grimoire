import { Link } from "react-router-dom";
import { useState } from "react";

import { apiFetch } from "../lib/api";
import type { CampaignDetail } from "../lib/types";

type Props = {
  data: CampaignDetail;
  onReload: () => Promise<void>;
  onStop: () => Promise<void>;
};

const PRESETS = [
  { id: "RUINS", label: "Ruines", title: "Les ruines sous la pluie" },
  { id: "TAVERN", label: "Taverne", title: "La taverne du vieux pont" },
  { id: "FOREST", label: "Foret", title: "La foret embrumee" },
  { id: "VILLAGE", label: "Village", title: "Le village silencieux" }
];

const ELEMENT_LABELS = {
  ENEMY: "Ennemi",
  NPC: "PNJ",
  OBJECT: "Objet visuel",
  NARRATION: "Narration"
} as const;

const ELEMENT_DEFAULTS = {
  ENEMY: { name: "Garde spectral", description: "Une silhouette armee barre le passage." },
  NPC: { name: "Voyageur inconnu", description: "Une presence semble vouloir vous parler." },
  OBJECT: { name: "Coffre scelle", description: "Un objet attire votre attention." },
  NARRATION: { name: "Brouillard ancien", description: "L'atmosphere de la scene change." }
} as const;

const ELEMENT_ICONS = {
  ENEMY: "!",
  NPC: "?",
  OBJECT: "*",
  NARRATION: "..."
} as const;

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

export function LiveCampaign({ data, onReload, onStop }: Props) {
  const isGm = data.viewer.role === "GM";
  const [title, setTitle] = useState(data.live.scene.title);
  const [text, setText] = useState(data.live.scene.text);
  const [preset, setPreset] = useState(data.live.scene.preset);
  const [loading, setLoading] = useState(false);
  const [draftType, setDraftType] = useState<keyof typeof ELEMENT_LABELS | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftQuantity, setDraftQuantity] = useState(1);
  const [draftAssetId, setDraftAssetId] = useState("");
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

  if (!isGm) {
    return (
      <main className={`live-player live-scene--${data.live.scene.preset.toLowerCase()}`}>
        <header className="live-topbar">
          <strong>GRIMOIRE</strong>
          <span>{data.campaign.title}</span>
          <span className="live-badge">Exploration</span>
        </header>
        <section className="live-player__story">
          <p className="live-kicker">{data.live.scene.title}</p>
          <h1>{data.live.scene.text || "Le MJ prepare la suite de votre aventure..."}</h1>
        </section>
        <PlayerHealth players={data.live.players} />
        <SceneRevelations elements={visibleElements} />
        <section className="live-player__elements">
          <p className="live-kicker">Presences dans la scene</p>
          <div className="live-element-grid">
            {visibleElements.map((element) => <ElementCard key={element.id} element={element} />)}
            {visibleElements.length === 0 && <p className="live-empty">Rien de particulier ne retient votre attention.</p>}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="live-gm">
      <header className="live-topbar">
        <strong>GRIMOIRE</strong>
        <span>{data.campaign.title}</span>
        <span className="live-badge live-badge--danger">Partie en direct</span>
        <Link to="/" className="live-link">Accueil</Link>
      </header>
      <div className="live-gm__layout">
        <section className="live-gm__main">
          <div>
            <p className="live-kicker">Regie MJ</p>
            <h1>Scene actuellement diffusee</h1>
            <p className="live-muted">Apercu de ce que voient les joueurs.</p>
          </div>
          <div className={`live-preview live-scene--${data.live.scene.preset.toLowerCase()}`}>
            <p className="live-kicker">{data.live.scene.title}</p>
            <h2>{data.live.scene.text}</h2>
            <SceneRevelations elements={visibleElements} />
            {visibleElements.some((element) => element.type === "ENEMY") && (
              <div className="live-preview__threat">
                <span>Ennemis visibles</span>
                <strong>{visibleElements.filter((element) => element.type === "ENEMY").length} groupe(s)</strong>
                <button type="button">Lancer le combat</button>
              </div>
            )}
          </div>
          <section>
            <h2>Changer de contexte</h2>
            <p className="live-muted">Choisis une image, ajuste le texte puis diffuse la scene.</p>
            <div className="live-preset-grid">
              {PRESETS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`live-preset live-scene--${item.id.toLowerCase()}${preset === item.id ? " live-preset--selected" : ""}`}
                  onClick={() => { setPreset(item.id); setTitle(item.title); }}
                >
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
            <div className="live-scene-form">
              <input value={title} onChange={(event) => setTitle(event.target.value)} />
              <textarea value={text} onChange={(event) => setText(event.target.value)} rows={3} />
              <button type="button" onClick={publishScene} disabled={loading}>
                {loading ? "Diffusion..." : "Diffuser cette scene"}
              </button>
            </div>
          </section>
          <section>
            <h2>Elements de la scene</h2>
            <div className="live-gm__element-list">
              {data.live.elements.map((element) => (
                <div key={element.id} className={`live-gm__element${element.isVisible ? "" : " live-gm__element--hidden"}`}>
                  <strong>{element.name}{element.quantity > 1 ? ` x${element.quantity}` : ""}</strong>
                  <span>{ELEMENT_LABELS[element.type]}</span>
                  <button type="button" className="live-text-button" onClick={() => setElementVisibility(element.id, !element.isVisible)}>
                    {element.isVisible ? "Masquer" : "Reveler"}
                  </button>
                </div>
              ))}
            </div>
          </section>
        </section>
        <aside className="live-gm__aside">
          <PlayerHealth players={data.live.players} />
          <section className="live-panel">
            <h2>Ajouter a la scene</h2>
            <p className="live-muted">Revelation immediate aux joueurs.</p>
            <div className="live-action-grid">
              {(Object.keys(ELEMENT_LABELS) as Array<keyof typeof ELEMENT_LABELS>).map((type) => (
                <button key={type} type="button" onClick={() => prepareElement(type)}>
                  + {ELEMENT_LABELS[type]}
                </button>
              ))}
            </div>
            {draftType && (
              <div className="live-reveal-form">
                <h3>Reveler : {ELEMENT_LABELS[draftType]}</h3>
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
                      <option value="">Choisir un texte...</option>
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
                    Quantite
                    <input type="number" min={1} max={20} value={draftQuantity} onChange={(event) => setDraftQuantity(Number(event.target.value))} />
                  </label>
                )}
                {draftType !== "NARRATION" && (
                  <label>
                    Image
                    <select value={draftAssetId} onChange={(event) => setDraftAssetId(event.target.value)}>
                      <option value="">Aucune image : pictogramme par defaut</option>
                      {data.live.assets.filter((asset) => asset.type === draftType).map((asset) => (
                        <option key={asset.id} value={asset.id}>{asset.name}</option>
                      ))}
                    </select>
                  </label>
                )}
                <div className="live-reveal-form__actions">
                  <button type="button" className="live-text-button" onClick={() => setDraftType(null)}>Annuler</button>
                  <button type="button" onClick={revealElement}>Reveler maintenant</button>
                </div>
              </div>
            )}
          </section>
          <button type="button" className="live-stop" onClick={onStop}>Terminer la partie</button>
        </aside>
      </div>
    </main>
  );
}

function SceneRevelations({ elements }: { elements: CampaignDetail["live"]["elements"] }) {
  const hasEnemies = elements.some((element) => element.type === "ENEMY");

  return (
    <div className="scene-revelations">
      {elements.map((element) => (
        <div
          key={element.id}
          className={`scene-revelation scene-revelation--${element.type.toLowerCase()}${element.type === "NPC" && hasEnemies ? " scene-revelation--npc-with-enemies" : ""}`}
        >
          {element.asset
            ? <img src={element.asset.imageDataUrl} alt={element.asset.name} />
            : <span className="scene-revelation__fallback">{ELEMENT_ICONS[element.type]}</span>}
          <strong>{element.name}{element.quantity > 1 ? ` x${element.quantity}` : ""}</strong>
          {element.type === "NARRATION" && <p>{element.description}</p>}
        </div>
      ))}
    </div>
  );
}

function PlayerHealth({ players }: { players: CampaignDetail["live"]["players"] }) {
  return (
    <section className="live-health live-panel">
      <p className="live-kicker">Etat du groupe</p>
      {players.map((player) => (
        <div key={player.userId} className="live-health__row">
          <div><strong>{player.charName}</strong><span>{CHAR_LABELS[player.charId] ?? player.username}</span></div>
          <b>{player.hp} / {player.maxHp}</b>
          <div className="live-health__bar"><span style={{ width: `${Math.round((player.hp / player.maxHp) * 100)}%` }} /></div>
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
      <p>{element.description}</p>
    </article>
  );
}

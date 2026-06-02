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
  const [libraryTab, setLibraryTab] = useState<"SCENE" | keyof typeof ELEMENT_LABELS>("SCENE");
  const [search, setSearch] = useState("");
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

  /*
   * LEGACY GM VIEW (before the library redesign)
   * Kept intentionally for product comparison:
   * - preview first
   * - context thumbnails below the preview
   * - scene elements in a flat list
   * - revelation form inside the right column
   *
   * This version was replaced because large image collections need one
   * searchable library with tabs and a separate active-scene manager.
   */
  return (
    <main className="live-gm">
      <header className="live-topbar">
        <strong>GRIMOIRE</strong>
        <span>{data.campaign.title}</span>
        <span className="live-badge live-badge--danger">Partie en direct</span>
        <Link to="/" className="live-link">Accueil</Link>
      </header>
      <div className="media-gm">
        <section className="media-gm__preview">
          <div className="media-section-heading">
            <div>
              <p className="live-kicker">Regie MJ</p>
              <h1>Apercu joueurs en direct</h1>
              <p className="live-muted">Compose la scene puis choisis ce que les joueurs voient.</p>
            </div>
            <button type="button" onClick={publishScene} disabled={loading}>
              {loading ? "Diffusion..." : "Diffuser la scene"}
            </button>
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
        </section>

        <section className="media-library live-panel">
          <div className="media-section-heading">
            <div>
              <p className="live-kicker">Bibliotheque</p>
              <h2>Choisir un element</h2>
            </div>
            <input value={search} placeholder="Rechercher..." onChange={(event) => setSearch(event.target.value)} />
          </div>
          <div className="media-tabs">
            <button type="button" className={libraryTab === "SCENE" ? "media-tab--active" : ""} onClick={() => setLibraryTab("SCENE")}>Contextes</button>
            {(Object.keys(ELEMENT_LABELS) as Array<keyof typeof ELEMENT_LABELS>).map((type) => (
              <button key={type} type="button" className={libraryTab === type ? "media-tab--active" : ""} onClick={() => setLibraryTab(type)}>
                {ELEMENT_LABELS[type]}
              </button>
            ))}
          </div>
          <div className="media-grid">
            {libraryTab === "SCENE" && PRESETS
              .filter((item) => item.label.toLowerCase().includes(search.toLowerCase()))
              .map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`media-card live-scene--${item.id.toLowerCase()}${preset === item.id ? " media-card--selected" : ""}`}
                  onClick={() => { setPreset(item.id); setTitle(item.title); }}
                >
                  <span>{item.label}</span>
                </button>
              ))}
            {libraryTab !== "SCENE" && data.live.assets
              .filter((asset) => asset.type === libraryTab && asset.name.toLowerCase().includes(search.toLowerCase()))
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
            {libraryTab !== "SCENE" && (
              <button type="button" className="media-card media-card--fallback" onClick={() => prepareElement(libraryTab)}>
                <b>{ELEMENT_ICONS[libraryTab]}</b>
                <span>Sans image</span>
              </button>
            )}
          </div>
          {libraryTab === "SCENE" && (
            <div className="live-scene-form">
              <input value={title} onChange={(event) => setTitle(event.target.value)} />
              <textarea value={text} onChange={(event) => setText(event.target.value)} rows={2} />
            </div>
          )}
          {libraryTab === "NARRATION" && !draftType && (
            <button type="button" className="media-library__compose" onClick={() => prepareElement("NARRATION")}>+ Ecrire une narration</button>
          )}
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
                  <button type="button" onClick={revealElement}>Ajouter visible</button>
                </div>
              </div>
            )}
        </section>

        <aside className="media-scene live-panel">
          <p className="live-kicker">Elements de la scene</p>
          <h2>Gerer l'affichage</h2>
          <p className="live-muted">Affiche, masque ou supprime ce qui a ete prepare.</p>
          <SceneElementGroup
            title="Visible"
            elements={data.live.elements.filter((element) => element.isVisible)}
            onVisibilityChange={setElementVisibility}
            onRemove={removeElement}
          />
          <SceneElementGroup
            title="Masque"
            elements={data.live.elements.filter((element) => !element.isVisible)}
            onVisibilityChange={setElementVisibility}
            onRemove={removeElement}
          />
          <PlayerHealth players={data.live.players} />
          <button type="button" className="live-stop" onClick={onStop}>Terminer la partie</button>
        </aside>
      </div>
    </main>
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

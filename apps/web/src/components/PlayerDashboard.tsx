import { FormEvent, useState } from "react";

import { apiFetch } from "../lib/api";
import type { CampaignPayload } from "../lib/types";
import { SectionCard } from "./SectionCard";

type PlayerDashboardProps = {
  payload: CampaignPayload;
  reload: () => Promise<void>;
};

export function PlayerDashboard({ payload, reload }: PlayerDashboardProps) {
  const [characterForm, setCharacterForm] = useState({
    name: "",
    raceId: "",
    classId: "",
    level: "1",
    hpMax: "12",
    mjNotes: ""
  });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreateCharacter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setError(null);
      await apiFetch(`/campaigns/${payload.campaign.id}/characters`, {
        method: "POST",
        json: {
          ...characterForm,
          raceId: characterForm.raceId ? Number(characterForm.raceId) : undefined,
          classId: characterForm.classId ? Number(characterForm.classId) : undefined,
          level: Number(characterForm.level),
          hpMax: Number(characterForm.hpMax)
        }
      });
      setFeedback("Personnage envoye au MJ pour validation.");
      setCharacterForm({
        name: "",
        raceId: "",
        classId: "",
        level: "1",
        hpMax: "12",
        mjNotes: ""
      });
      await reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Creation impossible");
    }
  }

  return (
    <div className="dashboard-grid">
      {error ? <div className="feedback feedback--error full-span">{error}</div> : null}
      {feedback ? <div className="feedback feedback--success full-span">{feedback}</div> : null}

      <section
        className="scene-stage full-span"
        style={
          payload.currentView.publishedVisual
            ? {
                backgroundImage: `linear-gradient(180deg, rgba(29, 24, 18, 0.35), rgba(29, 24, 18, 0.82)), url(${payload.currentView.publishedVisual.assetUrl})`
              }
            : undefined
        }
      >
        <div className="scene-stage__content">
          <p className="eyebrow">Vue joueur</p>
          <h2>{payload.currentView.publishedScene?.title ?? "Le MJ prepare la scene suivante"}</h2>
          <p>{payload.currentView.publishedScene?.playerText ?? "Patiente pendant la mise en place du contexte."}</p>
        </div>
      </section>

      <SectionCard title="Mon personnage" subtitle="Creation et statut de validation">
        <form className="stack-form" onSubmit={handleCreateCharacter}>
          <label>
            Nom
            <input
              type="text"
              value={characterForm.name}
              onChange={(event) => setCharacterForm((current) => ({ ...current, name: event.target.value }))}
              required
            />
          </label>
          <div className="inline-form">
            <label>
              Race
              <select
                value={characterForm.raceId}
                onChange={(event) => setCharacterForm((current) => ({ ...current, raceId: event.target.value }))}
              >
                <option value="">Aucune</option>
                {payload.references.races.map((race) => (
                  <option key={race.id} value={race.id}>
                    {race.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Metier
              <select
                value={characterForm.classId}
                onChange={(event) => setCharacterForm((current) => ({ ...current, classId: event.target.value }))}
              >
                <option value="">Aucun</option>
                {payload.references.classes.map((characterClass) => (
                  <option key={characterClass.id} value={characterClass.id}>
                    {characterClass.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="inline-form">
            <label>
              Niveau
              <input
                type="number"
                min={1}
                value={characterForm.level}
                onChange={(event) => setCharacterForm((current) => ({ ...current, level: event.target.value }))}
              />
            </label>
            <label>
              PV max
              <input
                type="number"
                min={1}
                value={characterForm.hpMax}
                onChange={(event) => setCharacterForm((current) => ({ ...current, hpMax: event.target.value }))}
              />
            </label>
          </div>
          <label>
            Notes pour le MJ
            <textarea
              rows={2}
              value={characterForm.mjNotes}
              onChange={(event) => setCharacterForm((current) => ({ ...current, mjNotes: event.target.value }))}
            />
          </label>
          <button type="submit">Envoyer au MJ</button>
        </form>

        <div className="list-stack">
          {payload.myCharacters.map((character) => (
            <article className="list-row" key={character.id}>
              <div>
                <strong>{character.name}</strong>
                <p>
                  {character.race?.name ?? "Sans race"} · {character.characterClass?.name ?? "Sans metier"} · niv.{" "}
                  {character.level}
                </p>
              </div>
              <span className={`pill ${character.isApproved ? "pill--success" : "pill--warning"}`}>
                {character.isApproved ? "Valide" : "En attente"}
              </span>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Statut du groupe" subtitle="Personnages joueurs actuellement valides">
        <div className="list-stack">
          {payload.partyStatus.map((actor) => (
            <article className="list-row" key={actor.id}>
              <div>
                <strong>{actor.name}</strong>
                <p>
                  {actor.owner?.username ?? "Joueur"} · {actor.hpCurrent}/{actor.hpMax} PV
                </p>
              </div>
              <span className="pill">{actor.characterClass?.name ?? "Sans classe"}</span>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Presence visible" subtitle="PNJ, ennemis et personnages rendus visibles">
        <div className="list-stack">
          {payload.currentView.visibleActors.map((actor) => (
            <article className="list-row" key={actor.id}>
              <div>
                <strong>{actor.name}</strong>
                <p>
                  {actor.actorType} · {actor.hpCurrent}/{actor.hpMax} PV
                </p>
              </div>
            </article>
          ))}
          {payload.currentView.visibleActors.length === 0 ? (
            <p className="empty-state">Aucun acteur n'est encore visible dans cette scene.</p>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard title="Combat en cours" subtitle="Mises a jour poussees par le MJ">
        {payload.currentView.activeCombat ? (
          <div className="stack-layout">
            <div className="list-stack">
              {payload.currentView.activeCombat.participants.map((participant) => (
                <article className="list-row" key={participant.id}>
                  <div>
                    <strong>{participant.actor.name}</strong>
                    <p>
                      {participant.side} · {participant.currentHp} PV · {participant.status}
                    </p>
                  </div>
                </article>
              ))}
            </div>
            <div className="list-stack">
              {payload.currentView.activeCombat.actions.map((action) => (
                <article className="list-row" key={action.id}>
                  <div>
                    <strong>{action.sourceActorName}</strong>
                    <p>
                      {action.actionLabel}
                      {action.targetActorName ? ` → ${action.targetActorName}` : ""}
                    </p>
                    <small>{action.resultText || "Aucun commentaire"}</small>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <p className="empty-state">Aucun combat actif pour le moment.</p>
        )}
      </SectionCard>

      <SectionCard title="Recompenses recentes" subtitle="Attributions visibles dans la campagne">
        <div className="list-stack">
          {payload.currentView.latestRewards.map((reward) => (
            <article className="list-row" key={reward.id}>
              <div>
                <strong>{reward.label}</strong>
                <p>{reward.description || reward.rewardType}</p>
              </div>
              <span className="pill">{reward.numericValue ?? reward.rewardType}</span>
            </article>
          ))}
          {payload.currentView.latestRewards.length === 0 ? (
            <p className="empty-state">Aucune recompense attribuee.</p>
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}

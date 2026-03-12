import { FormEvent, useState } from "react";

import { apiFetch } from "../lib/api";
import type { CampaignPayload } from "../lib/types";
import { SectionCard } from "./SectionCard";

type MjDashboardProps = {
  payload: CampaignPayload;
  reload: () => Promise<void>;
};

function formatDate(value: string | null) {
  if (!value) {
    return "Non defini";
  }

  return new Date(value).toLocaleString("fr-FR");
}

function toggleItem(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function MjDashboard({ payload, reload }: MjDashboardProps) {
  const gm = payload.gm;
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [actorForm, setActorForm] = useState({
    templateId: "",
    actorType: "NPC",
    name: "",
    level: 1,
    hpMax: 10,
    mjNotes: ""
  });
  const [sceneForm, setSceneForm] = useState({
    title: "",
    summary: "",
    playerText: "",
    gmNotes: "",
    visualLabel: "Decor principal",
    visualUrl: "",
    actorIds: [] as string[]
  });
  const [combatActorIds, setCombatActorIds] = useState<string[]>([]);
  const [actionForm, setActionForm] = useState({
    sourceParticipantId: "",
    targetParticipantId: "",
    actionType: "ATTACK",
    actionLabel: "",
    damageValue: "",
    healingValue: "",
    resultText: ""
  });
  const [rewardForm, setRewardForm] = useState({
    rewardType: "XP",
    label: "",
    description: "",
    numericValue: ""
  });
  const [assignmentForm, setAssignmentForm] = useState({
    rewardId: "",
    actorId: "",
    quantity: "1"
  });

  if (!gm) {
    return null;
  }

  async function wrapAction(action: () => Promise<void>, successMessage: string) {
    try {
      setError(null);
      await action();
      setFeedback(successMessage);
      await reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Action impossible");
    }
  }

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await wrapAction(async () => {
      await apiFetch(`/campaigns/${payload.campaign.id}/invites`, {
        method: "POST",
        json: {
          targetEmail: inviteEmail
        }
      });
      setInviteEmail("");
    }, "Invitation creee.");
  }

  async function handleCreateActor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await wrapAction(async () => {
      await apiFetch(`/campaigns/${payload.campaign.id}/actors`, {
        method: "POST",
        json: {
          ...actorForm,
          level: Number(actorForm.level),
          hpMax: Number(actorForm.hpMax)
        }
      });
      setActorForm({
        templateId: "",
        actorType: "NPC",
        name: "",
        level: 1,
        hpMax: 10,
        mjNotes: ""
      });
    }, "Acteur ajoute a la campagne.");
  }

  async function handleCreateScene(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await wrapAction(async () => {
      await apiFetch(`/campaigns/${payload.campaign.id}/scenes`, {
        method: "POST",
        json: sceneForm
      });
      setSceneForm({
        title: "",
        summary: "",
        playerText: "",
        gmNotes: "",
        visualLabel: "Decor principal",
        visualUrl: "",
        actorIds: []
      });
    }, "Scene creee.");
  }

  async function publishScene(sceneId: string) {
    await wrapAction(async () => {
      await apiFetch(`/scenes/${sceneId}/publish`, {
        method: "POST",
        json: {}
      });
    }, "Scene publiee pour les joueurs.");
  }

  async function validateCharacter(characterId: string) {
    await wrapAction(async () => {
      await apiFetch(`/characters/${characterId}/validate`, {
        method: "POST",
        json: {
          approved: true
        }
      });
    }, "Personnage valide.");
  }

  async function createCombat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await wrapAction(async () => {
      await apiFetch("/combats", {
        method: "POST",
        json: {
          campaignId: payload.campaign.id,
          sceneId: payload.currentView.publishedScene?.id ?? undefined,
          participantActorIds: combatActorIds
        }
      });
      setCombatActorIds([]);
    }, "Combat lance.");
  }

  async function submitCombatAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const activeCombat = gm!.activeCombat;

    if (!activeCombat) {
      return;
    }

    await wrapAction(async () => {
      await apiFetch(`/combats/${activeCombat.id}/actions`, {
        method: "POST",
        json: {
          ...actionForm,
          damageValue: actionForm.damageValue ? Number(actionForm.damageValue) : undefined,
          healingValue: actionForm.healingValue ? Number(actionForm.healingValue) : undefined,
          targetParticipantId: actionForm.targetParticipantId || undefined
        }
      });
      setActionForm({
        sourceParticipantId: "",
        targetParticipantId: "",
        actionType: "ATTACK",
        actionLabel: "",
        damageValue: "",
        healingValue: "",
        resultText: ""
      });
    }, "Action de combat ajoutee.");
  }

  async function endCombat() {
    const activeCombat = gm!.activeCombat;

    if (!activeCombat) {
      return;
    }

    await wrapAction(async () => {
      await apiFetch(`/combats/${activeCombat.id}/end`, {
        method: "POST"
      });
    }, "Combat termine.");
  }

  async function createReward(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await wrapAction(async () => {
      await apiFetch(`/campaigns/${payload.campaign.id}/rewards`, {
        method: "POST",
        json: {
          ...rewardForm,
          numericValue: rewardForm.numericValue ? Number(rewardForm.numericValue) : undefined
        }
      });
      setRewardForm({
        rewardType: "XP",
        label: "",
        description: "",
        numericValue: ""
      });
    }, "Recompense creee.");
  }

  async function assignReward(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await wrapAction(async () => {
      await apiFetch(`/rewards/${assignmentForm.rewardId}/assign`, {
        method: "POST",
        json: {
          actorId: assignmentForm.actorId || undefined,
          quantity: Number(assignmentForm.quantity)
        }
      });
      setAssignmentForm({
        rewardId: "",
        actorId: "",
        quantity: "1"
      });
    }, "Recompense attribuee.");
  }

  return (
    <div className="dashboard-grid">
      {error ? <div className="feedback feedback--error full-span">{error}</div> : null}
      {feedback ? <div className="feedback feedback--success full-span">{feedback}</div> : null}

      <SectionCard
        title="Etat de la diffusion"
        subtitle="Vue actuellement poussee vers les joueurs"
        actions={<span className="pill">{payload.campaign.status}</span>}
      >
        <div className="stats-grid">
          <article className="mini-panel">
            <strong>Scene</strong>
            <span>{payload.currentView.publishedScene?.title ?? "Aucune scene publiee"}</span>
          </article>
          <article className="mini-panel">
            <strong>Visuel</strong>
            <span>{payload.currentView.publishedVisual?.label ?? "Aucun visuel actif"}</span>
          </article>
          <article className="mini-panel">
            <strong>Combat</strong>
            <span>{gm.activeCombat ? `Actif (${gm.activeCombat.participants.length} participants)` : "Aucun"}</span>
          </article>
          <article className="mini-panel">
            <strong>Derniere publication</strong>
            <span>{formatDate(payload.campaign.publishedAt)}</span>
          </article>
        </div>
      </SectionCard>

      <SectionCard title="Invitations" subtitle="Ajoute des joueurs a la campagne">
        <form className="stack-form" onSubmit={handleInvite}>
          <label>
            Email du joueur
            <input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} required />
          </label>
          <button type="submit">Generer une invitation</button>
        </form>
        <div className="list-stack">
          {gm.invites.map((invite) => (
            <article className="list-row" key={invite.id}>
              <div>
                <strong>{invite.targetEmail}</strong>
                <p>{invite.status}</p>
              </div>
              <code>{invite.joinUrl}</code>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Personnages et acteurs" subtitle="Valide les joueurs et cree PNJ ou monstres">
        <div className="two-column-grid">
          <div>
            <h3>Personnages en attente</h3>
            <div className="list-stack">
              {gm.pendingCharacters.map((character) => (
                <article className="list-row" key={character.id}>
                  <div>
                    <strong>{character.name}</strong>
                    <p>{character.owner?.username ?? "Sans proprietaire"} Ã‚Â· niv. {character.level}</p>
                  </div>
                  <button onClick={() => void validateCharacter(character.id)}>Valider</button>
                </article>
              ))}
              {gm.pendingCharacters.length === 0 ? <p className="empty-state">Aucun personnage en attente.</p> : null}
            </div>
          </div>
          <form className="stack-form" onSubmit={handleCreateActor}>
            <h3>Ajouter un PNJ ou monstre</h3>
            <label>
              Modele rapide
              <select
                value={actorForm.templateId}
                onChange={(event) => setActorForm((current) => ({ ...current, templateId: event.target.value }))}
              >
                <option value="">Aucun modele</option>
                {payload.references.actorTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Type
              <select
                value={actorForm.actorType}
                onChange={(event) => setActorForm((current) => ({ ...current, actorType: event.target.value }))}
              >
                <option value="NPC">PNJ</option>
                <option value="MONSTER">Monstre</option>
              </select>
            </label>
            <label>
              Nom
              <input
                type="text"
                value={actorForm.name}
                onChange={(event) => setActorForm((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <div className="inline-form">
              <label>
                Niveau
                <input
                  type="number"
                  min={1}
                  value={actorForm.level}
                  onChange={(event) => setActorForm((current) => ({ ...current, level: Number(event.target.value) }))}
                />
              </label>
              <label>
                PV max
                <input
                  type="number"
                  min={1}
                  value={actorForm.hpMax}
                  onChange={(event) => setActorForm((current) => ({ ...current, hpMax: Number(event.target.value) }))}
                />
              </label>
            </div>
            <label>
              Notes MJ
              <textarea
                rows={3}
                value={actorForm.mjNotes}
                onChange={(event) => setActorForm((current) => ({ ...current, mjNotes: event.target.value }))}
              />
            </label>
            <button type="submit">Ajouter</button>
          </form>
        </div>
      </SectionCard>

      <SectionCard title="Scenes et publication" subtitle="Prepare puis diffuse le contexte">
        <form className="stack-form" onSubmit={handleCreateScene}>
          <label>
            Titre de scene
            <input
              type="text"
              value={sceneForm.title}
              onChange={(event) => setSceneForm((current) => ({ ...current, title: event.target.value }))}
              required
            />
          </label>
          <label>
            Resume
            <textarea
              rows={2}
              value={sceneForm.summary}
              onChange={(event) => setSceneForm((current) => ({ ...current, summary: event.target.value }))}
            />
          </label>
          <label>
            Texte joueur
            <textarea
              rows={3}
              value={sceneForm.playerText}
              onChange={(event) => setSceneForm((current) => ({ ...current, playerText: event.target.value }))}
            />
          </label>
          <label>
            Notes MJ
            <textarea
              rows={3}
              value={sceneForm.gmNotes}
              onChange={(event) => setSceneForm((current) => ({ ...current, gmNotes: event.target.value }))}
            />
          </label>
          <div className="inline-form">
            <label>
              Libelle visuel
              <input
                type="text"
                value={sceneForm.visualLabel}
                onChange={(event) => setSceneForm((current) => ({ ...current, visualLabel: event.target.value }))}
              />
            </label>
            <label>
              URL visuel
              <input
                type="url"
                value={sceneForm.visualUrl}
                onChange={(event) => setSceneForm((current) => ({ ...current, visualUrl: event.target.value }))}
              />
            </label>
          </div>
          <fieldset className="checkbox-grid">
            <legend>Acteurs visibles dans la scene</legend>
            {gm.actors.map((actor) => (
              <label key={actor.id} className="checkbox-chip">
                <input
                  type="checkbox"
                  checked={sceneForm.actorIds.includes(actor.id)}
                  onChange={() =>
                    setSceneForm((current) => ({
                      ...current,
                      actorIds: toggleItem(current.actorIds, actor.id)
                    }))
                  }
                />
                <span>{actor.name}</span>
              </label>
            ))}
          </fieldset>
          <button type="submit">Creer la scene</button>
        </form>
        <div className="list-stack">
          {gm.scenes.map((scene) => (
            <article className="list-row" key={scene.id}>
              <div>
                <strong>{scene.title}</strong>
                <p>{scene.summary || "Sans resume"}</p>
              </div>
              <button onClick={() => void publishScene(scene.id)}>Publier</button>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Combat" subtitle="Lance puis journalise un combat manuel assiste">
        {!gm.activeCombat ? (
          <form className="stack-form" onSubmit={createCombat}>
            <fieldset className="checkbox-grid">
              <legend>Participants</legend>
              {gm.actors
                .filter((actor) => actor.isApproved)
                .map((actor) => (
                  <label key={actor.id} className="checkbox-chip">
                    <input
                      type="checkbox"
                      checked={combatActorIds.includes(actor.id)}
                      onChange={() => setCombatActorIds((current) => toggleItem(current, actor.id))}
                    />
                    <span>
                      {actor.name} Ã‚Â· {actor.actorType}
                    </span>
                  </label>
                ))}
            </fieldset>
            <button type="submit">Lancer le combat</button>
          </form>
        ) : (
          <div className="stack-layout">
            <div className="list-stack">
              {gm.activeCombat.participants.map((participant) => (
                <article className="list-row" key={participant.id}>
                  <div>
                    <strong>{participant.actor.name}</strong>
                    <p>
                      {participant.side} Ã‚Â· {participant.currentHp} PV Ã‚Â· {participant.status}
                    </p>
                  </div>
                </article>
              ))}
            </div>
            <form className="stack-form" onSubmit={submitCombatAction}>
              <div className="inline-form">
                <label>
                  Source
                  <select
                    value={actionForm.sourceParticipantId}
                    onChange={(event) =>
                      setActionForm((current) => ({ ...current, sourceParticipantId: event.target.value }))
                    }
                    required
                  >
                    <option value="">Selectionner</option>
                    {gm.activeCombat.participants.map((participant) => (
                      <option key={participant.id} value={participant.id}>
                        {participant.actor.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Cible
                  <select
                    value={actionForm.targetParticipantId}
                    onChange={(event) =>
                      setActionForm((current) => ({ ...current, targetParticipantId: event.target.value }))
                    }
                  >
                    <option value="">Aucune</option>
                    {gm.activeCombat.participants.map((participant) => (
                      <option key={participant.id} value={participant.id}>
                        {participant.actor.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="inline-form">
                <label>
                  Type
                  <select
                    value={actionForm.actionType}
                    onChange={(event) => setActionForm((current) => ({ ...current, actionType: event.target.value }))}
                  >
                    <option value="ATTACK">Attaque</option>
                    <option value="SPELL">Sort</option>
                    <option value="ITEM">Objet</option>
                    <option value="DEFEND">Defense</option>
                    <option value="MANUAL_ADJUST">Ajustement</option>
                    <option value="FLEE">Fuite</option>
                  </select>
                </label>
                <label>
                  Libelle
                  <input
                    type="text"
                    value={actionForm.actionLabel}
                    onChange={(event) => setActionForm((current) => ({ ...current, actionLabel: event.target.value }))}
                    required
                  />
                </label>
              </div>
              <div className="inline-form">
                <label>
                  Degats
                  <input
                    type="number"
                    value={actionForm.damageValue}
                    onChange={(event) => setActionForm((current) => ({ ...current, damageValue: event.target.value }))}
                  />
                </label>
                <label>
                  Soin
                  <input
                    type="number"
                    value={actionForm.healingValue}
                    onChange={(event) => setActionForm((current) => ({ ...current, healingValue: event.target.value }))}
                  />
                </label>
              </div>
              <label>
                Resultat
                <textarea
                  rows={2}
                  value={actionForm.resultText}
                  onChange={(event) => setActionForm((current) => ({ ...current, resultText: event.target.value }))}
                />
              </label>
              <div className="toolbar">
                <button type="submit">Ajouter l'action</button>
                <button className="button-ghost" type="button" onClick={() => void endCombat()}>
                  Clore le combat
                </button>
              </div>
            </form>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Recompenses" subtitle="Cree puis attribue au groupe ou a un personnage">
        <div className="two-column-grid">
          <form className="stack-form" onSubmit={createReward}>
            <label>
              Type
              <select
                value={rewardForm.rewardType}
                onChange={(event) => setRewardForm((current) => ({ ...current, rewardType: event.target.value }))}
              >
                <option value="XP">XP</option>
                <option value="ITEM">Objet</option>
                <option value="GOLD">Or</option>
                <option value="STORY">Narratif</option>
                <option value="CUSTOM">Libre</option>
              </select>
            </label>
            <label>
              Libelle
              <input
                type="text"
                value={rewardForm.label}
                onChange={(event) => setRewardForm((current) => ({ ...current, label: event.target.value }))}
                required
              />
            </label>
            <label>
              Description
              <textarea
                rows={2}
                value={rewardForm.description}
                onChange={(event) => setRewardForm((current) => ({ ...current, description: event.target.value }))}
              />
            </label>
            <label>
              Valeur numerique
              <input
                type="number"
                step="0.1"
                value={rewardForm.numericValue}
                onChange={(event) => setRewardForm((current) => ({ ...current, numericValue: event.target.value }))}
              />
            </label>
            <button type="submit">Creer la recompense</button>
          </form>

          <form className="stack-form" onSubmit={assignReward}>
            <label>
              Recompense
              <select
                value={assignmentForm.rewardId}
                onChange={(event) => setAssignmentForm((current) => ({ ...current, rewardId: event.target.value }))}
                required
              >
                <option value="">Selectionner</option>
                {gm.rewards.map((reward) => (
                  <option key={reward.id} value={reward.id}>
                    {reward.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Destinataire
              <select
                value={assignmentForm.actorId}
                onChange={(event) => setAssignmentForm((current) => ({ ...current, actorId: event.target.value }))}
              >
                <option value="">Groupe complet</option>
                {gm.actors.map((actor) => (
                  <option key={actor.id} value={actor.id}>
                    {actor.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Quantite
              <input
                type="number"
                step="0.1"
                value={assignmentForm.quantity}
                onChange={(event) => setAssignmentForm((current) => ({ ...current, quantity: event.target.value }))}
                required
              />
            </label>
            <button type="submit">Attribuer</button>
          </form>
        </div>
      </SectionCard>
    </div>
  );
}

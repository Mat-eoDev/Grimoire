import { API_URL } from "./api";

export type CampaignStreamEvent = {
  type: string;
  elementId?: string;
  posX?: number;
  posY?: number;
  scale?: number;
  actionRoll?: unknown;
  actionRollId?: string;
  name?: string;
  toUserId?: string;
  fromUserId?: string;
  message?: string;
};

type Listener = (event: CampaignStreamEvent) => void;

type Room = {
  source: EventSource;
  listeners: Set<Listener>;
};

const rooms = new Map<string, Room>();

/**
 * Abonnement partage au flux SSE d'une campagne.
 *
 * Chaque composant ouvrait sa propre EventSource : la vue joueur en avait deux
 * (scene et panneau d'echanges), soit une dizaine de connexions persistantes pour
 * une table de cinq joueurs, sur une instance unique. Ici une seule connexion est
 * ouverte par campagne et partagee entre tous les abonnes ; elle se ferme quand le
 * dernier se desabonne.
 *
 * Renvoie la fonction de desabonnement, a retourner directement depuis un useEffect.
 */
export function subscribeCampaignStream(campaignId: string, listener: Listener): () => void {
  let room = rooms.get(campaignId);

  if (!room) {
    const source = new EventSource(`${API_URL}/campaigns/${campaignId}/stream`, {
      withCredentials: true
    });
    const created: Room = { source, listeners: new Set() };

    source.onmessage = (event) => {
      let payload: CampaignStreamEvent;
      try {
        payload = JSON.parse(event.data as string) as CampaignStreamEvent;
      } catch {
        return;
      }
      // Copie defensive : un listener qui se desabonne pendant la diffusion ne doit
      // pas faire muter l'ensemble en cours de parcours.
      for (const current of [...created.listeners]) {
        try {
          current(payload);
        } catch {
          // Un abonne en erreur ne doit pas priver les autres de l'evenement.
        }
      }
    };

    rooms.set(campaignId, created);
    room = created;
  }

  room.listeners.add(listener);

  return () => {
    const current = rooms.get(campaignId);
    if (!current) return;

    current.listeners.delete(listener);

    if (current.listeners.size === 0) {
      current.source.close();
      rooms.delete(campaignId);
    }
  };
}

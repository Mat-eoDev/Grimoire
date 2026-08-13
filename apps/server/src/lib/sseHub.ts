import type { Response } from "express";

const rooms = new Map<string, Set<Response>>();

// Un commentaire SSE envoye regulierement sur chaque connexion ouverte. Sans trafic,
// les proxys (Render, Cloudflare) coupent une connexion inactive au bout de quelques
// dizaines de secondes : le client se reconnecte, mais les evenements emis pendant la
// coupure sont perdus. 25 s reste sous les seuils usuels.
const HEARTBEAT_MS = 25_000;

let heartbeat: NodeJS.Timeout | null = null;

function startHeartbeat() {
  if (heartbeat) return;

  heartbeat = setInterval(() => {
    for (const [campaignId, clients] of rooms) {
      for (const client of clients) {
        try {
          // Ligne de commentaire : ignoree par EventSource, suffisante pour garder
          // la connexion vivante.
          client.write(": ping\n\n");
        } catch {
          sseUnsubscribe(campaignId, client);
        }
      }
    }
  }, HEARTBEAT_MS);

  // Ne doit pas empecher le process de s'arreter.
  heartbeat.unref?.();
}

function stopHeartbeatIfIdle() {
  if (heartbeat && rooms.size === 0) {
    clearInterval(heartbeat);
    heartbeat = null;
  }
}

export function sseSubscribe(campaignId: string, res: Response): void {
  if (!rooms.has(campaignId)) rooms.set(campaignId, new Set());
  rooms.get(campaignId)!.add(res);
  startHeartbeat();
}

export function sseUnsubscribe(campaignId: string, res: Response): void {
  const room = rooms.get(campaignId);
  if (!room) return;
  room.delete(res);
  if (room.size === 0) rooms.delete(campaignId);
  stopHeartbeatIfIdle();
}

export function sseBroadcast(campaignId: string, data: object): void {
  const clients = rooms.get(campaignId);
  if (!clients?.size) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try {
      res.write(payload);
    } catch {
      sseUnsubscribe(campaignId, res);
    }
  }
}

/** Nombre de connexions ouvertes, par campagne — utile en supervision et en test. */
export function sseStats() {
  return {
    rooms: rooms.size,
    clients: [...rooms.values()].reduce((total, room) => total + room.size, 0)
  };
}

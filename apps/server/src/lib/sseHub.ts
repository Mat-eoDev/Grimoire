import type { Response } from "express";

const rooms = new Map<string, Set<Response>>();

export function sseSubscribe(campaignId: string, res: Response): void {
  if (!rooms.has(campaignId)) rooms.set(campaignId, new Set());
  rooms.get(campaignId)!.add(res);
}

export function sseUnsubscribe(campaignId: string, res: Response): void {
  const room = rooms.get(campaignId);
  if (!room) return;
  room.delete(res);
  if (room.size === 0) rooms.delete(campaignId);
}

export function sseBroadcast(campaignId: string, data: object): void {
  const clients = rooms.get(campaignId);
  if (!clients?.size) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch {}
  }
}

import type { Response } from "express";

type CampaignEventType =
  | "display.updated"
  | "scene.updated"
  | "combat.updated"
  | "player_status.updated"
  | "reward.assigned";

type CampaignEvent = {
  type: CampaignEventType;
  campaignId: string;
  payload?: Record<string, unknown>;
  at: string;
};

class CampaignEventHub {
  private channels = new Map<string, Set<Response>>();

  subscribe(campaignId: string, response: Response) {
    const listeners = this.channels.get(campaignId) ?? new Set<Response>();
    listeners.add(response);
    this.channels.set(campaignId, listeners);

    response.write(
      `event: connected\ndata: ${JSON.stringify({
        type: "connected",
        campaignId,
        at: new Date().toISOString()
      })}\n\n`
    );

    const heartbeat = setInterval(() => {
      response.write(`event: ping\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);
    }, 30000);

    response.on("close", () => {
      clearInterval(heartbeat);
      listeners.delete(response);

      if (listeners.size === 0) {
        this.channels.delete(campaignId);
      }
    });
  }

  publish(campaignId: string, type: CampaignEventType, payload?: Record<string, unknown>) {
    const listeners = this.channels.get(campaignId);

    if (!listeners || listeners.size === 0) {
      return;
    }

    const event: CampaignEvent = {
      type,
      campaignId,
      payload,
      at: new Date().toISOString()
    };

    for (const response of listeners) {
      response.write(`event: ${type}\ndata: ${JSON.stringify(event)}\n\n`);
    }
  }
}

export const campaignEventHub = new CampaignEventHub();


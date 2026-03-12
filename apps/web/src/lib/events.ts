import { buildEventUrl } from "./api";

const CAMPAIGN_EVENT_NAMES = [
  "display.updated",
  "scene.updated",
  "combat.updated",
  "player_status.updated",
  "reward.assigned"
];

export function subscribeToCampaign(campaignId: string, onEvent: () => void, onError?: () => void) {
  const eventSource = new EventSource(buildEventUrl(campaignId), {
    withCredentials: true
  });

  for (const eventName of CAMPAIGN_EVENT_NAMES) {
    eventSource.addEventListener(eventName, () => {
      onEvent();
    });
  }

  eventSource.onerror = () => {
    onError?.();
  };

  return () => {
    eventSource.close();
  };
}


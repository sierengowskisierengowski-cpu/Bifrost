import { createPersistentStore } from "./persistent-store";

export type AlertPlatform = "govee" | "hue" | "lifx" | "homeAssistant" | "webhook";

export const PLATFORM_LABELS: Record<AlertPlatform, string> = {
  govee: "Govee",
  hue: "Philips Hue",
  lifx: "LIFX",
  homeAssistant: "Home Assistant",
  webhook: "Webhook",
};

export interface Dispatch {
  id: string;
  timestamp: string;
  platform: AlertPlatform;
  message: string;
  ok: boolean;
  note: string;
}

export interface IntegrationsState {
  govee: { apiKey: string };
  hue: { bridgeIp: string; apiKey: string };
  lifx: { apiKey: string };
  homeAssistant: { url: string; token: string };
  webhook: { url: string };
  active: AlertPlatform | null;
  dispatches: Dispatch[];
}

const DEFAULTS: IntegrationsState = {
  govee: { apiKey: "" },
  hue: { bridgeIp: "", apiKey: "" },
  lifx: { apiKey: "" },
  homeAssistant: { url: "", token: "" },
  webhook: { url: "" },
  active: null,
  dispatches: [],
};

const store = createPersistentStore<IntegrationsState>("bifrost.integrations", DEFAULTS);

export const useIntegrations = store.use;
export const getIntegrations = store.get;

export function saveIntegration(patch: Partial<IntegrationsState>) {
  store.set(patch);
}

export function setActivePlatform(p: AlertPlatform | null) {
  store.set({ active: p });
}

export function isPlatformConfigured(s: IntegrationsState, p: AlertPlatform): boolean {
  switch (p) {
    case "govee":
      return !!s.govee.apiKey.trim();
    case "hue":
      return !!s.hue.bridgeIp.trim() && !!s.hue.apiKey.trim();
    case "lifx":
      return !!s.lifx.apiKey.trim();
    case "homeAssistant":
      return !!s.homeAssistant.url.trim() && !!s.homeAssistant.token.trim();
    case "webhook":
      return !!s.webhook.url.trim();
  }
}

export function addDispatch(d: Omit<Dispatch, "id" | "timestamp">) {
  const cur = store.get();
  const entry: Dispatch = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...d,
  };
  store.set({ dispatches: [entry, ...cur.dispatches].slice(0, 50) });
}

export function clearDispatches() {
  store.set({ dispatches: [] });
}

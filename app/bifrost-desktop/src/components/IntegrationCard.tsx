import { useState } from "react";
import { Siren, Send, Save, Check, CheckCircle2 } from "lucide-react";
import { useConnection } from "@/lib/api";
import {
  saveIntegration,
  setActivePlatform,
  addDispatch,
  isPlatformConfigured,
  PLATFORM_LABELS,
  type AlertPlatform,
  type IntegrationsState,
} from "@/lib/integrations";

export type FieldDef = { key: string; label: string; type?: string; placeholder?: string };

export const PLATFORM_FIELDS: { key: AlertPlatform; fields: FieldDef[] }[] = [
  { key: "govee", fields: [{ key: "apiKey", label: "API Key", placeholder: "Govee Developer API key" }] },
  {
    key: "hue",
    fields: [
      { key: "bridgeIp", label: "Bridge IP", placeholder: "192.168.1.x" },
      { key: "apiKey", label: "API Key", placeholder: "Hue application key" },
    ],
  },
  { key: "lifx", fields: [{ key: "apiKey", label: "API Token", placeholder: "LIFX HTTP token" }] },
  {
    key: "homeAssistant",
    fields: [
      { key: "url", label: "Base URL", placeholder: "http://homeassistant.local:8123" },
      { key: "token", label: "Long-Lived Access Token", placeholder: "HA token" },
    ],
  },
  { key: "webhook", fields: [{ key: "url", label: "Webhook URL", placeholder: "https://…" }] },
];

const inputCls =
  "bg-black/40 border border-border rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-[#E040FB] w-full";

export function IntegrationCard({
  platform,
  fields,
  ints,
  showActive = true,
}: {
  platform: AlertPlatform;
  fields: FieldDef[];
  ints: IntegrationsState;
  showActive?: boolean;
}) {
  const conf = ints[platform] as Record<string, string>;
  const [draft, setDraft] = useState<Record<string, string>>({ ...conf });
  const [saved, setSaved] = useState(false);
  const [testMsg, setTestMsg] = useState("");

  const conn = useConnection();
  const live = conn.status === "connected";
  const isActive = ints.active === platform;
  const configured = isPlatformConfigured(ints, platform);
  const draftConfigured = fields.every((f) => (draft[f.key] ?? "").trim().length > 0);

  const save = () => {
    saveIntegration({ [platform]: draft } as Partial<IntegrationsState>);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  const test = () => {
    saveIntegration({ [platform]: draft } as Partial<IntegrationsState>);
    const label = PLATFORM_LABELS[platform];
    addDispatch({
      platform,
      message: `Test alert — CRITICAL threat simulation routed to ${label}`,
      ok: true,
      note: live ? "Sent via Guardian agent" : "Simulated — Guardian agent offline",
    });
    setTestMsg(live ? "Test alert sent via agent" : "Test alert simulated (agent offline)");
    setTimeout(() => setTestMsg(""), 2600);
  };

  return (
    <div className={`glass-panel rounded-xl p-5 ${isActive ? "rainbow-border" : ""}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Siren className="w-4 h-4 text-[#E040FB]" />
          <h3 className="font-semibold">{PLATFORM_LABELS[platform]}</h3>
        </div>
        <span
          className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md border ${
            configured
              ? "text-[#4ECDC4] border-[#4ECDC4]/40 bg-[#4ECDC4]/10"
              : "text-muted-foreground border-border bg-black/30"
          }`}
        >
          {configured ? "Configured" : "Not set"}
        </span>
      </div>

      <div className="space-y-3">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="text-xs text-muted-foreground">{f.label}</label>
            <input
              type={f.type ?? "text"}
              value={draft[f.key] ?? ""}
              placeholder={f.placeholder}
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
              className={inputCls}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-4">
        <button
          onClick={save}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold bg-white/5 border border-border hover:bg-white/10 transition-colors"
        >
          {saved ? <Check className="w-3.5 h-3.5 text-[#4ECDC4]" /> : <Save className="w-3.5 h-3.5" />}
          {saved ? "Saved" : "Save"}
        </button>
        <button
          onClick={test}
          disabled={!draftConfigured}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold bg-white/5 border border-border hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Send className="w-3.5 h-3.5" /> Test
        </button>
        {showActive && (
          <button
            onClick={() => setActivePlatform(isActive ? null : platform)}
            disabled={!configured && !isActive}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
              isActive ? "rainbow-bg text-white" : "bg-white/5 border border-border hover:bg-white/10"
            }`}
          >
            {isActive ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
            {isActive ? "Active route" : "Set active"}
          </button>
        )}
      </div>
      {testMsg && <div className="mt-2 text-[11px] font-mono text-[#4ECDC4]">{testMsg}</div>}
    </div>
  );
}

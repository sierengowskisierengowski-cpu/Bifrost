import { useEffect, useState } from "react";
import { ShieldCheck, KeyRound, RotateCcw, Server, MonitorCog, Cpu } from "lucide-react";
import { useGuardian, useSettings, saveSettings, guardian, saveGuardianConfig, saveGuardianBehavior } from "@/lib/api";
import { PageHeader, Toggle } from "@/components/shared";
import { setPassword, setSetupComplete, passwordStrength } from "@/lib/app-state";

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="glass-panel rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[#E040FB]">{icon}</span>
        <h3 className="font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

const inputCls = "bg-black/40 border border-border rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-[#E040FB] w-full";
const toThresholdPct = (value: number) => (value <= 1 ? Math.round(value * 100) : Math.round(value));
const toThresholdValue = (value: number) => (value > 1 ? value / 100 : value);

export default function Settings() {
  const { config } = useGuardian();
  const s = useSettings();
  const [appSettings, setAppSettings] = useState(() => ({ ...s }));
  const [appSaveState, setAppSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [behavior, setBehavior] = useState(() => ({
    learningMode: config.learningMode,
    dryRun: config.dryRun,
    autonomous: config.autonomous,
    confidenceThreshold: toThresholdPct(config.confidenceThreshold),
  }));

  useEffect(() => {
    setBehavior({
      learningMode: config.learningMode,
      dryRun: config.dryRun,
      autonomous: config.autonomous,
      confidenceThreshold: toThresholdPct(config.confidenceThreshold),
    });
  }, [config.autonomous, config.confidenceThreshold, config.dryRun, config.learningMode]);

  useEffect(() => {
    setAppSettings({ ...s });
  }, [
    s.guardianHost,
    s.dashboardPort,
    s.ingestPort,
    s.refreshIntervalMs,
    s.screensaverMs,
    s.fontScale,
    s.sessionTimeoutMin,
    s.desktopNotifications,
  ]);

  useEffect(() => {
    saveGuardianBehavior({
      learningMode: behavior.learningMode,
      dryRun: behavior.dryRun,
      autonomous: behavior.autonomous,
      confidenceThreshold: toThresholdValue(behavior.confidenceThreshold),
    });
  }, [behavior.autonomous, behavior.confidenceThreshold, behavior.dryRun, behavior.learningMode]);

  const changePw = async () => {
    if (pw.length < 4 || pw !== pw2) {
      setPwMsg("Passwords must match and be at least 4 characters.");
      return;
    }
    await setPassword(pw);
    setPw("");
    setPw2("");
    setPwMsg("Password updated.");
  };

  const strength = passwordStrength(pw);
  const currentThreshold = toThresholdPct(config.confidenceThreshold);
  const hasBehaviorChanges =
    behavior.learningMode !== config.learningMode ||
    behavior.dryRun !== config.dryRun ||
    behavior.autonomous !== config.autonomous ||
    behavior.confidenceThreshold !== currentThreshold;
  const hasAppChanges =
    appSettings.guardianHost !== s.guardianHost ||
    appSettings.dashboardPort !== s.dashboardPort ||
    appSettings.ingestPort !== s.ingestPort ||
    appSettings.refreshIntervalMs !== s.refreshIntervalMs ||
    appSettings.screensaverMs !== s.screensaverMs ||
    appSettings.fontScale !== s.fontScale ||
    appSettings.sessionTimeoutMin !== s.sessionTimeoutMin ||
    appSettings.desktopNotifications !== s.desktopNotifications;

  const saveAppSettings = () => {
    setAppSaveState("saving");
    try {
      saveSettings(appSettings);
      setAppSaveState("saved");
    } catch {
      setAppSaveState("error");
    }
  };

  const saveBehavior = async () => {
    setSaveState("saving");
    try {
      await saveGuardianConfig({
        learningMode: behavior.learningMode,
        dryRun: behavior.dryRun,
        autonomous: behavior.autonomous,
        confidenceThreshold: toThresholdValue(behavior.confidenceThreshold),
      });
      setSaveState("saved");
      await guardian.refresh();
    } catch {
      setSaveState("error");
    }
  };

  return (
    <div>
      <PageHeader
        title="Settings"
        desc="Tune the guardian and the dashboard"
        right={(
          <div className="flex items-center gap-3">
            <button
              onClick={saveAppSettings}
              disabled={!hasAppChanges || appSaveState === "saving"}
              className="rounded-lg px-4 py-2 text-xs font-semibold rainbow-bg text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {appSaveState === "saving" ? "Saving..." : "Save settings"}
            </button>
            {appSaveState === "saved" && <span className="text-[11px] font-mono text-[#4ECDC4]">Saved.</span>}
            {appSaveState === "error" && <span className="text-[11px] font-mono text-[#FF6B35]">Save failed.</span>}
          </div>
        )}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card icon={<ShieldCheck className="w-4 h-4" />} title="Guardian Behavior">
          <div className="space-y-4">
            <Toggle checked={behavior.learningMode} onChange={(v) => { setBehavior((prev) => ({ ...prev, learningMode: v })); setSaveState("idle"); }} label="Learning Mode" accent="#9D4EDD" />
            <Toggle checked={behavior.dryRun} onChange={(v) => { setBehavior((prev) => ({ ...prev, dryRun: v })); setSaveState("idle"); }} label="Dry Run (observe, do not enforce)" accent="#FFD166" />
            <Toggle checked={behavior.autonomous} onChange={(v) => { setBehavior((prev) => ({ ...prev, autonomous: v })); setSaveState("idle"); }} label="Autonomous Mode" accent="#E040FB" />
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-muted-foreground">Confidence threshold</span>
                <span className="font-mono">{behavior.confidenceThreshold}%</span>
              </div>
              <input
                type="range" min={50} max={99} value={behavior.confidenceThreshold}
                onChange={(e) => {
                  setBehavior((prev) => ({ ...prev, confidenceThreshold: Number(e.target.value) }));
                  setSaveState("idle");
                }}
                className="w-full accent-[#E040FB]"
              />
            </div>
            {behavior.autonomous && !behavior.dryRun && (
              <div className="text-[11px] text-[#FF6B35] font-mono">⚠ Autonomous enforcement is active. Actions are taken without approval.</div>
            )}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={saveBehavior}
                disabled={!hasBehaviorChanges || saveState === "saving"}
                className="rounded-lg px-4 py-2 text-xs font-semibold rainbow-bg text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saveState === "saving" ? "Saving..." : "Save guardian settings"}
              </button>
              {saveState === "saved" && <span className="text-[11px] font-mono text-[#4ECDC4]">Saved.</span>}
              {saveState === "error" && <span className="text-[11px] font-mono text-[#FF6B35]">Save failed.</span>}
            </div>
          </div>
        </Card>

        <Card icon={<Server className="w-4 h-4" />} title="Guardian Connection">
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Host</label>
              <input
                value={appSettings.guardianHost}
                onChange={(e) => { setAppSettings((prev) => ({ ...prev, guardianHost: e.target.value })); setAppSaveState("idle"); }}
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Dashboard port</label>
                <input
                  type="number"
                  value={appSettings.dashboardPort}
                  onChange={(e) => { setAppSettings((prev) => ({ ...prev, dashboardPort: Number(e.target.value) })); setAppSaveState("idle"); }}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Ingest port</label>
                <input
                  type="number"
                  value={appSettings.ingestPort}
                  onChange={(e) => { setAppSettings((prev) => ({ ...prev, ingestPort: Number(e.target.value) })); setAppSaveState("idle"); }}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Refresh interval (ms)</label>
              <input
                type="number"
                value={appSettings.refreshIntervalMs}
                onChange={(e) => { setAppSettings((prev) => ({ ...prev, refreshIntervalMs: Number(e.target.value) })); setAppSaveState("idle"); }}
                className={inputCls}
              />
            </div>
          </div>
        </Card>

        <Card icon={<MonitorCog className="w-4 h-4" />} title="Dashboard Preferences">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-muted-foreground">Screensaver timeout (minutes)</span>
                <span className="font-mono">{Math.round(appSettings.screensaverMs / 60000)}</span>
              </div>
              <input
                type="range"
                min={1}
                max={30}
                value={Math.round(appSettings.screensaverMs / 60000)}
                onChange={(e) => { setAppSettings((prev) => ({ ...prev, screensaverMs: Number(e.target.value) * 60000 })); setAppSaveState("idle"); }}
                className="w-full accent-[#E040FB]"
              />
            </div>
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-muted-foreground">Session timeout (minutes)</span>
                <span className="font-mono">{appSettings.sessionTimeoutMin}</span>
              </div>
              <input
                type="range"
                min={5}
                max={120}
                step={5}
                value={appSettings.sessionTimeoutMin}
                onChange={(e) => { setAppSettings((prev) => ({ ...prev, sessionTimeoutMin: Number(e.target.value) })); setAppSaveState("idle"); }}
                className="w-full accent-[#E040FB]"
              />
            </div>
            <Toggle
              checked={appSettings.desktopNotifications}
              onChange={(v) => { setAppSettings((prev) => ({ ...prev, desktopNotifications: v })); setAppSaveState("idle"); }}
              label="Desktop notifications"
              accent="#4ECDC4"
            />
          </div>
        </Card>

        <Card icon={<KeyRound className="w-4 h-4" />} title="Security">
          <div className="space-y-3">
            <input type="password" placeholder="New password" value={pw} onChange={(e) => { setPw(e.target.value); setPwMsg(""); }} className={inputCls} />
            {pw && (
              <div className="flex gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-1 flex-1 rounded-full" style={{ background: i < strength.score ? ["#FF2D2D", "#FF6B35", "#FFD166", "#4ECDC4"][strength.score - 1] : "rgba(255,255,255,0.1)" }} />
                ))}
              </div>
            )}
            <input type="password" placeholder="Confirm password" value={pw2} onChange={(e) => { setPw2(e.target.value); setPwMsg(""); }} className={inputCls} />
            <button onClick={changePw} className="rounded-lg py-2 text-sm font-semibold rainbow-bg text-white w-full">Update password</button>
            {pwMsg && <div className="text-[11px] font-mono text-muted-foreground">{pwMsg}</div>}

            <div className="pt-3 border-t border-border/40">
              <button
                onClick={() => { setSetupComplete(false); location.reload(); }}
                className="flex items-center gap-2 text-xs text-[#FF6B35] hover:text-[#FF2D2D]"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Re-run setup wizard
              </button>
            </div>
          </div>
        </Card>

        <Card icon={<Cpu className="w-4 h-4" />} title="System">
          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <Info k="Hardware tier" v={config.hardwareTier} />
            <Info k="Models loaded" v={String(config.modelsLoaded.length)} />
            <Info k="Database" v={config.databasePath} />
            <Info k="Cowrie log" v={config.cowrieLogPath} />
            <Info k="Ingest token" v={config.tokens.ingest ? "set" : "unset"} />
            <Info k="Dashboard token" v={config.tokens.dashboard ? "set" : "unset"} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="truncate text-foreground/90" title={v}>{v}</div>
    </div>
  );
}

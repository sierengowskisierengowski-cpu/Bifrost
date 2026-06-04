import { useEffect, useState } from "react";
import { ShieldCheck, KeyRound, RotateCcw, Server, MonitorCog, Cpu, Download, TerminalSquare, Siren, ScanFace } from "lucide-react";
import { useGuardian, useSettings, saveSettings, guardian } from "@/lib/api";
import { PageHeader, Toggle } from "@/components/shared";
import { IntegrationCard, PLATFORM_FIELDS } from "@/components/IntegrationCard";
import { useIntegrations } from "@/lib/integrations";
import { setPassword, setSetupComplete, passwordStrength } from "@/lib/app-state";
import {
  platformAuthenticatorAvailable,
  biometricEnrolled,
  enrollBiometric,
  disableBiometric,
} from "@/lib/biometric";

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

export default function Settings() {
  const { config } = useGuardian();
  const s = useSettings();
  const ints = useIntegrations();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwMsg, setPwMsg] = useState("");

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
  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-app.replit.app";

  return (
    <div>
      <PageHeader title="Settings" desc="Tune the guardian and the dashboard" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card icon={<ShieldCheck className="w-4 h-4" />} title="Guardian Behavior">
          <div className="space-y-4">
            <Toggle checked={config.learningMode} onChange={(v) => guardian.patchConfig({ learningMode: v })} label="Learning Mode" accent="#9D4EDD" />
            <Toggle checked={config.dryRun} onChange={(v) => guardian.patchConfig({ dryRun: v })} label="Dry Run (observe, do not enforce)" accent="#FFD166" />
            <Toggle checked={config.autonomous} onChange={(v) => guardian.patchConfig({ autonomous: v })} label="Autonomous Mode" accent="#E040FB" />
            <div className="rounded-lg border border-border/60 bg-black/30 p-3">
              <Toggle
                checked={s.persistGuardianState}
                onChange={(v) => saveSettings({ persistGuardianState: v })}
                label="Persist guardian state across restarts"
                accent="#4ECDC4"
              />
              <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                {s.persistGuardianState
                  ? "Learned baselines, blocklists and config survive restarts (saved to disk)."
                  : "Session-only — the guardian forgets everything when it stops, starting clean each run."}
              </p>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-muted-foreground">Confidence threshold</span>
                <span className="font-mono">{config.confidenceThreshold}%</span>
              </div>
              <input
                type="range" min={50} max={99} value={config.confidenceThreshold}
                onChange={(e) => guardian.patchConfig({ confidenceThreshold: Number(e.target.value) })}
                className="w-full accent-[#E040FB]"
              />
            </div>
            {config.autonomous && !config.dryRun && (
              <div className="text-[11px] text-[#FF6B35] font-mono">⚠ Autonomous enforcement is active. Actions are taken without approval.</div>
            )}
          </div>
        </Card>

        <Card icon={<Server className="w-4 h-4" />} title="Guardian Connection">
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Host</label>
              <input value={s.guardianHost} onChange={(e) => saveSettings({ guardianHost: e.target.value })} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Dashboard port</label>
                <input type="number" value={s.dashboardPort} onChange={(e) => saveSettings({ dashboardPort: Number(e.target.value) })} className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Ingest port</label>
                <input type="number" value={s.ingestPort} onChange={(e) => saveSettings({ ingestPort: Number(e.target.value) })} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Refresh interval (ms)</label>
              <input type="number" value={s.refreshIntervalMs} onChange={(e) => saveSettings({ refreshIntervalMs: Number(e.target.value) })} className={inputCls} />
            </div>
          </div>
        </Card>

        <Card icon={<MonitorCog className="w-4 h-4" />} title="Dashboard Preferences">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-muted-foreground">Screensaver timeout (minutes)</span>
                <span className="font-mono">{Math.round(s.screensaverMs / 60000)}</span>
              </div>
              <input type="range" min={1} max={30} value={Math.round(s.screensaverMs / 60000)}
                onChange={(e) => saveSettings({ screensaverMs: Number(e.target.value) * 60000 })} className="w-full accent-[#E040FB]" />
            </div>
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-muted-foreground">Session timeout (minutes)</span>
                <span className="font-mono">{s.sessionTimeoutMin}</span>
              </div>
              <input type="range" min={5} max={120} step={5} value={s.sessionTimeoutMin}
                onChange={(e) => saveSettings({ sessionTimeoutMin: Number(e.target.value) })} className="w-full accent-[#E040FB]" />
            </div>
            <Toggle checked={s.desktopNotifications} onChange={(v) => saveSettings({ desktopNotifications: v })} label="Desktop notifications" accent="#4ECDC4" />
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

            <BiometricSetting />

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

        <div className="lg:col-span-2">
          <div className="glass-panel rounded-xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[#E040FB]"><Siren className="w-4 h-4" /></span>
              <h3 className="font-semibold">Gjallarhorn — Light & Alert Integrations</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              Connect smart lights and webhooks so a critical threat can flash your room red. Enter
              credentials and send a test alert. Pick one as the active route to arm alerting.
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {PLATFORM_FIELDS.map((p) => (
                <IntegrationCard key={p.key} platform={p.key} fields={p.fields} ints={ints} />
              ))}
            </div>
          </div>
        </div>

        <Card icon={<Download className="w-4 h-4" />} title="Run on your machine">
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground leading-relaxed">
              This dashboard runs on a <span className="text-foreground">simulated</span> bridge in the
              browser. Download the Bifrost Guardian to watch the <span className="text-foreground">real</span> machine —
              live CPU/RAM/disk and real SSH intrusion attempts. No accounts, no cloud; it only binds to{" "}
              <span className="font-mono text-[#4ECDC4]">127.0.0.1</span>.
            </p>
            <a
              href="/api/download/bifrost-agent"
              download
              data-testid="link-download-bifrost-agent"
              className="flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold rainbow-bg text-white w-full"
            >
              <Download className="w-4 h-4" /> Download Bifrost Guardian (.tar.gz)
            </a>
            <div className="rounded-lg bg-black/40 border border-border/60 p-3 font-mono text-[11px] leading-relaxed text-foreground/80">
              <div className="text-muted-foreground mb-1"># extract, then:</div>
              <div><span className="text-[#4ECDC4]">tar</span> -xzf bifrost-agent.tar.gz</div>
              <div><span className="text-[#4ECDC4]">cd</span> bifrost-agent && <span className="text-[#4ECDC4]">bash</span> install.sh</div>
              <div><span className="text-[#E040FB]">bifrost</span> guardian start</div>
              <div><span className="text-[#E040FB]">bifrost</span> watch</div>
              <div className="text-muted-foreground mt-2 mb-1"># to feed THIS dashboard real data:</div>
              <div className="break-all"><span className="text-[#E040FB]">bifrost</span> trust {origin}</div>
            </div>
            <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
              <TerminalSquare className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#E040FB]" />
              <span>
                Running <span className="font-mono text-foreground">bifrost</span> (or{" "}
                <span className="font-mono text-foreground">BIFROST</span>) opens a hidden console: live
                animated bridge, real attacker list, and a <span className="text-foreground">Heimdall</span>{" "}
                power-mode that can block IPs at the firewall. Linux &amp; macOS · Windows installer included.
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function BiometricSetting() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [enrolled, setEnrolled] = useState(() => biometricEnrolled());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let live = true;
    platformAuthenticatorAvailable().then((ok) => {
      if (live) setAvailable(ok);
    });
    return () => {
      live = false;
    };
  }, []);

  const toggle = async (on: boolean) => {
    setMsg("");
    if (!on) {
      disableBiometric();
      setEnrolled(false);
      setMsg("Biometric unlock removed from this device.");
      return;
    }
    setBusy(true);
    const res = await enrollBiometric();
    setBusy(false);
    if (res.ok) {
      setEnrolled(true);
      setMsg("Enrolled — you can now unlock with fingerprint or face.");
    } else {
      setMsg(res.error || "Could not enroll.");
    }
  };

  return (
    <div className="pt-3 border-t border-border/40">
      <div className="flex items-center gap-2 mb-2">
        <ScanFace className="w-3.5 h-3.5 text-[#E040FB]" />
        <span className="text-xs font-semibold">Biometric unlock</span>
      </div>
      {available === null && <p className="text-[11px] text-muted-foreground">Checking this device…</p>}
      {available === false && (
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          No fingerprint or face sensor is available to this browser. Use Bifrost on a device with
          Touch ID, Windows Hello, or Android biometrics to enable this.
        </p>
      )}
      {available === true && (
        <>
          <Toggle
            checked={enrolled}
            onChange={(v) => void toggle(v)}
            label={busy ? "Waiting for sensor…" : "Unlock with fingerprint / face"}
            accent="#E040FB"
          />
          <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
            Your device decides fingerprint vs. face based on what you've enrolled in the OS. This is a
            local convenience gate stored only on this device — your password still works as a fallback.
          </p>
          {msg && <div className="text-[11px] font-mono text-muted-foreground mt-2">{msg}</div>}
        </>
      )}
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

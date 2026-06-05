import { useEffect, useState } from "react";
import { ShieldCheck, KeyRound, RotateCcw, RotateCw, Server, MonitorCog, Cpu, Fingerprint, ScanFace, Sparkles, Power, Activity, Loader2, Terminal, Copy, Check } from "lucide-react";
import { useGuardian, useSettings, saveSettings, guardian, useConnection } from "@/lib/api";
import { PageHeader, Toggle, PasswordField, PasswordMeter } from "@/components/shared";
import { setPassword, setSetupComplete, verifyPassword, evaluatePassword } from "@/lib/app-state";
import { isTauri, guardianStatus, startGuardian, stopGuardian, openExternal } from "@/lib/tauri";
import {
  getAvailability,
  refreshFingerprintEnrollment,
  isEnrolled,
  markEnrolled,
  HOWDY_DOCS_URL,
  FACE_SETUP_COMMAND,
  FINGERPRINT_SETUP_COMMAND,
  type Availability,
  type Modality,
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
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState(false);

  const newEval = evaluatePassword(pw);
  const canChangePw = cur.length > 0 && newEval.acceptable && pw === pw2;

  const changePw = async () => {
    setPwMsg("");
    setPwErr(false);
    if (!(await verifyPassword(cur))) {
      setPwMsg("Current password is incorrect.");
      setPwErr(true);
      return;
    }
    if (!newEval.acceptable) {
      setPwMsg("New password must be Strong or Very Strong.");
      setPwErr(true);
      return;
    }
    if (pw !== pw2) {
      setPwMsg("New passwords do not match.");
      setPwErr(true);
      return;
    }
    await setPassword(pw);
    setCur("");
    setPw("");
    setPw2("");
    setPwMsg("Password updated.");
  };

  return (
    <div>
      <PageHeader title="Settings" desc="Tune the guardian and the dashboard" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card icon={<Sparkles className="w-4 h-4" />} title="Personalization">
          <div className="space-y-4">
            <Toggle
              checked={s.greetingEnabled}
              onChange={(v) => saveSettings({ greetingEnabled: v })}
              label="Personalized greeting"
              accent="#E040FB"
            />
            <div>
              <label className="text-xs text-muted-foreground">Your name</label>
              <input
                value={s.greetingName}
                onChange={(e) => saveSettings({ greetingName: e.target.value })}
                placeholder="Leave blank to disable"
                data-testid="input-greeting-name"
                className={inputCls}
              />
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {s.greetingEnabled && s.greetingName.trim()
                ? "Heimdall will greet you by name on the Overview and Heimdall Speaks pages, with the tone shifting by time of day and threat level."
                : "When on and a name is set, Heimdall greets you by name across the bridge. Off by default — the app behaves exactly as it does now."}
            </p>
          </div>
        </Card>

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
              <div className="text-xs text-muted-foreground mb-2">Screensaver style</div>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: "rainbow", title: "Rainbow Bridge", desc: "Calm aurora & live stats" },
                  { id: "ops", title: "Ops Center", desc: "Live command-center stream" },
                ] as const).map((opt) => {
                  const active = s.screensaverStyle === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => saveSettings({ screensaverStyle: opt.id })}
                      data-testid={`button-screensaver-${opt.id}`}
                      className={`text-left rounded-lg border p-3 transition-all ${
                        active
                          ? "border-[#E040FB] bg-[#E040FB]/10"
                          : "border-border/60 bg-black/30 hover:border-border"
                      }`}
                    >
                      <div className={`text-sm font-semibold ${active ? "rainbow-text" : "text-foreground"}`}>{opt.title}</div>
                      <div className="text-[10px] text-muted-foreground mt-1 leading-snug">{opt.desc}</div>
                    </button>
                  );
                })}
              </div>
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
            <div className="text-xs font-semibold mb-1">Change password</div>
            <label className="text-[11px] text-muted-foreground">Current password</label>
            <PasswordField value={cur} onChange={(v) => { setCur(v); setPwMsg(""); }} placeholder="Enter current password" testid="input-current-password" />
            <label className="text-[11px] text-muted-foreground">New password</label>
            <PasswordField value={pw} onChange={(v) => { setPw(v); setPwMsg(""); }} placeholder="New password" testid="input-new-password" />
            <PasswordMeter pw={pw} />
            <label className="text-[11px] text-muted-foreground">Confirm new password</label>
            <PasswordField value={pw2} onChange={(v) => { setPw2(v); setPwMsg(""); }} placeholder="Confirm new password" testid="input-confirm-password" />
            <button
              onClick={changePw}
              disabled={!canChangePw}
              data-testid="button-change-password"
              className="rounded-lg py-2 text-sm font-semibold rainbow-bg text-white w-full disabled:opacity-40"
            >
              Update password
            </button>
            {pwMsg && (
              <div className={`text-[11px] font-mono ${pwErr ? "text-[#FF6B35]" : "text-[#4ECDC4]"}`}>{pwMsg}</div>
            )}

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

        <GuardianStatusCard />
      </div>
    </div>
  );
}

function fmtUptime(sec: number): string {
  if (sec <= 0) return "0s";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (!d) parts.push(`${s}s`);
  return parts.join(" ");
}

function GuardianStatusCard() {
  const conn = useConnection();
  const native = isTauri();
  const [nativeRunning, setNativeRunning] = useState<boolean | null>(null);
  const [restarting, setRestarting] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  // Native: poll the real guardian process; preview: derive from connection.
  useEffect(() => {
    if (!native) return;
    let live = true;
    const poll = async () => {
      const ok = await guardianStatus();
      if (live) setNativeRunning(!!ok);
    };
    poll();
    const id = setInterval(poll, 4000);
    return () => { live = false; clearInterval(id); };
  }, [native]);

  const running = native ? !!nativeRunning : conn.status === "connected";

  // Track an uptime origin locally, resetting whenever the guardian (re)starts.
  useEffect(() => {
    if (running && startedAt === null) setStartedAt(Date.now());
    if (!running && startedAt !== null) setStartedAt(null);
  }, [running, startedAt]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const uptimeSec = running && startedAt !== null ? (now - startedAt) / 1000 : 0;

  const restart = async () => {
    setRestarting(true);
    try {
      if (native) {
        await stopGuardian();
        await new Promise((r) => setTimeout(r, 600));
        await startGuardian();
        const ok = await guardianStatus();
        setNativeRunning(!!ok);
      }
      setStartedAt(Date.now());
    } finally {
      setRestarting(false);
    }
  };

  return (
    <Card icon={<Activity className="w-4 h-4" />} title="Guardian Status">
      <div className="space-y-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Running</span>
          <span
            data-testid="text-guardian-running"
            className={`flex items-center gap-2 font-semibold ${running ? "text-[#4ECDC4]" : "text-[#FF6B35]"}`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${running ? "bg-[#4ECDC4] animate-pulse" : "bg-[#FF6B35]"}`} />
            {running ? "Yes" : "No"}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Uptime (this session)</span>
          <span data-testid="text-guardian-uptime" className="font-mono">
            {running ? fmtUptime(uptimeSec) : "—"}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Source</span>
          <span className="font-mono text-xs text-muted-foreground">
            {native ? "Local guardian process" : "Simulated (preview)"}
          </span>
        </div>

        <button
          onClick={restart}
          disabled={restarting}
          data-testid="button-restart-guardian"
          className="flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold rainbow-bg text-white w-full disabled:opacity-50"
        >
          {restarting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
          {restarting ? "Restarting…" : "Restart Guardian"}
        </button>

        {!native && (
          <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
            <Power className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#E040FB]" />
            <span>
              In the packaged desktop app this controls the real local guardian process. In the
              browser preview it reflects the simulated bridge.
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}

function CopyCommand({ command, testid }: { command: string; testid: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — the command is still selectable */
    }
  };
  return (
    <div className="flex items-center gap-2 rounded-md border border-white/10 bg-black/40 px-2 py-1.5">
      <Terminal className="w-3 h-3 text-[#4ECDC4] shrink-0" />
      <code className="flex-1 text-[11px] font-mono text-[#4ECDC4] select-all truncate">{command}</code>
      <button
        onClick={copy}
        data-testid={`button-copy-${testid}`}
        className="flex items-center gap-1 text-[10px] text-[#E040FB] hover:text-[#ff66ff] shrink-0"
      >
        {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
      </button>
    </div>
  );
}

function BioRow({
  icon,
  title,
  available,
  unavailableNote,
  enrolled,
  enabled,
  busy,
  onEnroll,
  onToggle,
  testid,
  extra,
  manualCommand,
  manualNote,
  onMarkEnrolled,
  onCheck,
}: {
  icon: React.ReactNode;
  title: string;
  available: boolean;
  unavailableNote: string;
  enrolled: boolean;
  enabled: boolean;
  busy: boolean;
  onEnroll?: () => void;
  onToggle: (v: boolean) => void;
  testid: string;
  extra?: React.ReactNode;
  manualCommand?: string;
  manualNote?: string;
  onMarkEnrolled?: () => void;
  onCheck?: () => void;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-semibold">{title}</span>
        <span
          data-testid={`status-${testid}`}
          className={`ml-auto text-[10px] font-mono px-2 py-0.5 rounded-full ${
            enrolled ? "bg-[#4ECDC4]/15 text-[#4ECDC4]" : "bg-white/5 text-muted-foreground"
          }`}
        >
          {enrolled ? "Enrolled" : available ? "Not enrolled" : "Unavailable"}
        </span>
      </div>
      {!available ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] text-muted-foreground">{unavailableNote}</p>
          {extra}
        </div>
      ) : (
        <>
          <Toggle
            checked={enabled}
            onChange={onToggle}
            label={enabled ? "Enabled" : "Disabled"}
            accent="#E040FB"
          />
          {manualCommand ? (
            <div className="mt-2 space-y-2">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {manualNote ??
                  "This needs admin rights, so it can't run from inside the app. Open a terminal and run:"}
              </p>
              <CopyCommand command={manualCommand} testid={testid} />
              {onCheck ? (
                <button
                  onClick={onCheck}
                  disabled={busy}
                  data-testid={`button-check-${testid}`}
                  className="flex items-center gap-2 text-[11px] text-[#E040FB] hover:text-[#ff66ff] disabled:opacity-40"
                >
                  {busy ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> Checking…</>
                  ) : (
                    <><RotateCw className="w-3 h-3" /> Check enrollment status</>
                  )}
                </button>
              ) : (
                <button
                  onClick={onMarkEnrolled}
                  data-testid={`button-mark-enrolled-${testid}`}
                  className="flex items-center gap-2 text-[11px] text-[#E040FB] hover:text-[#ff66ff]"
                >
                  <Check className="w-3 h-3" /> {enrolled ? "Mark as set up again" : "I've run it — mark as set up"}
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={onEnroll}
              disabled={busy}
              data-testid={`button-enroll-${testid}`}
              className="mt-2 flex items-center gap-2 text-[11px] text-[#E040FB] hover:text-[#ff66ff] disabled:opacity-40"
            >
              {busy ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> Follow the prompt…</>
              ) : (
                <><RotateCw className="w-3 h-3" /> {enrolled ? "Re-enroll" : "Enroll"}</>
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function BiometricSetting() {
  const s = useSettings();
  const [avail, setAvail] = useState<Availability | null>(null);
  const [fpEnrolled, setFpEnrolled] = useState(() => isEnrolled("fingerprint"));
  const [faceEnrolled, setFaceEnrolled] = useState(() => isEnrolled("face"));
  const [busy, setBusy] = useState<Modality | null>(null);
  const [msg, setMsg] = useState("");
  const [msgErr, setMsgErr] = useState(false);

  useEffect(() => {
    let live = true;
    getAvailability().then((a) => {
      if (live) setAvail(a);
    });
    return () => {
      live = false;
    };
  }, []);

  // Fingerprint enrollment happens in a terminal (`fprintd-enroll`). This only
  // CHECKS the result via read-only `fprintd-list` — the app never enrolls.
  const checkFingerprint = async () => {
    setMsg("");
    setMsgErr(false);
    setBusy("fingerprint");
    const r = await refreshFingerprintEnrollment();
    setBusy(null);
    if (r.enrolled) {
      setFpEnrolled(true);
      saveSettings({ fingerprintEnabled: true });
      setMsg("Fingerprint detected and enabled.");
    } else {
      setMsgErr(true);
      setMsg(
        r.error ||
          "No fingerprint enrolled yet. Run fprintd-enroll in a terminal, then check again.",
      );
    }
  };

  const toggle = (m: Modality, on: boolean) => {
    setMsg("");
    setMsgErr(false);
    if (m === "fingerprint") saveSettings({ fingerprintEnabled: on });
    else saveSettings({ faceEnabled: on });
  };

  // Face enrollment happens in a terminal (`sudo howdy add`); once the user has
  // run it, this records it locally and turns face unlock on.
  const markFace = () => {
    setMsgErr(false);
    markEnrolled("face");
    setFaceEnrolled(true);
    saveSettings({ faceEnabled: true });
    setMsg("Face marked as set up. Make sure you ran the command in a terminal first.");
  };

  return (
    <div className="pt-3 border-t border-border/40 space-y-3">
      <div className="flex items-center gap-2">
        <ScanFace className="w-3.5 h-3.5 text-[#E040FB]" />
        <span className="text-xs font-semibold">Biometric unlock</span>
      </div>
      {avail === null && <p className="text-[11px] text-muted-foreground">Checking this device…</p>}
      {avail && !avail.tauri && (
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Biometric unlock runs in the Bifrost desktop app, which talks to fprintd (fingerprint) and
          Howdy (face) on your Linux machine. It isn't available in the browser preview.
        </p>
      )}
      {avail && avail.tauri && (
        <>
          <BioRow
            icon={<Fingerprint className="w-3.5 h-3.5 text-[#E040FB]" />}
            title="Fingerprint"
            available={avail.fingerprint}
            unavailableNote="No fprintd-compatible reader detected."
            enrolled={fpEnrolled}
            enabled={s.fingerprintEnabled}
            busy={busy === "fingerprint"}
            onToggle={(v) => toggle("fingerprint", v)}
            testid="fingerprint"
            manualCommand={FINGERPRINT_SETUP_COMMAND}
            manualNote="Enroll in a terminal (no admin needed), then restart Bifrost or check the status below:"
            onCheck={() => void checkFingerprint()}
          />
          <BioRow
            icon={<ScanFace className="w-3.5 h-3.5 text-[#E040FB]" />}
            title="Face recognition"
            available={avail.face}
            unavailableNote="Howdy is not installed."
            enrolled={faceEnrolled}
            enabled={s.faceEnabled}
            busy={busy === "face"}
            onEnroll={() => {}}
            onToggle={(v) => toggle("face", v)}
            testid="face"
            manualCommand={FACE_SETUP_COMMAND}
            manualNote="Howdy needs admin rights, so face setup can't run from inside the app. Open a terminal and run:"
            onMarkEnrolled={markFace}
            extra={
              !avail.face ? (
                <button
                  onClick={() => void openExternal(HOWDY_DOCS_URL)}
                  data-testid="link-install-howdy"
                  className="text-[11px] text-[#E040FB] hover:underline self-start"
                >
                  Install Howdy →
                </button>
              ) : undefined
            }
          />
          {msg && (
            <div className={`text-[11px] font-mono ${msgErr ? "text-[#FF6B35]" : "text-[#4ECDC4]"}`}>{msg}</div>
          )}
          <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
            A local convenience gate stored only on this device — your password still works as a
            fallback. Both enroll once in a terminal (fprintd for fingerprint, Howdy for face);
            Bifrost only detects and verifies them, never enrolls, so it can't crash.
          </p>
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

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ArrowRight, ArrowLeft, Wifi, WifiOff, Fingerprint, ScanFace, ShieldCheck, Terminal, Copy, Check } from "lucide-react";
import { BifrostLogo } from "./BifrostLogo";
import { LegalPanel } from "./Legal";
import { PasswordField, PasswordMeter } from "./shared";
import { setPassword, setLegalAccepted, setSetupComplete, evaluatePassword } from "@/lib/app-state";
import { getSettings, saveSettings, baseUrl } from "@/lib/api";
import { getAvailability, refreshFingerprintEnrollment, isEnrolled, markEnrolled, HOWDY_DOCS_URL, FACE_SETUP_COMMAND, FINGERPRINT_SETUP_COMMAND, type Availability, type Modality } from "@/lib/biometric";
import { openExternal } from "@/lib/tauri";

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
    <div className="flex items-center gap-1.5 rounded-md border border-white/10 bg-black/40 px-2 py-1.5">
      <Terminal className="w-3 h-3 text-[#4ECDC4] shrink-0" />
      <code className="flex-1 text-[11px] font-mono text-[#4ECDC4] select-all truncate text-left">{command}</code>
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

function BridgeArt() {
  return (
    <svg className="w-72 h-28" viewBox="0 0 400 120">
      <defs>
        <linearGradient id="wzb" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7B2FBE" />
          <stop offset="50%" stopColor="#E040FB" />
          <stop offset="100%" stopColor="#F48FB1" />
        </linearGradient>
      </defs>
      <motion.path
        d="M 0 110 Q 200 -10 400 110"
        stroke="url(#wzb)"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.6, ease: "easeInOut" }}
        style={{ filter: "drop-shadow(0 0 12px rgba(224,64,251,0.6))" }}
      />
    </svg>
  );
}

const STEPS = ["Welcome", "Legal", "Password", "Biometric", "Paths", "Connection", "Ready"];
const S_PASSWORD = 2;
const S_BIOMETRIC = 3;
const S_CONNECTION = 5;
const S_READY = 6;

export function SetupWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const s0 = getSettings();
  const [cowrie, setCowrie] = useState("/opt/cowrie/var/log/cowrie/cowrie.json");
  const [dbPath, setDbPath] = useState("/var/lib/bifrost/guardian.db");
  const [host, setHost] = useState(s0.guardianHost);
  const [port, setPort] = useState(s0.dashboardPort);
  const [testState, setTestState] = useState<"idle" | "testing" | "ok" | "fail">("idle");

  // Biometric step state
  const [avail, setAvail] = useState<Availability | null>(null);
  const [bioBusy, setBioBusy] = useState<Modality | null>(null);
  const [fpEnrolled, setFpEnrolled] = useState(() => isEnrolled("fingerprint"));
  const [faceEnrolled, setFaceEnrolled] = useState(() => isEnrolled("face"));
  const [bioMsg, setBioMsg] = useState("");

  useEffect(() => {
    let live = true;
    getAvailability().then((a) => live && setAvail(a));
    return () => {
      live = false;
    };
  }, []);

  const pwEval = evaluatePassword(pw);
  const pwMatch = pw === pw2 && pw2.length > 0;
  const pwValid = pwEval.acceptable && pwMatch;

  // Fingerprint is enrolled by the user in a terminal (`fprintd-enroll`). This
  // only CHECKS the result (read-only) — it never runs enrollment itself.
  const checkFingerprint = async () => {
    setBioMsg("");
    setBioBusy("fingerprint");
    const r = await refreshFingerprintEnrollment();
    setBioBusy(null);
    if (r.enrolled) {
      setFpEnrolled(true);
      saveSettings({ fingerprintEnabled: true });
    } else {
      setBioMsg(
        r.error ||
          "No fingerprint enrolled yet. Run fprintd-enroll in a terminal, then check again.",
      );
    }
  };

  // Face enrollment runs in a terminal (`sudo howdy add`). Once the user has
  // done it, record it locally and enable face unlock.
  const markFace = () => {
    setBioMsg("");
    markEnrolled("face");
    setFaceEnrolled(true);
    saveSettings({ faceEnabled: true });
  };

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const runTest = async () => {
    setTestState("testing");
    saveSettings({ guardianHost: host, dashboardPort: port });
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2500);
      const res = await fetch(`${baseUrl({ ...s0, guardianHost: host, dashboardPort: port })}/api/state`, {
        signal: ctrl.signal,
      });
      clearTimeout(t);
      setTestState(res.ok ? "ok" : "fail");
    } catch {
      setTestState("fail");
    }
  };

  const finish = async () => {
    await setPassword(pw);
    setLegalAccepted(true);
    saveSettings({ guardianHost: host, dashboardPort: port });
    localStorage.setItem("bifrost.paths", JSON.stringify({ cowrie, dbPath }));
    setSetupComplete(true);
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#060606] overflow-hidden p-6">
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-1/4 left-1/4 w-1/2 h-1/2 bg-[#7B2FBE] blur-[160px]" />
        <div className="absolute bottom-1/4 right-1/4 w-1/2 h-1/2 bg-[#E040FB] blur-[160px]" />
      </div>

      <div className="relative z-10 w-full max-w-2xl h-[600px] glass-panel rounded-2xl p-8 flex flex-col">
        {/* progress */}
        <div className="flex items-center gap-2 mb-6">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div
                className={`h-1.5 flex-1 rounded-full transition-all ${i <= step ? "rainbow-bg" : "bg-white/10"}`}
              />
            </div>
          ))}
        </div>
        <div className="text-[10px] tracking-[0.2em] text-muted-foreground mb-4">
          STEP {step + 1} / {STEPS.length} · {STEPS[step].toUpperCase()}
        </div>

        <div className="flex-1 min-h-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="h-full"
            >
              {step === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <BridgeArt />
                  <BifrostLogo className="w-16 h-16 -mt-6 float-soft" />
                  <h2 className="text-3xl font-extrabold tracking-[0.15em] rainbow-text mt-4">BIFROST</h2>
                  <p className="text-sm text-muted-foreground mt-3 font-mono">The Bridge Is Watched.</p>
                  <p className="text-xs text-muted-foreground/70 mt-6 max-w-md">
                    Welcome, Heimdall. Let's prepare your watch over the rainbow bridge. This takes about a minute.
                  </p>
                </div>
              )}

              {step === 1 && <LegalPanel onAccept={next} />}

              {step === S_PASSWORD && (
                <div className="h-full flex flex-col justify-center max-w-md mx-auto w-full">
                  <h2 className="text-xl font-bold mb-1">Set a strong dashboard password</h2>
                  <p className="text-[11px] text-muted-foreground mb-5">
                    This guards your bridge. It must be Strong or Very Strong to continue.
                  </p>
                  <label className="text-xs text-muted-foreground mb-1">Password</label>
                  <div className="mb-3">
                    <PasswordField value={pw} onChange={setPw} testid="input-wizard-password" />
                  </div>
                  <PasswordMeter pw={pw} />
                  <label className="text-xs text-muted-foreground mb-1 mt-4">Confirm password</label>
                  <PasswordField value={pw2} onChange={setPw2} testid="input-wizard-confirm" />
                  {pw2 && pw !== pw2 && <div className="text-[10px] text-[#FF2D2D] mt-1">Passwords do not match.</div>}
                </div>
              )}

              {step === S_BIOMETRIC && (
                <div className="h-full flex flex-col justify-center max-w-lg mx-auto w-full">
                  <div className="text-center mb-5">
                    <ShieldCheck className="w-9 h-9 mx-auto text-[#E040FB] mb-2" />
                    <h2 className="text-xl font-bold mb-1">Set up biometric unlock</h2>
                    <p className="text-[12px] text-muted-foreground leading-relaxed">
                      Optional. Unlock Bifrost with your fingerprint or face — your password{" "}
                      <span className="text-foreground">always works as a fallback</span>. Enroll one,
                      both, or skip.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Fingerprint card */}
                    <div className="rounded-xl border border-white/10 bg-black/30 p-4 flex flex-col items-center text-center min-h-[150px] justify-center">
                      <Fingerprint className="w-7 h-7 text-[#E040FB] mb-2" />
                      <div className="text-sm font-semibold mb-1">Fingerprint</div>
                      {avail === null ? (
                        <div className="text-[11px] text-muted-foreground">Checking…</div>
                      ) : fpEnrolled ? (
                        <div className="text-[12px] text-[#4ECDC4] font-mono flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" /> Enrolled
                        </div>
                      ) : avail.fingerprint ? (
                        <div className="w-full space-y-2">
                          <div className="text-[10px] text-[#4ECDC4] leading-snug">
                            Enroll in a terminal (no admin needed), then restart Bifrost or check:
                          </div>
                          <CopyCommand command={FINGERPRINT_SETUP_COMMAND} testid="fingerprint" />
                          <button
                            onClick={checkFingerprint}
                            disabled={bioBusy !== null}
                            data-testid="button-check-fingerprint"
                            className="flex items-center justify-center gap-1.5 w-full rounded-lg px-3 py-1.5 text-[11px] font-semibold border border-[#7B2FBE]/50 bg-[#7B2FBE]/10 hover:bg-[#7B2FBE]/20 disabled:opacity-40"
                          >
                            {bioBusy === "fingerprint" ? (
                              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking…</>
                            ) : (
                              <><Check className="w-3.5 h-3.5" /> Check enrollment status</>
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="text-[11px] text-muted-foreground">
                          {avail.tauri ? "No reader detected" : "Desktop app only"}
                        </div>
                      )}
                    </div>
                    {/* Face card */}
                    <div className="rounded-xl border border-white/10 bg-black/30 p-4 flex flex-col items-center text-center min-h-[150px] justify-center">
                      <ScanFace className="w-7 h-7 text-[#E040FB] mb-2" />
                      <div className="text-sm font-semibold mb-1">Face Recognition</div>
                      {avail === null ? (
                        <div className="text-[11px] text-muted-foreground">Checking…</div>
                      ) : faceEnrolled ? (
                        <div className="text-[12px] text-[#4ECDC4] font-mono flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" /> Enrolled
                        </div>
                      ) : avail.face ? (
                        <div className="w-full space-y-2">
                          <div className="text-[10px] text-[#4ECDC4]">
                            Howdy needs admin rights — run this in a terminal:
                          </div>
                          <CopyCommand command={FACE_SETUP_COMMAND} testid="face" />
                          <button
                            onClick={markFace}
                            data-testid="button-mark-enrolled-face"
                            className="flex items-center justify-center gap-1.5 w-full rounded-lg px-3 py-1.5 text-[11px] font-semibold border border-[#7B2FBE]/50 bg-[#7B2FBE]/10 hover:bg-[#7B2FBE]/20"
                          >
                            <Check className="w-3.5 h-3.5" /> I've run it
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="text-[11px] text-muted-foreground">
                            {avail.tauri ? "Howdy not installed" : "Desktop app only"}
                          </div>
                          {avail.tauri && (
                            <button
                              onClick={() => void openExternal(HOWDY_DOCS_URL)}
                              data-testid="link-install-howdy"
                              className="text-[11px] text-[#E040FB] hover:underline"
                            >
                              Install Howdy →
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {bioMsg && (
                    <div className="text-[11px] font-mono text-[#FF6B35] mt-3 text-center">{bioMsg}</div>
                  )}
                  <p className="text-[10px] text-muted-foreground/60 mt-4 text-center leading-relaxed">
                    Both enroll once in a terminal — fprintd for fingerprint, Howdy for face — then
                    Bifrost detects them. The credential never leaves this machine.
                  </p>
                </div>
              )}

              {step === 4 && (
                <div className="h-full flex flex-col justify-center max-w-md mx-auto w-full">
                  <h2 className="text-xl font-bold mb-6">Configure paths</h2>
                  <label className="text-xs text-muted-foreground mb-1">Cowrie honeypot log</label>
                  <input
                    value={cowrie}
                    onChange={(e) => setCowrie(e.target.value)}
                    className="bg-black/40 border border-border rounded-lg px-3 py-2.5 text-sm font-mono outline-none focus:border-[#E040FB] mb-4"
                  />
                  <label className="text-xs text-muted-foreground mb-1">Guardian database</label>
                  <input
                    value={dbPath}
                    onChange={(e) => setDbPath(e.target.value)}
                    className="bg-black/40 border border-border rounded-lg px-3 py-2.5 text-sm font-mono outline-none focus:border-[#E040FB]"
                  />
                  <p className="text-[10px] text-muted-foreground/60 mt-4">
                    In the desktop build a native file picker is available; paths can be edited later in Settings.
                  </p>
                </div>
              )}

              {step === S_CONNECTION && (
                <div className="h-full flex flex-col justify-center max-w-md mx-auto w-full">
                  <h2 className="text-xl font-bold mb-6">Test guardian connection</h2>
                  <div className="flex gap-3 mb-4">
                    <input
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      className="flex-1 bg-black/40 border border-border rounded-lg px-3 py-2.5 text-sm font-mono outline-none focus:border-[#E040FB]"
                    />
                    <input
                      type="number"
                      value={port}
                      onChange={(e) => setPort(Number(e.target.value))}
                      className="w-28 bg-black/40 border border-border rounded-lg px-3 py-2.5 text-sm font-mono outline-none focus:border-[#E040FB]"
                    />
                  </div>
                  <button
                    onClick={runTest}
                    disabled={testState === "testing"}
                    className="rounded-lg py-2.5 text-sm font-semibold rainbow-bg text-white"
                  >
                    {testState === "testing" ? "Testing…" : "Test connection"}
                  </button>
                  <div className="mt-4 text-sm font-mono flex items-center gap-2">
                    {testState === "testing" && <Loader2 className="w-4 h-4 animate-spin" />}
                    {testState === "ok" && (
                      <span className="text-[#4ECDC4] flex items-center gap-2">
                        <Wifi className="w-4 h-4" /> Guardian reachable
                      </span>
                    )}
                    {testState === "fail" && (
                      <span className="text-[#FF6B35] flex items-center gap-2">
                        <WifiOff className="w-4 h-4" /> Could not reach guardian — you can configure this later.
                      </span>
                    )}
                  </div>
                </div>
              )}

              {step === S_READY && (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <BridgeArt />
                  <BifrostLogo className="w-16 h-16 -mt-6 float-soft" />
                  <h2 className="text-2xl font-extrabold rainbow-text mt-4">Heimdall is Online</h2>
                  <p className="text-sm text-muted-foreground mt-3 font-mono">The Bridge Is Watched.</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* nav */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/40">
          <button
            onClick={back}
            disabled={step === 0}
            className="flex items-center gap-1 text-sm text-muted-foreground disabled:opacity-30 hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          {step === S_READY ? (
            <button onClick={finish} className="flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold rainbow-bg text-white">
              Launch Bifrost <ArrowRight className="w-4 h-4" />
            </button>
          ) : step === 1 ? (
            <div className="text-[10px] text-muted-foreground">Accept to continue</div>
          ) : step === S_BIOMETRIC ? (
            <button
              onClick={next}
              className="flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold rainbow-bg text-white"
            >
              {fpEnrolled || faceEnrolled ? "Continue" : "Skip"} <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={next}
              disabled={step === S_PASSWORD && !pwValid}
              className="flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold rainbow-bg text-white disabled:opacity-40"
            >
              {step === S_CONNECTION && testState === "idle" ? "Skip / Continue" : "Continue"} <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { LockKeyhole, Fingerprint, ScanFace } from "lucide-react";
import { BifrostLogo } from "./BifrostLogo";
import { verifyPassword, hasPassword } from "@/lib/app-state";
import { isEnrolled, verify, refreshFingerprintEnrollment, type Modality } from "@/lib/biometric";
import { useSettings, saveSettings } from "@/lib/api";

export function Login({ onSuccess }: { onSuccess: () => void }) {
  const settings = useSettings();
  const [pw, setPw] = useState("");
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fpEnrolled, setFpEnrolled] = useState(() => isEnrolled("fingerprint"));

  // Ask fprintd (read-only) whether a fingerprint is enrolled. If the user
  // enrolled one in a terminal, this makes the fingerprint button appear
  // automatically — no in-app enrollment ever runs.
  useEffect(() => {
    let live = true;
    refreshFingerprintEnrollment().then((r) => {
      if (!live) return;
      setFpEnrolled(r.enrolled);
      if (r.enrolled && !settings.fingerprintEnabled) saveSettings({ fingerprintEnabled: true });
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fpReady = settings.fingerprintEnabled && fpEnrolled;
  const faceReady = settings.faceEnabled && isEnrolled("face");
  const anyBio = fpReady || faceReady;
  const [bioBusy, setBioBusy] = useState<Modality | null>(null);
  const [bioErr, setBioErr] = useState("");
  const [bioFails, setBioFails] = useState(0);
  const MAX_BIO_FAILS = 3;
  const bioLockedOut = bioFails >= MAX_BIO_FAILS;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const ok = await verifyPassword(pw);
    setBusy(false);
    if (ok) onSuccess();
    else {
      setError(true);
      setPw("");
    }
  };

  const bioUnlock = async (m: Modality) => {
    if (bioLockedOut || bioBusy) return;
    setBioBusy(m);
    setBioErr("");
    const res = await verify(m);
    setBioBusy(null);
    if (res.ok) {
      onSuccess();
      return;
    }
    const fails = bioFails + 1;
    setBioFails(fails);
    if (fails >= MAX_BIO_FAILS) {
      setBioErr("Biometric failed 3 times — please use your password.");
    } else {
      setBioErr(`${res.error || "Biometric unlock failed."} (${MAX_BIO_FAILS - fails} left)`);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#060606] overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-25">
        <div className="absolute top-1/4 left-1/3 w-1/3 h-1/3 bg-[#7B2FBE] blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/3 w-1/3 h-1/3 bg-[#E040FB] blur-[150px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
        className="relative z-10 w-[380px] glass-panel rounded-2xl p-8 flex flex-col items-center"
      >
        <BifrostLogo className="w-16 h-16 float-soft" />
        <div className="text-xl font-extrabold tracking-[0.2em] rainbow-text mt-4">BIFROST</div>
        <div className="text-xs text-muted-foreground font-mono mt-1">Heimdall guards this bridge</div>

        <form onSubmit={submit} className="w-full mt-8">
          <div
            className="rounded-xl p-[1.5px] transition-all duration-300"
            style={{
              background: focused
                ? "linear-gradient(90deg,#7B2FBE,#E040FB,#E91E8C,#F48FB1)"
                : "rgba(255,255,255,0.08)",
              boxShadow: focused ? "0 0 22px -4px rgba(224,64,251,0.6)" : "none",
            }}
          >
            <div className="flex items-center gap-2 bg-[#0b0b0b] rounded-[10px] px-3">
              <LockKeyhole className="w-4 h-4 text-muted-foreground" />
              <input
                type="password"
                autoFocus
                value={pw}
                onChange={(e) => {
                  setPw(e.target.value);
                  setError(false);
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder={hasPassword() ? "Enter password" : "Default password: heimdall"}
                className="flex-1 bg-transparent py-3 text-sm font-mono outline-none placeholder:text-muted-foreground/50"
              />
            </div>
          </div>
          {error && <div className="text-xs text-[#FF2D2D] font-mono mt-2">Access denied. Try again.</div>}
          <button
            type="submit"
            disabled={busy || !pw}
            className="w-full mt-5 rounded-xl py-3 text-sm font-bold rainbow-bg text-white disabled:opacity-40 transition-all"
          >
            {busy ? "Verifying…" : "Cross the Bridge"}
          </button>
        </form>

        {anyBio && !bioLockedOut && (
          <div className="w-full mt-4">
            <div className="flex items-center gap-3 my-1 text-[10px] uppercase tracking-wider text-muted-foreground/60">
              <div className="h-px flex-1 bg-white/10" /> or <div className="h-px flex-1 bg-white/10" />
            </div>
            <div className="mt-2 flex flex-col gap-2">
              {fpReady && (
                <button
                  type="button"
                  onClick={() => bioUnlock("fingerprint")}
                  disabled={!!bioBusy}
                  data-testid="button-unlock-fingerprint"
                  className="w-full rounded-xl py-3 text-sm font-semibold border border-[#7B2FBE]/50 bg-[#7B2FBE]/10 text-foreground hover:bg-[#7B2FBE]/20 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
                >
                  <Fingerprint className="w-4 h-4 text-[#E040FB]" />
                  {bioBusy === "fingerprint" ? "Scan your finger…" : "Unlock with fingerprint"}
                </button>
              )}
              {faceReady && (
                <button
                  type="button"
                  onClick={() => bioUnlock("face")}
                  disabled={!!bioBusy}
                  data-testid="button-unlock-face"
                  className="w-full rounded-xl py-3 text-sm font-semibold border border-[#7B2FBE]/50 bg-[#7B2FBE]/10 text-foreground hover:bg-[#7B2FBE]/20 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
                >
                  <ScanFace className="w-4 h-4 text-[#E040FB]" />
                  {bioBusy === "face" ? "Look at the camera…" : "Unlock with face"}
                </button>
              )}
            </div>
            {bioErr && <div className="text-xs text-[#FF6B35] font-mono mt-2 text-center">{bioErr}</div>}
          </div>
        )}
        {anyBio && bioLockedOut && (
          <div className="text-xs text-[#FF6B35] font-mono mt-4 text-center">{bioErr}</div>
        )}
      </motion.div>
    </div>
  );
}

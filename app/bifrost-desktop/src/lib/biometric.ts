// Linux biometric unlock for Bifrost — desktop (Tauri) only.
//
// Honest scope: this is a LOCAL unlock gate that sits alongside Bifrost's
// password gate as a convenience, not as cloud authentication. It drives the
// real Linux biometric stacks through small Tauri commands that shell out on
// the desktop:
//
//   • Fingerprint — fprintd (`fprintd-enroll` to register, `fprintd-verify`
//     to authenticate). Works with any fprintd-compatible reader.
//   • Face        — Howdy (`howdy add` to register, `howdy recognize` to
//     authenticate). Howdy needs root, so those run via pkexec/sudo.
//
// The old WebAuthn approach never worked inside Tauri on Linux because a web
// page can't talk to fprintd or Howdy. In the browser preview none of this is
// available, so every call degrades gracefully and the UI shows "desktop only".

import {
  isTauri,
  biometricAvailability,
  fprintdEnroll,
  fprintdVerify,
  howdyEnroll,
  howdyVerify,
  type CmdResult,
} from "./tauri";

export type Modality = "fingerprint" | "face";

export const HOWDY_DOCS_URL = "https://github.com/boltgolt/howdy";

export interface Availability {
  /** Running inside the desktop app (where biometrics are possible at all). */
  tauri: boolean;
  /** An fprintd-compatible fingerprint reader stack is present. */
  fingerprint: boolean;
  /** Howdy (face recognition) is installed. */
  face: boolean;
  howdyInstalled: boolean;
}

const ENROLL_KEY = (m: Modality) => `bifrost.biometric.${m}.enrolled`;

// Whether the user has registered this modality through Bifrost. Enrollment
// itself lives in fprintd / Howdy; this local flag just drives the green
// checkmark and the login-screen buttons.
export function isEnrolled(m: Modality): boolean {
  try {
    return localStorage.getItem(ENROLL_KEY(m)) === "1";
  } catch {
    return false;
  }
}

function setEnrolled(m: Modality, on: boolean): void {
  try {
    if (on) localStorage.setItem(ENROLL_KEY(m), "1");
    else localStorage.removeItem(ENROLL_KEY(m));
  } catch {
    /* ignore */
  }
}

// Forget a local enrollment flag (e.g. when the user clears it).
export function forget(m: Modality): void {
  setEnrolled(m, false);
}

// Which biometric backends are usable right now.
export async function getAvailability(): Promise<Availability> {
  if (!isTauri()) {
    return { tauri: false, fingerprint: false, face: false, howdyInstalled: false };
  }
  const a = await biometricAvailability();
  return {
    tauri: true,
    fingerprint: !!a?.fingerprintAvailable,
    face: !!a?.faceAvailable,
    howdyInstalled: !!a?.howdyInstalled,
  };
}

// Turn a backend CmdResult into a short, human message.
function resultError(res: CmdResult | null, fallback: string): string {
  if (!res) return "Only available in the Bifrost desktop app.";
  if (res.message) return res.message;
  const detail = (res.stderr || res.stdout || "").trim().split("\n").pop() ?? "";
  return detail || fallback;
}

// Enroll a modality. Prompts the OS sensor / camera on the desktop.
export async function enroll(m: Modality): Promise<{ ok: boolean; error?: string }> {
  if (!isTauri()) return { ok: false, error: "Enrollment is only available in the desktop app." };
  const res = m === "fingerprint" ? await fprintdEnroll() : await howdyEnroll();
  if (res?.ok) {
    setEnrolled(m, true);
    return { ok: true };
  }
  return { ok: false, error: resultError(res, "Enrollment failed.") };
}

// Verify a modality (used at the login screen).
export async function verify(m: Modality): Promise<{ ok: boolean; error?: string }> {
  if (!isTauri()) return { ok: false, error: "Biometric unlock is only available in the desktop app." };
  if (!isEnrolled(m)) return { ok: false, error: `No ${m} is enrolled on this device.` };
  const res = m === "fingerprint" ? await fprintdVerify() : await howdyVerify();
  if (res?.ok) return { ok: true };
  return {
    ok: false,
    error: resultError(res, m === "fingerprint" ? "Fingerprint did not match." : "Face was not recognised."),
  };
}

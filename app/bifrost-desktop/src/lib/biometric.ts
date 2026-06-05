// Linux biometric unlock for Bifrost — desktop (Tauri) only.
//
// Honest scope: this is a LOCAL unlock gate that sits alongside Bifrost's
// password gate as a convenience, not as cloud authentication. It drives the
// real Linux biometric stacks through small Tauri commands that shell out on
// the desktop.
//
// CRITICAL: the app NEVER enrolls a biometric itself. Enrollment commands can
// trigger a polkit/PAM prompt, and spawning that from the Tauri window tears
// the window down (it freezes and disappears — only the tray icon remains).
// So enrollment for BOTH modalities happens in a terminal, and the app only
// ever runs read-only / verify commands:
//
//   • Fingerprint — the user runs `fprintd-enroll` in a terminal. The app
//     detects the result with `fprintd-list <user>` (read-only) and unlocks
//     with `fprintd-verify`.
//   • Face        — the user runs `sudo howdy add` in a terminal. The app
//     records that locally and unlocks with `howdy recognize`.
//
// The old WebAuthn approach never worked inside Tauri on Linux because a web
// page can't talk to fprintd or Howdy. In the browser preview none of this is
// available, so every call degrades gracefully and the UI shows "desktop only".

import {
  isTauri,
  biometricAvailability,
  fprintdList,
  fprintdVerify,
  howdyVerify,
  type CmdResult,
} from "./tauri";

export type Modality = "fingerprint" | "face";

export const HOWDY_DOCS_URL = "https://github.com/boltgolt/howdy";

// The terminal command the user runs to enroll their face. Howdy needs root,
// and running it from inside the app via pkexec/sudo crashes the window, so we
// surface this command (with a copy button) instead of executing it.
export const FACE_SETUP_COMMAND = "sudo howdy add";

// The terminal command the user runs to enroll a fingerprint. Running this from
// inside the app can trigger a polkit prompt that crashes the window, so we
// surface it (with a copy button) and detect the result instead of executing it.
export const FINGERPRINT_SETUP_COMMAND = "fprintd-enroll";

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

// Mark a modality as enrolled. Used for face, where enrollment happens in a
// terminal (`sudo howdy add`) and the user confirms they've completed it.
export function markEnrolled(m: Modality): void {
  setEnrolled(m, true);
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

// Detect whether a fingerprint is already enrolled in fprintd, by running the
// READ-ONLY `fprintd-list <user>`. The app never enrolls itself (that can crash
// the window) — the user runs `fprintd-enroll` in a terminal and this picks up
// the result. The local enrolled flag is synced to whatever fprintd reports so
// the login screen can show the fingerprint button automatically.
export async function refreshFingerprintEnrollment(): Promise<{
  enrolled: boolean;
  checked: boolean;
  error?: string;
}> {
  if (!isTauri()) {
    return { enrolled: false, checked: false, error: "Only available in the desktop app." };
  }
  const res = await fprintdList();
  // `ok` here means the command spawned (binary present). A falsy/!ok result
  // means fprintd isn't installed or the user couldn't be resolved.
  if (!res || !res.ok) {
    return { enrolled: isEnrolled("fingerprint"), checked: false, error: resultError(res, "Could not check enrollment status.") };
  }
  const out = `${res.stdout}\n${res.stderr}`;
  // fprintd-list prints one "- #N: <finger>" line per enrolled finger, under a
  // "Fingerprints for user X" header. When nothing is enrolled it prints a
  // "has no fingerprints" line instead.
  const enrolled =
    /-\s*#\d+:/.test(out) || (/Fingerprints for user/i.test(out) && !/no fingerprints/i.test(out));
  setEnrolled("fingerprint", enrolled);
  return { enrolled, checked: true };
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

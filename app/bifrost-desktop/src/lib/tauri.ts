/* Bridge to the Tauri runtime. In the browser preview these all no-op safely.
   In the packaged desktop app, `withGlobalTauri` exposes window.__TAURI__. */

type AnyTauri = any;

function tauri(): AnyTauri | null {
  if (typeof window === "undefined") return null;
  return (window as AnyTauri).__TAURI__ ?? null;
}

export const isTauri = (): boolean => !!tauri();

export async function minimizeWindow(): Promise<void> {
  const t = tauri();
  if (t) await t.window.getCurrentWindow().minimize();
}

export async function toggleMaximize(): Promise<void> {
  const t = tauri();
  if (!t) return;
  const w = t.window.getCurrentWindow();
  (await w.isMaximized()) ? await w.unmaximize() : await w.maximize();
}

export async function closeWindow(): Promise<void> {
  const t = tauri();
  if (t) await t.window.getCurrentWindow().close();
}

async function invokeGuardian<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  const t = tauri();
  if (!t) return null;
  try {
    return (await t.core.invoke(cmd, args)) as T;
  } catch {
    return null;
  }
}

export const startGuardian = () => invokeGuardian<boolean>("start_guardian");
export const stopGuardian = () => invokeGuardian<boolean>("stop_guardian");
export const guardianStatus = () => invokeGuardian<boolean>("guardian_status");
export const getGuardianPort = () => invokeGuardian<number>("get_guardian_port");

/* ---------------- Linux biometric unlock bridge ----------------
   These map to the Rust commands in src-tauri/src/lib.rs that drive
   fprintd (fingerprint) and Howdy (face). In the browser preview the
   underlying invoke returns null and the caller degrades gracefully. */

export interface BiometricAvailability {
  fingerprintAvailable: boolean;
  faceAvailable: boolean;
  howdyInstalled: boolean;
}

export interface CmdResult {
  ok: boolean;
  code: number;
  stdout: string;
  stderr: string;
  message: string;
}

export const biometricAvailability = () =>
  invokeGuardian<BiometricAvailability>("biometric_availability");
export const fprintdVerify = () => invokeGuardian<CmdResult>("fprintd_verify");
// Read-only detection of existing fprintd enrollment (`fprintd-list <user>`).
// Enrollment itself is NEVER invoked from the app — running `fprintd-enroll`
// can trigger a polkit/PAM prompt that tears the window down, so the user runs
// it in a terminal and the app just detects the result.
export const fprintdList = () => invokeGuardian<CmdResult>("fprintd_list");
// Face enrollment is never invoked from the app (it needs root and would crash
// the window via pkexec) — the user runs `sudo howdy add` in a terminal instead.
export const howdyVerify = () => invokeGuardian<CmdResult>("howdy_verify");

/* ---------------- Gjallarhorn — Nine Realms broadcaster bridge ----------------
   These map to the Rust commands in src-tauri/src/lib.rs that shell out to
   `logger` (Asgard/journald), `notify-send` (Midgard/desktop), and `curl`
   (Vanaheim webhooks, Muspelheim/Twilio, Helheim firewall daemon). In the
   browser preview invoke returns null and realms.ts simulates the broadcast. */

export interface RealmAvailability {
  journald: boolean;
  desktop: boolean;
  curl: boolean;
}

export const realmAvailability = () => invokeGuardian<RealmAvailability>("realm_availability");

export const journaldLog = (tag: string, priority: string, message: string) =>
  invokeGuardian<CmdResult>("journald_log", { tag, priority, message });

export const desktopNotify = (urgency: string, title: string, message: string) =>
  invokeGuardian<CmdResult>("desktop_notify", { urgency, title, message });

export const relayPost = (url: string, body: string, token: string | null) =>
  invokeGuardian<CmdResult>("relay_post", { url, body, token });

export const twilioSms = (
  accountSid: string,
  authToken: string,
  from: string,
  to: string,
  body: string,
) => invokeGuardian<CmdResult>("twilio_sms", { accountSid, authToken, from, to, body });

export async function openExternal(url: string): Promise<void> {
  const t = tauri();
  if (t?.shell?.open) {
    await t.shell.open(url);
  } else if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

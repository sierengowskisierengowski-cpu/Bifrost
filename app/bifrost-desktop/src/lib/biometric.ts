// Biometric unlock for the login screen — fingerprint or face, whichever the
// user's device has enrolled (Touch ID, Windows Hello, Android biometrics).
//
// This uses the WebAuthn platform authenticator, the same standard browsers and
// password managers use. The OS owns the sensor and decides fingerprint vs face;
// we only ask it to verify the user. Honest scope: this is a LOCAL unlock gate.
// The credential lives in this browser/device only and is not verified by a
// server — it sits alongside Bifrost's existing local password gate as a
// convenience, not as cloud authentication.

const CRED_KEY = "bifrost.biometric.credentialId";

function b64urlEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): ArrayBuffer {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const s = atob(str.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const buf = new ArrayBuffer(s.length);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return buf;
}

function errMsg(e: unknown): string {
  if (e instanceof Error) {
    if (e.name === "NotAllowedError") return "Cancelled or timed out.";
    if (e.name === "InvalidStateError") return "This device is already enrolled.";
    if (e.name === "SecurityError") return "Blocked — needs a secure (https) context.";
    return e.message || e.name;
  }
  return String(e);
}

// Is the WebAuthn API present at all?
export function biometricSupported(): boolean {
  return typeof window !== "undefined" && typeof window.PublicKeyCredential === "function";
}

// Does THIS machine have a usable fingerprint/face sensor exposed to the browser?
export async function platformAuthenticatorAvailable(): Promise<boolean> {
  if (!biometricSupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

// Has the user already enrolled a biometric credential on this device?
export function biometricEnrolled(): boolean {
  try {
    return !!localStorage.getItem(CRED_KEY);
  } catch {
    return false;
  }
}

// Enroll: prompts the OS biometric sheet and stores the resulting credential id.
export async function enrollBiometric(): Promise<{ ok: boolean; error?: string }> {
  if (!biometricSupported()) return { ok: false, error: "WebAuthn is not supported here." };
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = crypto.getRandomValues(new Uint8Array(16));
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: "Bifrost", id: window.location.hostname },
        user: { id: userId, name: "heimdall", displayName: "Heimdall" },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "preferred",
        },
        timeout: 60000,
        attestation: "none",
      },
    })) as PublicKeyCredential | null;
    if (!cred) return { ok: false, error: "No credential was created." };
    localStorage.setItem(CRED_KEY, b64urlEncode(cred.rawId));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

// Unlock: prompts the OS biometric sheet and verifies the stored credential.
export async function unlockWithBiometric(): Promise<{ ok: boolean; error?: string }> {
  if (!biometricSupported()) return { ok: false, error: "WebAuthn is not supported here." };
  const id = (() => {
    try {
      return localStorage.getItem(CRED_KEY);
    } catch {
      return null;
    }
  })();
  if (!id) return { ok: false, error: "No biometric is enrolled on this device." };
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ type: "public-key", id: b64urlDecode(id) }],
        userVerification: "required",
        rpId: window.location.hostname,
        timeout: 60000,
      },
    });
    return { ok: !!assertion };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

// Forget the enrolled credential (turn the feature back off on this device).
export function disableBiometric(): void {
  try {
    localStorage.removeItem(CRED_KEY);
  } catch {
    /* ignore */
  }
}

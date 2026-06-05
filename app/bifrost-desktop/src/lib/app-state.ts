const K = {
  setup: "bifrost.setupComplete",
  legal: "bifrost.legalAccepted",
  pw: "bifrost.passwordHash",
};

export const isSetupComplete = () => localStorage.getItem(K.setup) === "1";
export const setSetupComplete = (v = true) => localStorage.setItem(K.setup, v ? "1" : "0");

export const isLegalAccepted = () => localStorage.getItem(K.legal) === "1";
export const setLegalAccepted = (v = true) => localStorage.setItem(K.legal, v ? "1" : "0");

export const hasPassword = () => !!localStorage.getItem(K.pw);

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export async function setPassword(pw: string): Promise<void> {
  localStorage.setItem(K.pw, await sha256(pw));
}

export async function verifyPassword(pw: string): Promise<boolean> {
  if (!hasPassword()) return pw === "heimdall";
  return (await sha256(pw)) === localStorage.getItem(K.pw);
}

export function passwordStrength(pw: string): { score: number; label: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  score = Math.min(4, score);
  const label = ["Very weak", "Weak", "Fair", "Strong", "Very strong"][score];
  return { score, label };
}

export interface PasswordChecks {
  length: boolean;
  upper: boolean;
  lower: boolean;
  number: boolean;
  special: boolean;
}

export type PasswordLabel = "Weak" | "Fair" | "Strong" | "Very Strong";

export interface PasswordEval {
  checks: PasswordChecks;
  /** Meter level 0..3 mapping to Weak / Fair / Strong / Very Strong. */
  index: number;
  label: PasswordLabel;
  /** True only when Strong or Very Strong — required to proceed. */
  acceptable: boolean;
}

/* Strong-password policy: min 12 chars and must include upper, lower, number,
   and a special character. Only "Strong" / "Very Strong" are acceptable. */
export function evaluatePassword(pw: string): PasswordEval {
  const checks: PasswordChecks = {
    length: pw.length >= 12,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    number: /\d/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };
  const allRequired =
    checks.length && checks.upper && checks.lower && checks.number && checks.special;
  const met = Object.values(checks).filter(Boolean).length;

  let index: number;
  if (!allRequired) {
    index = met <= 2 ? 0 : 1; // Weak or Fair while requirements unmet
  } else {
    index = pw.length >= 16 ? 3 : 2; // Strong, or Very Strong for longer secrets
  }
  const label = (["Weak", "Fair", "Strong", "Very Strong"] as const)[index];
  return { checks, index, label, acceptable: allRequired };
}

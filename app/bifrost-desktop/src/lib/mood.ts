import { useGuardian } from "./api";

/* The "mood" of the bridge — drives the Hyprland-style reactive border color.
   Derived from real (or simulated-fallback) incident severity in the last hour,
   so the border shifts as threats escalate. */
export type Mood = "calm" | "alert" | "critical";

export const MOOD_CLASS: Record<Mood, string> = {
  calm: "mood-calm",
  alert: "mood-alert",
  critical: "mood-critical",
};

export function useMood(): Mood {
  const { incidents } = useGuardian();
  const hourAgo = Date.now() - 3600_000;
  const recent = incidents.filter((i) => +new Date(i.timestamp) >= hourAgo);
  if (recent.some((i) => i.severity === "CRITICAL")) return "critical";
  if (recent.filter((i) => i.severity === "HIGH").length >= 2) return "alert";
  return "calm";
}

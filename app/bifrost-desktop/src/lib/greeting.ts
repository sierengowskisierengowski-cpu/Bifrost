import { useSettings } from "./api";
import { useMood, type Mood } from "./mood";

export type TimeOfDay = "morning" | "afternoon" | "night";

export function timeOfDay(date = new Date()): TimeOfDay {
  const h = date.getHours();
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 18) return "afternoon";
  return "night";
}

/* Builds the casual, slang greeting. Critical mood overrides time of day; every
   other line is keyed by (time of day × calm/threats). `mood` comes from the
   shared bridge mood (calm | alert | critical) — alert maps to "threats". */
export function greetingFor(name: string, mood: Mood, date = new Date()): string {
  const n = name.trim();
  if (mood === "critical") {
    return `${n} — drop everything. Bridge is under serious pressure.`;
  }
  const threats = mood === "alert";
  const tod = timeOfDay(date);
  const lines: Record<TimeOfDay, { calm: string; threats: string }> = {
    morning: {
      calm: `Morning ${n}, bridge held all night.`,
      threats: `Heads up ${n}, something hit the bridge early.`,
    },
    afternoon: {
      calm: `What's good ${n}, all quiet on the bridge.`,
      threats: `Yo ${n}, got some activity you should check.`,
    },
    night: {
      calm: `Still up ${n}? Heimdall's got the watch.`,
      threats: `Aye ${n}, real talk — something's moving right now.`,
    },
  };
  return threats ? lines[tod].threats : lines[tod].calm;
}

/* Returns the live greeting string, or null when the feature is off or no name
   is set — callers fall back to their default copy so the app is unchanged. */
export function useGreeting(): string | null {
  const s = useSettings();
  const mood = useMood();
  if (!s.greetingEnabled) return null;
  const name = s.greetingName.trim();
  if (!name) return null;
  return greetingFor(name, mood);
}

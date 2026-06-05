import type { Attacker } from "./types";

// A Doppelgänger is one actor wearing many IP masks: a set of attackers that
// share the same SSH-client (HASSH) and/or TLS (JA4) fingerprint. Different IPs,
// same hands on the keyboard.
export interface Doppelganger {
  id: string;
  signals: ("HASSH" | "JA4")[];
  fingerprints: string[];
  members: Attacker[];
  countries: string[];
  totalHits: number;
}

function pushTo(map: Map<string, Attacker[]>, key: string, a: Attacker) {
  const g = map.get(key);
  if (g) g.push(a);
  else map.set(key, [a]);
}

function dedupeByIp(list: Attacker[]): Attacker[] {
  const seen = new Map<string, Attacker>();
  for (const a of list) if (!seen.has(a.ip)) seen.set(a.ip, a);
  return [...seen.values()];
}

// Cluster attackers by shared fingerprint. A cluster needs ≥2 distinct IPs.
// When the same IP set is matched by both HASSH and JA4, the signals merge into
// one stronger cluster rather than appearing twice.
export function findDoppelgangers(attackers: Attacker[]): Doppelganger[] {
  const fpGroups = new Map<string, Attacker[]>();
  for (const a of attackers) {
    if (a.hassh) pushTo(fpGroups, `HASSH\u0000${a.hassh}`, a);
    if (a.ja4) pushTo(fpGroups, `JA4\u0000${a.ja4}`, a);
  }

  const bySet = new Map<string, Doppelganger>();
  for (const [key, members] of fpGroups) {
    const uniq = dedupeByIp(members);
    if (uniq.length < 2) continue;
    const sep = key.indexOf("\u0000");
    const signal = key.slice(0, sep) as "HASSH" | "JA4";
    const fp = key.slice(sep + 1);
    const setKey = uniq.map((m) => m.ip).sort().join("|");

    const existing = bySet.get(setKey);
    if (existing) {
      if (!existing.signals.includes(signal)) existing.signals.push(signal);
      if (!existing.fingerprints.includes(fp)) existing.fingerprints.push(fp);
    } else {
      const sorted = [...uniq].sort((a, b) => b.totalHits - a.totalHits);
      bySet.set(setKey, {
        id: setKey,
        signals: [signal],
        fingerprints: [fp],
        members: sorted,
        countries: [...new Set(sorted.map((m) => m.country))],
        totalHits: sorted.reduce((s, m) => s + m.totalHits, 0),
      });
    }
  }

  return [...bySet.values()].sort(
    (a, b) => b.members.length - a.members.length || b.totalHits - a.totalHits
  );
}

// How many distinct attacker IPs are actually part of some Doppelgänger cluster.
export function maskedIpCount(clusters: Doppelganger[]): number {
  const ips = new Set<string>();
  for (const c of clusters) for (const m of c.members) ips.add(m.ip);
  return ips.size;
}

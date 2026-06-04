// Heimdall Speaks — a fully client-side, data-grounded narrator + Q&A engine.
// Everything here is derived from the live GuardianState already in the browser;
// nothing is sent anywhere. When the downloaded agent's local LLM is connected,
// this same surface can be upgraded to free-form answers, but every number and
// claim below is computed deterministically from real telemetry.

import type { GuardianState, Incident, Attacker, Severity, TimeRange } from "./types";
import { filterByRange } from "./api";
import { fmtRelative, fmtNum } from "./format";
import { findDoppelgangers, maskedIpCount } from "./doppelganger";

const SEV_RANK: Record<Severity, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, INFO: 0 };

export type Verdict = "calm" | "watchful" | "engaged" | "besieged";

export interface VerdictInfo {
  verdict: Verdict;
  title: string;
  accent: string;
  line: string;
}

export interface SagaChapter {
  id: string;
  kind: "opening" | "adversary" | "pattern" | "defense" | "closing";
  title: string;
  accent: string;
  severity?: Severity;
  paragraphs: string[];
}

export interface HeimdallAnswer {
  text: string[];
  verdict?: Verdict;
  refs?: { kind: "attacker" | "incident"; id: string; label: string }[];
  suggestions?: string[];
}

/* ------------------------------------------------------------------ */
/* shared aggregates                                                   */
/* ------------------------------------------------------------------ */

// An attacker scoped to the selected window: hits/first/last are computed from
// in-range incidents, not lifetime totals, so every "in the last X" claim is true.
export interface RangedAttacker {
  attacker: Attacker;
  hits: number;
  first: string;
  last: string;
}

interface Agg {
  incidents: Incident[];
  attackerCount: number;
  total: number;
  blocked: number;
  blockedPct: number;
  critical: number;
  high: number;
  lastHourCritHigh: number;
  topThreatClass: { name: string; count: number } | null;
  topTactic: { name: string; count: number } | null;
  topAttackers: RangedAttacker[];
  topCreds: { combo: string; count: number } | null;
  countries: { name: string; flag: string; count: number }[];
}

function topCount(map: Map<string, number>): { name: string; count: number } | null {
  let best: { name: string; count: number } | null = null;
  for (const [name, count] of map) if (!best || count > best.count) best = { name, count };
  return best;
}

export function aggregate(state: GuardianState, range: TimeRange): Agg {
  const incidents = filterByRange(state.incidents, range);

  const blocked = incidents.filter((i) => i.actionTaken !== "MONITORED").length;
  const critical = incidents.filter((i) => i.severity === "CRITICAL").length;
  const high = incidents.filter((i) => i.severity === "HIGH").length;
  const hourCut = Date.now() - 3600_000;
  const lastHourCritHigh = incidents.filter(
    (i) => (i.severity === "CRITICAL" || i.severity === "HIGH") && +new Date(i.timestamp) >= hourCut
  ).length;

  const threatMap = new Map<string, number>();
  const tacticMap = new Map<string, number>();
  const byIp = new Map<string, Incident[]>();
  for (const i of incidents) {
    if (i.threatClass) threatMap.set(i.threatClass, (threatMap.get(i.threatClass) ?? 0) + 1);
    if (i.mitreTactic) tacticMap.set(i.mitreTactic, (tacticMap.get(i.mitreTactic) ?? 0) + 1);
    const arr = byIp.get(i.attackerIp);
    if (arr) arr.push(i);
    else byIp.set(i.attackerIp, [i]);
  }

  // Build range-scoped attackers strictly from in-range incidents.
  const ranged: RangedAttacker[] = [];
  for (const a of state.attackers) {
    const list = byIp.get(a.ip);
    if (!list || !list.length) continue;
    const ts = list.map((i) => +new Date(i.timestamp)).sort((x, y) => x - y);
    ranged.push({
      attacker: a,
      hits: list.length,
      first: new Date(ts[0]).toISOString(),
      last: new Date(ts[ts.length - 1]).toISOString(),
    });
  }
  ranged.sort((a, b) => b.hits - a.hits);

  const credMap = new Map<string, number>();
  const countryMap = new Map<string, { flag: string; count: number }>();
  for (const r of ranged) {
    for (const c of r.attacker.credentials) {
      const k = `${c.username} / ${c.password}`;
      credMap.set(k, (credMap.get(k) ?? 0) + 1);
    }
    const prev = countryMap.get(r.attacker.country);
    countryMap.set(r.attacker.country, { flag: r.attacker.flag, count: (prev?.count ?? 0) + r.hits });
  }
  const topCredEntry = topCount(credMap);

  return {
    incidents,
    attackerCount: byIp.size,
    total: incidents.length,
    blocked,
    blockedPct: incidents.length ? Math.round((blocked / incidents.length) * 1000) / 10 : 0,
    critical,
    high,
    lastHourCritHigh,
    topThreatClass: topCount(threatMap),
    topTactic: topCount(tacticMap),
    topAttackers: ranged.slice(0, 3),
    topCreds: topCredEntry ? { combo: topCredEntry.name, count: topCredEntry.count } : null,
    countries: [...countryMap.entries()]
      .map(([name, v]) => ({ name, flag: v.flag, count: v.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4),
  };
}

/* ------------------------------------------------------------------ */
/* verdict                                                             */
/* ------------------------------------------------------------------ */

export function verdictFor(state: GuardianState, range: TimeRange = "24H"): VerdictInfo {
  const a = aggregate(state, range);
  const circuitOpen = state.aiModel.circuitState === "OPEN";

  let verdict: Verdict = "calm";
  if (a.lastHourCritHigh >= 5 || (a.critical >= 3 && a.blockedPct < 80)) verdict = "besieged";
  else if (a.lastHourCritHigh >= 1 || a.critical >= 1) verdict = "engaged";
  else if (a.high >= 1 || a.total >= 1) verdict = "watchful";

  const map: Record<Verdict, VerdictInfo> = {
    calm: {
      verdict: "calm",
      title: "The bridge is calm",
      accent: "#4ECDC4",
      line: "No active threats. Heimdall keeps watch over a quiet horizon.",
    },
    watchful: {
      verdict: "watchful",
      title: "Watchful",
      accent: "#9D4EDD",
      line: `Low-grade probing observed${
        a.topThreatClass ? ` — mostly ${a.topThreatClass.name.toLowerCase()}` : ""
      }. Nothing has breached the gate.`,
    },
    engaged: {
      verdict: "engaged",
      title: "Actively defending",
      accent: "#FFB020",
      line: `${a.critical + a.high} serious attempt${
        a.critical + a.high === 1 ? "" : "s"
      } met — ${a.blockedPct}% turned away at the bridge.`,
    },
    besieged: {
      verdict: "besieged",
      title: "Under sustained assault",
      accent: "#FF2D2D",
      line: `${a.lastHourCritHigh} severe strike${
        a.lastHourCritHigh === 1 ? "" : "s"
      } in the last hour. The watch is holding, but stay close.`,
    },
  };
  const info = map[verdict];
  if (circuitOpen) info.line += " ⚠ AI circuit is OPEN — falling back to rules.";
  return info;
}

/* ------------------------------------------------------------------ */
/* the saga                                                            */
/* ------------------------------------------------------------------ */

const RANGE_WORD: Record<TimeRange, string> = {
  "1H": "the last hour",
  "24H": "the last day",
  "7D": "the last seven days",
  "30D": "the last thirty days",
  ALL: "all recorded time",
};

function adversaryStory(r: RangedAttacker, word: string): string {
  const a = r.attacker;
  const types = a.attackTypes.slice(0, 3).join(", ");
  const creds = a.credentials.length;
  const credNote = creds
    ? ` On record, they've tried ${fmtNum(creds)} credential${creds === 1 ? "" : "s"}.`
    : "";
  return `${a.flag} A ${a.threatLevel.toLowerCase()} adversary at ${a.ip} out of ${a.country} drew Heimdall's eye ${fmtNum(
    r.hits
  )} time${r.hits === 1 ? "" : "s"} in ${word}, between ${fmtRelative(r.first)} and ${fmtRelative(
    r.last
  )}${types ? `, leaning on ${types}` : ""}.${credNote} The bridge held.`;
}

export function buildSaga(state: GuardianState, range: TimeRange): SagaChapter[] {
  const a = aggregate(state, range);
  const v = verdictFor(state, range);
  const chapters: SagaChapter[] = [];
  const word = RANGE_WORD[range];

  // Opening
  if (a.total === 0) {
    chapters.push({
      id: "opening",
      kind: "opening",
      title: "A quiet watch",
      accent: "#4ECDC4",
      paragraphs: [
        `Across ${word}, the bridge logged no incidents worth raising. Heimdall stood the watch over a still horizon — ${fmtNum(
          state.counters.processedToday
        )} events sifted, none worthy of the horn.`,
      ],
    });
    return chapters;
  }

  chapters.push({
    id: "opening",
    kind: "opening",
    title: v.title,
    accent: v.accent,
    severity: a.critical ? "CRITICAL" : a.high ? "HIGH" : "MEDIUM",
    paragraphs: [
      `Across ${word}, Heimdall raised the horn ${fmtNum(a.total)} time${
        a.total === 1 ? "" : "s"
      } — ${fmtNum(a.critical)} critical, ${fmtNum(a.high)} high. Of every challenge at the gate, ${
        a.blockedPct
      }% were turned away.`,
      v.line,
    ],
  });

  // Adversary
  if (a.topAttackers.length) {
    const lead = a.topAttackers[0];
    const paras = [adversaryStory(lead, word)];
    if (a.countries.length > 1) {
      paras.push(
        `The assault was not lonely — strikes arrived from ${a.countries
          .map((c) => `${c.flag} ${c.name}`)
          .join(", ")}.`
      );
    }
    chapters.push({
      id: "adversary",
      kind: "adversary",
      title: "The one who came closest",
      accent: "#FF2D2D",
      severity: lead.attacker.threatLevel,
      paragraphs: paras,
    });
  }

  // Pattern
  if (a.topThreatClass || a.topTactic || a.topCreds) {
    const paras: string[] = [];
    if (a.topThreatClass)
      paras.push(
        `The dominant pattern was ${a.topThreatClass.name.toLowerCase()} (${fmtNum(
          a.topThreatClass.count
        )} of ${fmtNum(a.total)} incidents)${
          a.topTactic ? `, mapping mostly to the ${a.topTactic.name} tactic` : ""
        }.`
      );
    if (a.topCreds)
      paras.push(
        `The most-attempted key was “${a.topCreds.combo}”, tried ${fmtNum(a.topCreds.count)} time${
          a.topCreds.count === 1 ? "" : "s"
        } — a reminder of how lazily most intruders knock.`
      );
    chapters.push({
      id: "pattern",
      kind: "pattern",
      title: "How they tried to cross",
      accent: "#9D4EDD",
      paragraphs: paras,
    });
  }

  // Doppelgänger — one actor, many masks
  const clusters = findDoppelgangers(state.attackers);
  if (clusters.length) {
    const masked = maskedIpCount(clusters);
    const lead = clusters[0];
    const usesHassh = clusters.some((c) => c.signals.includes("HASSH"));
    const usesJa4 = clusters.some((c) => c.signals.includes("JA4"));
    const signalDesc =
      usesHassh && usesJa4 ? "SSH and TLS fingerprints" : usesHassh ? "SSH-client fingerprints" : "TLS fingerprints";
    const paras = [
      `What looked like a crowd is, in part, a disguise. Across all tracked adversaries, ${fmtNum(
        clusters.length
      )} actor${clusters.length === 1 ? "" : "s"} are wearing ${fmtNum(masked)} different IP masks — the same ${signalDesc} surfacing from address after address.`,
    ];
    paras.push(
      `The busiest of them hides behind ${fmtNum(lead.members.length)} IPs across ${fmtNum(
        lead.countries.length
      )} countr${lead.countries.length === 1 ? "y" : "ies"} (${lead.signals.join(" + ")} match), yet it is one pair of hands. Block the fingerprint, not just the address.`
    );
    chapters.push({
      id: "doppelganger",
      kind: "pattern",
      title: "The faces behind the masks",
      accent: "#E040FB",
      paragraphs: paras,
    });
  }

  // Defense / closing
  const cfg = state.config;
  const posture: string[] = [];
  posture.push(
    `${cfg.autonomous ? "Autonomous response is armed" : "Autonomous response is OFF — strikes are logged, not countered"}${
      cfg.dryRun ? ", and dry-run is on, so actions are simulated only" : ""
    }. Confidence threshold sits at ${Math.round(cfg.confidenceThreshold)}%.`
  );
  posture.push(
    `The AI watch (${state.aiModel.model}) is answering in ~${state.aiModel.lastResponseMs}ms at ${Math.round(
      state.aiModel.successRate
    )}% success, circuit ${state.aiModel.circuitState}.`
  );
  chapters.push({
    id: "defense",
    kind: "defense",
    title: "Where the watch stands now",
    accent: "#4ECDC4",
    paragraphs: posture,
  });

  return chapters;
}

/* ------------------------------------------------------------------ */
/* ask heimdall                                                        */
/* ------------------------------------------------------------------ */

export const SUGGESTED_QUESTIONS = [
  "Am I safe right now?",
  "Who attacked me?",
  "What was the worst incident?",
  "What passwords are they trying?",
  "What should I do?",
  "How is the bridge holding up?",
];

function has(q: string, ...words: string[]): boolean {
  return words.some((w) => q.includes(w));
}

export function askHeimdall(question: string, state: GuardianState, range: TimeRange = "24H"): HeimdallAnswer {
  const q = question.toLowerCase().trim();
  const a = aggregate(state, range);
  const v = verdictFor(state, range);

  if (!q) {
    return { text: ["Ask me anything about your bridge."], suggestions: SUGGESTED_QUESTIONS };
  }

  // safety / threat verdict
  if (has(q, "safe", "danger", "under attack", "at risk", "should i worry", "ok right now", "okay right now")) {
    const lines = [`${v.title}. ${v.line}`];
    if (a.total)
      lines.push(
        `In ${RANGE_WORD[range]}: ${fmtNum(a.critical)} critical and ${fmtNum(a.high)} high incidents, ${
          a.blockedPct
        }% blocked.`
      );
    return {
      text: lines,
      verdict: v.verdict,
      refs: a.topAttackers
        .slice(0, 2)
        .map((x) => ({ kind: "attacker" as const, id: x.attacker.ip, label: `${x.attacker.flag} ${x.attacker.ip}` })),
      suggestions: ["What should I do?", "Who attacked me?"],
    };
  }

  // who / where attackers
  if (has(q, "who", "attacker", "where from", "country", "countries", "ip ", "ips")) {
    if (!a.topAttackers.length) return { text: ["No attackers on record for this window. The horizon is clear."] };
    const lead = a.topAttackers[0];
    const lines = [
      `${fmtNum(a.attackerCount)} distinct adversar${a.attackerCount === 1 ? "y" : "ies"} in ${RANGE_WORD[range]}.`,
      adversaryStory(lead, RANGE_WORD[range]),
    ];
    if (a.countries.length)
      lines.push(`Origins: ${a.countries.map((c) => `${c.flag} ${c.name} (${fmtNum(c.count)})`).join(", ")}.`);
    return {
      text: lines,
      refs: a.topAttackers.map((x) => ({
        kind: "attacker" as const,
        id: x.attacker.ip,
        label: `${x.attacker.flag} ${x.attacker.ip}`,
      })),
      suggestions: ["What passwords are they trying?", "Am I safe right now?"],
    };
  }

  // doppelgänger — one actor across many IPs
  if (has(q, "doppel", "same attacker", "same person", "one person", "one actor", "disguise", "mask", "alias", "fingerprint", "hassh", "ja4", "really behind", "linked")) {
    const clusters = findDoppelgangers(state.attackers);
    if (!clusters.length)
      return {
        text: ["No doppelgängers detected — every adversary on record has a distinct SSH/TLS fingerprint, so the IP count is the actor count."],
        suggestions: ["Who attacked me?", "Am I safe right now?"],
      };
    const masked = maskedIpCount(clusters);
    const lead = clusters[0];
    return {
      text: [
        `${fmtNum(clusters.length)} actor${clusters.length === 1 ? "" : "s"} are hiding behind ${fmtNum(masked)} IPs — same fingerprint, different addresses.`,
        `The busiest spreads across ${fmtNum(lead.members.length)} IPs in ${fmtNum(lead.countries.length)} countr${lead.countries.length === 1 ? "y" : "ies"} (${lead.signals.join(" + ")} match). It's one operator. Block the fingerprint, not just the address.`,
      ],
      refs: lead.members.slice(0, 4).map((m) => ({ kind: "attacker" as const, id: m.ip, label: `${m.flag} ${m.ip}` })),
      suggestions: ["Who attacked me?", "What should I do?"],
    };
  }

  // worst / most severe incident
  if (has(q, "worst", "most severe", "biggest", "critical", "most dangerous", "highest")) {
    const worst = a.incidents
      .slice()
      .sort((x, y) => SEV_RANK[y.severity] - SEV_RANK[x.severity] || y.confidenceScore - x.confidenceScore)[0];
    if (!worst) return { text: ["Nothing of note — no incidents in this window."] };
    return {
      text: [
        `The sharpest strike was a ${worst.severity} ${worst.threatClass} from ${worst.attackerIp} ${fmtRelative(
          worst.timestamp
        )}.`,
        `${worst.summary} Mapped to ${worst.mitreTechnique} (${worst.mitreTechniqueName}); Heimdall ${
          worst.actionTaken === "MONITORED" ? "watched it" : `responded with ${worst.actionTaken}`
        } at ${Math.round(worst.confidenceScore)}% confidence.`,
      ],
      verdict: v.verdict,
      refs: [{ kind: "incident", id: worst.id, label: `${worst.severity} · ${worst.attackerIp}` }],
      suggestions: ["What should I do?", "Who attacked me?"],
    };
  }

  // credentials
  if (has(q, "password", "credential", "login", "username", "brute")) {
    if (!a.topCreds) return { text: ["No credential attempts recorded in this window."] };
    return {
      text: [
        `The most-attempted key was “${a.topCreds.combo}” (${fmtNum(a.topCreds.count)}×).`,
        "These are almost always automated dictionary runs. As long as you don't use defaults and have key-based auth, they bounce off.",
      ],
      suggestions: ["What should I do?", "Am I safe right now?"],
    };
  }

  // recommendations
  if (has(q, "what should i do", "recommend", "advice", "harden", "improve", "next step", "protect")) {
    const recs: string[] = [];
    const cfg = state.config;
    if (!cfg.autonomous) recs.push("• Autonomous response is OFF — turn it on so the bridge can act, not just watch.");
    if (cfg.dryRun) recs.push("• Dry-run is ON — actions are simulated. Disable it when you trust the rules.");
    if (cfg.confidenceThreshold >= 90)
      recs.push(`• Confidence threshold is high (${Math.round(cfg.confidenceThreshold)}%) — lower it slightly to catch more.`);
    if (a.topCreds) recs.push(`• “${a.topCreds.combo}” is being hammered — confirm that account is disabled or key-only.`);
    if (state.aiModel.circuitState === "OPEN") recs.push("• AI circuit is OPEN — check the model; you're on rules-only fallback.");
    if (!recs.length) recs.push("• Posture looks solid. Keep autonomous response armed and review the saga daily.");
    return { text: ["Here's where I'd focus:", ...recs], verdict: v.verdict, suggestions: ["Am I safe right now?", "How is the bridge holding up?"] };
  }

  // health / status
  if (has(q, "holding up", "health", "status", "performance", "cpu", "ram", "memory", "model", "ai ", "uptime")) {
    const hw = state.hardware;
    return {
      text: [
        `${state.aiModel.model} is answering in ~${state.aiModel.lastResponseMs}ms at ${Math.round(
          state.aiModel.successRate
        )}% success (circuit ${state.aiModel.circuitState}).`,
        `Hardware (${hw.tier}): ${Math.round((hw.ramUsed / hw.ramTotal) * 100)}% RAM, ${Math.round(
          hw.cpuPercent
        )}% CPU. Processed ${fmtNum(state.counters.processedToday)} events today.`,
      ],
      suggestions: ["Am I safe right now?", "What should I do?"],
    };
  }

  // blocking stats
  if (has(q, "block", "stop", "turn away", "defend")) {
    return {
      text: [
        `Of ${fmtNum(a.total)} incident${a.total === 1 ? "" : "s"} in ${RANGE_WORD[range]}, ${fmtNum(
          a.blocked
        )} were actioned — ${a.blockedPct}% turned away.`,
      ],
      verdict: v.verdict,
      suggestions: ["What should I do?", "Who attacked me?"],
    };
  }

  // summary / story
  if (has(q, "summary", "summarize", "what happened", "story", "saga", "overview", "recap")) {
    return {
      text: [
        `${v.title}. ${v.line}`,
        `${fmtNum(a.total)} incidents in ${RANGE_WORD[range]} (${fmtNum(a.critical)} critical, ${fmtNum(
          a.high
        )} high), ${a.blockedPct}% blocked${
          a.topThreatClass ? `, mostly ${a.topThreatClass.name.toLowerCase()}` : ""
        }.`,
      ],
      verdict: v.verdict,
      suggestions: SUGGESTED_QUESTIONS.slice(1, 4),
    };
  }

  // fallback
  return {
    text: [
      "I read your bridge's telemetry, not the open web — so ask about your incidents, attackers, defenses, or what to do next.",
    ],
    suggestions: SUGGESTED_QUESTIONS,
  };
}

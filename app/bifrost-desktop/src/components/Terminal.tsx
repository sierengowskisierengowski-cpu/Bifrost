import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  guardian,
  useGuardian,
  useSettings,
  saveSettings,
  computeOverview,
  type AppSettings,
} from "@/lib/api";
import type { GuardianConfig } from "@/lib/types";
import { fmtNum, fmtTime } from "@/lib/format";

const RAINBOW = ["#9D4EDD", "#C4607A", "#E040FB", "#E91E8C", "#F48FB1", "#4ECDC4", "#7B2FBE"];
const BLOCKLIST_KEY = "bifrost.blocklist";

type Line = { text: string; cls?: string };

const ART = [
  "  ╔╗ ╦╔═╗╦═╗╔═╗╔═╗╔╦╗",
  "  ╠╩╗║╠╣ ╠╦╝║ ║╚═╗ ║ ",
  "  ╚═╝╩╚  ╩╚═╚═╝╚═╝ ╩ ",
];

const BOOT = [
  { text: "ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ  Heimdall console", cls: "text-[#9D4EDD]" },
  { text: "» linking to Bifrost guardian core ...", cls: "text-muted-foreground" },
  { text: "» mounting rune-tables ............. ok", cls: "text-[#4ECDC4]" },
  { text: "» decrypting watch-keys ............ ok", cls: "text-[#4ECDC4]" },
  { text: "» Gjallarhorn link ................. ok", cls: "text-[#4ECDC4]" },
  { text: "", cls: "" },
  { text: "Type 'help' for commands. ESC or 'exit' to close.", cls: "text-[#F48FB1]" },
  { text: "", cls: "" },
];

function loadBlocklist(): string[] {
  try {
    const raw = localStorage.getItem(BLOCKLIST_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}
function saveBlocklist(list: string[]) {
  localStorage.setItem(BLOCKLIST_KEY, JSON.stringify(list));
}

const CONFIG_KEYS: (keyof GuardianConfig)[] = [
  "learningMode",
  "dryRun",
  "autonomous",
  "confidenceThreshold",
  "databasePath",
  "logPath",
  "cowrieLogPath",
  "ingestPort",
  "dashboardPort",
  "guardianHost",
];

const SETTINGS_KEYS: (keyof AppSettings)[] = [
  "guardianHost",
  "dashboardPort",
  "ingestPort",
  "refreshIntervalMs",
  "screensaverMs",
  "screensaverStyle",
  "fontScale",
  "sessionTimeoutMin",
  "desktopNotifications",
  "persistGuardianState",
  "greetingEnabled",
  "greetingName",
  "fingerprintEnabled",
  "faceEnabled",
];

// Coerce `raw` to match the type of the current value, so the console can't
// persist a wrong-typed setting (e.g. a string where a number is expected).
// Returns { ok: false } when the input can't be parsed to the expected type.
function coerceTyped(raw: string, sample: unknown): { ok: true; value: unknown } | { ok: false } {
  if (typeof sample === "boolean") {
    if (raw === "true") return { ok: true, value: true };
    if (raw === "false") return { ok: true, value: false };
    return { ok: false };
  }
  if (typeof sample === "number") {
    const n = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(n)) return { ok: false };
    return { ok: true, value: n };
  }
  return { ok: true, value: raw };
}

export function Terminal({ onClose }: { onClose: () => void }) {
  const state = useGuardian();
  const settings = useSettings();
  const [lines, setLines] = useState<Line[]>([]);
  const [booting, setBooting] = useState(true);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [blocklist, setBlocklist] = useState<string[]>(loadBlocklist);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const push = useCallback((l: Line | Line[]) => {
    setLines((prev) => [...prev, ...(Array.isArray(l) ? l : [l])]);
  }, []);

  // Boot sequence: reveal lines one at a time, then enable input.
  useEffect(() => {
    let i = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const step = () => {
      if (i >= BOOT.length) {
        setBooting(false);
        return;
      }
      push(BOOT[i]);
      i++;
      timers.push(setTimeout(step, 130));
    };
    timers.push(setTimeout(step, 250));
    return () => timers.forEach(clearTimeout);
  }, [push]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [lines]);

  useEffect(() => {
    if (!booting) inputRef.current?.focus();
  }, [booting]);

  const overview = useMemo(
    () => computeOverview(state.incidents, state.attackers.length, state.counters.processedToday),
    [state.incidents, state.attackers.length, state.counters.processedToday]
  );

  const run = useCallback(
    (raw: string) => {
      const cmd = raw.trim();
      push({ text: `bifrost:~$ ${raw}`, cls: "text-[#E040FB]" });
      if (!cmd) return;
      const [name, ...args] = cmd.split(/\s+/);
      const cfg = state.config;

      switch (name.toLowerCase()) {
        case "help":
          push([
            { text: "COMMANDS", cls: "text-[#E040FB] font-bold" },
            { text: "  help                       this list", cls: "text-muted-foreground" },
            { text: "  config [show]              raw guardian config", cls: "text-muted-foreground" },
            { text: "  config set <key> <value>   edit guardian config", cls: "text-muted-foreground" },
            { text: "  settings [show]            advanced app settings", cls: "text-muted-foreground" },
            { text: "  settings set <key> <value> edit app settings", cls: "text-muted-foreground" },
            { text: "  events [n]                 raw live event log", cls: "text-muted-foreground" },
            { text: "  attackers [n]              tracked adversaries", cls: "text-muted-foreground" },
            { text: "  ban <ip>  /  unban <ip>    manual IP blocklist", cls: "text-muted-foreground" },
            { text: "  blocks                     list blocked IPs", cls: "text-muted-foreground" },
            { text: "  confidence <50-99>         confidence threshold", cls: "text-muted-foreground" },
            { text: "  mode <learning|dryrun|autonomous|enforce>", cls: "text-muted-foreground" },
            { text: "  cowrie <path>              cowrie log path", cls: "text-muted-foreground" },
            { text: "  db                         database stats", cls: "text-muted-foreground" },
            { text: "  clear                      wipe the screen", cls: "text-muted-foreground" },
            { text: "  exit / quit                close console", cls: "text-muted-foreground" },
          ]);
          break;

        case "config": {
          if (args[0] === "set") {
            const key = args[1] as keyof GuardianConfig;
            const valRaw = args.slice(2).join(" ");
            if (!key || valRaw === "") {
              push({ text: "usage: config set <key> <value>", cls: "text-[#FF6B35]" });
              break;
            }
            if (!CONFIG_KEYS.includes(key)) {
              push({ text: `unknown / locked key: ${key}`, cls: "text-[#FF6B35]" });
              push({ text: `editable: ${CONFIG_KEYS.join(", ")}`, cls: "text-muted-foreground" });
              break;
            }
            const parsed = coerceTyped(valRaw, cfg[key]);
            if (!parsed.ok) {
              push({ text: `invalid value for ${key} (expected ${typeof cfg[key]})`, cls: "text-[#FF6B35]" });
              break;
            }
            guardian.patchConfig({ [key]: parsed.value } as Partial<GuardianConfig>);
            push({ text: `✓ config.${key} = ${JSON.stringify(parsed.value)}`, cls: "text-[#4ECDC4]" });
          } else {
            push({ text: "── guardian config ──", cls: "text-[#9D4EDD] font-bold" });
            CONFIG_KEYS.forEach((k) =>
              push({ text: `  ${k.padEnd(20)} ${JSON.stringify(cfg[k])}`, cls: "text-muted-foreground" })
            );
            push({ text: `  modelsLoaded         ${JSON.stringify(cfg.modelsLoaded)}`, cls: "text-muted-foreground" });
            push({ text: `  hardwareTier         ${JSON.stringify(cfg.hardwareTier)}`, cls: "text-muted-foreground" });
          }
          break;
        }

        case "settings": {
          if (args[0] === "set") {
            const key = args[1] as keyof AppSettings;
            const valRaw = args.slice(2).join(" ");
            if (!key || valRaw === "") {
              push({ text: "usage: settings set <key> <value>", cls: "text-[#FF6B35]" });
              break;
            }
            if (!SETTINGS_KEYS.includes(key)) {
              push({ text: `unknown / locked key: ${key}`, cls: "text-[#FF6B35]" });
              push({ text: `editable: ${SETTINGS_KEYS.join(", ")}`, cls: "text-muted-foreground" });
              break;
            }
            if (key === "screensaverStyle" && valRaw !== "rainbow" && valRaw !== "ops") {
              push({ text: "screensaverStyle must be 'rainbow' or 'ops'", cls: "text-[#FF6B35]" });
              break;
            }
            const parsed = coerceTyped(valRaw, settings[key]);
            if (!parsed.ok) {
              push({ text: `invalid value for ${key} (expected ${typeof settings[key]})`, cls: "text-[#FF6B35]" });
              break;
            }
            saveSettings({ [key]: parsed.value } as Partial<AppSettings>);
            push({ text: `✓ settings.${key} = ${JSON.stringify(parsed.value)}`, cls: "text-[#4ECDC4]" });
          } else {
            push({ text: "── app settings ──", cls: "text-[#9D4EDD] font-bold" });
            SETTINGS_KEYS.forEach((k) =>
              push({ text: `  ${String(k).padEnd(20)} ${JSON.stringify(settings[k])}`, cls: "text-muted-foreground" })
            );
          }
          break;
        }

        case "events":
        case "log": {
          const n = Math.min(Math.max(Number(args[0]) || 12, 1), 50);
          const evts = state.liveEvents.slice(0, n);
          if (!evts.length) {
            push({ text: "no events in buffer", cls: "text-muted-foreground" });
            break;
          }
          push({ text: `── raw event log (${evts.length}) ──`, cls: "text-[#9D4EDD] font-bold" });
          evts.forEach((e) =>
            push({
              text: `  ${fmtTime(e.timestamp)}  ${e.attackerIp.padEnd(15)}  ${(e.attackType || e.category).padEnd(16)}  ${e.decision}  c=${e.confidence}`,
              cls:
                e.severity === "CRITICAL"
                  ? "text-[#FF2D2D]"
                  : e.severity === "HIGH"
                  ? "text-[#FF6B35]"
                  : "text-muted-foreground",
            })
          );
          break;
        }

        case "attackers": {
          const n = Math.min(Math.max(Number(args[0]) || 10, 1), 50);
          const list = [...state.attackers].sort((a, b) => b.totalHits - a.totalHits).slice(0, n);
          push({ text: `── tracked adversaries (${list.length}) ──`, cls: "text-[#9D4EDD] font-bold" });
          list.forEach((a) =>
            push({
              text: `  ${a.flag} ${a.ip.padEnd(15)} ${a.countryCode.padEnd(3)} ${String(fmtNum(a.totalHits)).padStart(6)} hits  ${a.threatLevel}${blocklist.includes(a.ip) ? "  [BLOCKED]" : ""}`,
              cls: "text-muted-foreground",
            })
          );
          break;
        }

        case "ban": {
          const ip = args[0];
          if (!ip) {
            push({ text: "usage: ban <ip>", cls: "text-[#FF6B35]" });
            break;
          }
          if (blocklist.includes(ip)) {
            push({ text: `${ip} already blocked`, cls: "text-muted-foreground" });
            break;
          }
          const next = [...blocklist, ip];
          setBlocklist(next);
          saveBlocklist(next);
          push({ text: `⛔ banned ${ip} (${next.length} blocked)`, cls: "text-[#E91E8C]" });
          break;
        }

        case "unban": {
          const ip = args[0];
          if (!ip) {
            push({ text: "usage: unban <ip>", cls: "text-[#FF6B35]" });
            break;
          }
          if (!blocklist.includes(ip)) {
            push({ text: `${ip} is not blocked`, cls: "text-muted-foreground" });
            break;
          }
          const next = blocklist.filter((x) => x !== ip);
          setBlocklist(next);
          saveBlocklist(next);
          push({ text: `✓ unbanned ${ip} (${next.length} blocked)`, cls: "text-[#4ECDC4]" });
          break;
        }

        case "blocks": {
          if (!blocklist.length) {
            push({ text: "blocklist empty", cls: "text-muted-foreground" });
            break;
          }
          push({ text: `── blocklist (${blocklist.length}) ──`, cls: "text-[#9D4EDD] font-bold" });
          blocklist.forEach((ip) => push({ text: `  ⛔ ${ip}`, cls: "text-[#E91E8C]" }));
          break;
        }

        case "confidence": {
          const v = Number(args[0]);
          if (Number.isNaN(v) || v < 50 || v > 99) {
            push({ text: "usage: confidence <50-99>", cls: "text-[#FF6B35]" });
            break;
          }
          guardian.patchConfig({ confidenceThreshold: Math.round(v) });
          push({ text: `✓ confidence threshold → ${Math.round(v)}%`, cls: "text-[#4ECDC4]" });
          break;
        }

        case "mode": {
          const m = (args[0] || "").toLowerCase();
          const map: Record<string, Partial<GuardianConfig>> = {
            learning: { learningMode: true, dryRun: true, autonomous: false },
            dryrun: { learningMode: false, dryRun: true, autonomous: false },
            autonomous: { learningMode: false, dryRun: false, autonomous: true },
            enforce: { learningMode: false, dryRun: false, autonomous: true },
          };
          if (!map[m]) {
            push({ text: "usage: mode <learning|dryrun|autonomous|enforce>", cls: "text-[#FF6B35]" });
            break;
          }
          guardian.patchConfig(map[m]);
          push({ text: `✓ mode → ${m}`, cls: "text-[#4ECDC4]" });
          if (m === "autonomous" || m === "enforce")
            push({ text: "⚠ enforcement active — actions taken without approval", cls: "text-[#FF6B35]" });
          break;
        }

        case "cowrie": {
          const path = args.join(" ").trim();
          if (!path) {
            push({ text: `current: ${cfg.cowrieLogPath}`, cls: "text-muted-foreground" });
            push({ text: "usage: cowrie <path>", cls: "text-[#FF6B35]" });
            break;
          }
          guardian.patchConfig({ cowrieLogPath: path });
          push({ text: `✓ cowrie log path → ${path}`, cls: "text-[#4ECDC4]" });
          break;
        }

        case "db":
        case "dbstats": {
          push({ text: "── database stats ──", cls: "text-[#9D4EDD] font-bold" });
          push([
            { text: `  path             ${cfg.databasePath}`, cls: "text-muted-foreground" },
            { text: `  log path         ${cfg.logPath}`, cls: "text-muted-foreground" },
            { text: `  events today     ${fmtNum(state.counters.processedToday)}`, cls: "text-muted-foreground" },
            { text: `  incidents        ${fmtNum(overview.incidents)}`, cls: "text-muted-foreground" },
            { text: `  tracked attackers${fmtNum(state.attackers.length).padStart(9)}`, cls: "text-muted-foreground" },
            { text: `  blocked %        ${overview.blockedPct}%`, cls: "text-muted-foreground" },
            { text: `  queue depth      ${fmtNum(state.counters.queueDepth)}`, cls: "text-muted-foreground" },
            { text: `  manual blocks    ${fmtNum(blocklist.length)}`, cls: "text-muted-foreground" },
          ]);
          break;
        }

        case "clear":
          setLines([]);
          break;

        case "exit":
        case "quit":
          onClose();
          break;

        default:
          push({ text: `unknown command: ${name} — try 'help'`, cls: "text-[#FF6B35]" });
      }
    },
    [push, state, settings, blocklist, overview, onClose]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key === "Enter") {
      const val = input;
      run(val);
      if (val.trim()) setHistory((h) => [val, ...h].slice(0, 100));
      setHistIdx(-1);
      setInput("");
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHistIdx((idx) => {
        const next = Math.min(idx + 1, history.length - 1);
        if (next >= 0 && history[next] !== undefined) setInput(history[next]);
        return next;
      });
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHistIdx((idx) => {
        const next = idx - 1;
        if (next < 0) {
          setInput("");
          return -1;
        }
        setInput(history[next] ?? "");
        return next;
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] bg-[#04030a]/97 backdrop-blur-sm flex flex-col font-mono text-[13px]"
      data-testid="terminal-overlay"
      onMouseDown={() => inputRef.current?.focus()}
    >
      <div className="absolute inset-0 pointer-events-none opacity-[0.04] bg-[repeating-linear-gradient(0deg,#fff_0,#fff_1px,transparent_1px,transparent_3px)]" />

      <div className="px-4 pt-4 pb-2 shrink-0">
        <motion.pre
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="leading-tight text-[13px] sm:text-base"
        >
          {ART.map((row, i) => (
            <div key={i} className="rainbow-text font-bold">
              {row}
            </div>
          ))}
        </motion.pre>
        <div className="text-[10px] tracking-[0.3em] mt-1" style={{ color: RAINBOW[2] }}>
          GUARDIAN OPS CONSOLE · ᚺᛖᛁᛗᛞᚨᛚᛚ
        </div>
        <div className="h-px mt-2 rainbow-bg opacity-50" />
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-2 space-y-0.5">
        {lines.map((l, i) => (
          <div key={i} className={l.cls || "text-foreground/90"} style={{ whiteSpace: "pre-wrap" }}>
            {l.text || "\u00A0"}
          </div>
        ))}
      </div>

      <div className="px-4 py-3 shrink-0 flex items-center gap-2 border-t border-white/10">
        <span className="text-[#E040FB]">bifrost:~$</span>
        <input
          ref={inputRef}
          value={input}
          disabled={booting}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          autoComplete="off"
          data-testid="terminal-input"
          className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground/40 caret-[#E040FB]"
          placeholder={booting ? "booting ..." : "type a command — 'help'"}
        />
        <button
          onClick={onClose}
          data-testid="button-terminal-close"
          className="text-[10px] tracking-widest text-muted-foreground hover:text-foreground border border-white/10 rounded px-2 py-1"
        >
          ESC
        </button>
      </div>
    </motion.div>
  );
}

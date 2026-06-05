import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { BifrostLogo } from "./BifrostLogo";
import { useGuardian, useLiveEvents } from "@/lib/api";
import { fmtNum, fmtUptime, fmtTime } from "@/lib/format";
import type { Attacker, LiveEvent } from "@/lib/types";

const RAINBOW = ["#7B2FBE", "#9D4EDD", "#C4607A", "#E040FB", "#E91E8C", "#F48FB1", "#4ECDC4"];

const HEX = "0123456789ABCDEF";
function randHex(n: number) {
  let s = "";
  for (let i = 0; i < n; i++) s += HEX[Math.floor(Math.random() * 16)];
  return s;
}
function randOctet() {
  return Math.floor(Math.random() * 256);
}
function randIp() {
  return `${randOctet()}.${randOctet()}.${randOctet()}.${randOctet()}`;
}

const GLYPHS = ["ᚠ", "ᚢ", "ᚦ", "ᚨ", "ᚱ", "ᚲ", "ᚷ", "ᚹ", "ᚺ", "ᚾ", "ᛁ", "ᛃ", "ᛈ", "ᛉ", "ᛊ", "ᛏ", "ᛒ", "ᛖ", "ᛗ", "ᛚ", "ᛜ", "ᛞ", "ᛟ"];
function streamLine(kind: number): string {
  switch (kind % 4) {
    case 0:
      return `0x${randHex(8)}`;
    case 1:
      return randIp();
    case 2:
      return GLYPHS[Math.floor(Math.random() * GLYPHS.length)] + " " + randHex(4);
    default:
      return `${randHex(2)}:${randHex(2)}:${randHex(2)}`;
  }
}

interface StreamCfg {
  left: string;
  dir: "up" | "down";
  speed: number;
  color: string;
  size: number;
  opacity: number;
  lines: string[];
}

const ATTACK_TYPES = [
  "SSH-BRUTEFORCE",
  "PORT-SCAN",
  "SQL-INJECTION",
  "RCE-ATTEMPT",
  "CRED-STUFFING",
  "MALWARE-DROP",
  "RECON",
  "LATERAL-MOVE",
  "C2-BEACON",
  "EXFIL",
];

export function OpsCenter({ onWake }: { onWake: () => void }) {
  const state = useGuardian();
  const live = useLiveEvents();
  const { counters, hardware, attackers } = state;

  // Preview mode: a mouse move blurs + pauses everything (a peek), then it
  // resumes after a short pause. A click, key, or tap actually wakes the app.
  const [preview, setPreview] = useState(false);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const wake = () => onWake();
    const peek = () => {
      setPreview(true);
      if (previewTimer.current) clearTimeout(previewTimer.current);
      previewTimer.current = setTimeout(() => setPreview(false), 2200);
    };
    window.addEventListener("mousemove", peek);
    window.addEventListener("mousedown", wake);
    window.addEventListener("keydown", wake);
    window.addEventListener("touchstart", wake);
    return () => {
      window.removeEventListener("mousemove", peek);
      window.removeEventListener("mousedown", wake);
      window.removeEventListener("keydown", wake);
      window.removeEventListener("touchstart", wake);
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, [onWake]);

  // Static stream layout, generated once.
  const streams = useMemo<StreamCfg[]>(() => {
    const count = 9;
    return Array.from({ length: count }, (_, i) => {
      const lines = Array.from({ length: 28 }, () => streamLine(i + Math.floor(Math.random() * 4)));
      return {
        left: `${(i + 0.5) * (100 / count)}%`,
        dir: i % 2 === 0 ? "down" : "up",
        speed: 16 + Math.random() * 26,
        color: RAINBOW[i % RAINBOW.length],
        size: 11 + Math.round(Math.random() * 4),
        opacity: 0.1 + Math.random() * 0.16,
        lines,
      };
    });
  }, []);

  const topAttacker: Attacker | undefined = useMemo(
    () => [...attackers].sort((a, b) => b.totalHits - a.totalHits)[0],
    [attackers]
  );

  // Synthetic-but-live attack feed: real live events when present, else derived
  // from tracked attackers, so the feed always scrolls with plausible data.
  const feed = useMemo(() => {
    const fromLive = live.slice(0, 18).map((e: LiveEvent) => {
      const atk = attackers.find((a) => a.ip === e.attackerIp);
      return {
        ip: e.attackerIp,
        flag: atk?.flag ?? "🏴",
        country: atk?.countryCode ?? "??",
        type: e.attackType || e.category || "EVENT",
        time: fmtTime(e.timestamp),
        sev: e.severity,
      };
    });
    if (fromLive.length >= 6) return fromLive;
    const filler = attackers.slice(0, 18).map((a, i) => ({
      ip: a.ip,
      flag: a.flag,
      country: a.countryCode,
      type: a.attackTypes[0] ?? ATTACK_TYPES[i % ATTACK_TYPES.length],
      time: fmtTime(a.lastSeen),
      sev: a.threatLevel,
    }));
    return [...fromLive, ...filler].slice(0, 18);
  }, [live, attackers]);

  const metrics = [
    { label: "EVENTS / MIN", value: fmtNum(counters.eventsPerMin), color: "#E040FB" },
    { label: "ACTIVE ATTACKERS", value: fmtNum(counters.activeAttackers), color: "#E91E8C" },
    { label: "QUEUE DEPTH", value: fmtNum(counters.queueDepth), color: "#FFD166" },
    { label: "PROCESSED TODAY", value: fmtNum(counters.processedToday), color: "#9D4EDD" },
    { label: "CPU", value: `${Math.round(hardware.cpuPercent)}%`, color: "#4ECDC4" },
    { label: "RAM", value: `${hardware.ramUsed.toFixed(1)}/${hardware.ramTotal}G`, color: "#C4607A" },
    { label: "TRACKED", value: fmtNum(attackers.length), color: "#F48FB1" },
    { label: "UPTIME", value: fmtUptime(hardware.uptimeSec), color: "#7B2FBE" },
  ];

  const sevColor = (sev: string) =>
    sev === "CRITICAL" ? "#FF2D2D" : sev === "HIGH" ? "#FF6B35" : sev === "MEDIUM" ? "#FFD166" : "#4ECDC4";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] overflow-hidden bg-[#040308] select-none cursor-none"
      data-testid="screensaver-ops"
    >
      {/* faint drifting geometric grid */}
      <div className="ops-grid" />

      {/* vertical data streams at varied speed/direction */}
      <div className={`absolute inset-0 transition-[filter] duration-500 ${preview ? "blur-md" : ""}`}>
        {streams.map((st, i) => (
          <div
            key={i}
            className={`ops-stream ${st.dir}`}
            style={
              {
                left: st.left,
                color: st.color,
                fontSize: st.size,
                opacity: st.opacity,
                ["--ops-speed" as string]: `${st.speed}s`,
                animationPlayState: preview ? "paused" : "running",
              } as React.CSSProperties
            }
          >
            <span className="ops-stream-inner" style={{ animationPlayState: preview ? "paused" : "running" }}>
              {[...st.lines, ...st.lines].map((l, j) => (
                <span key={j} className="block text-center">
                  {l}
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>

      {/* scanning beam */}
      <div
        className="ops-scan absolute left-0 right-0 h-24 pointer-events-none"
        style={{
          background: "linear-gradient(180deg, transparent, rgba(224,64,251,0.06), transparent)",
          animationPlayState: preview ? "paused" : "running",
        }}
      />

      {/* center: logo + title + pulsing top attacker */}
      <div className={`absolute inset-0 flex flex-col items-center justify-center transition-[filter] duration-500 ${preview ? "blur-[2px]" : ""}`}>
        <BifrostLogo className="w-24 h-24 opacity-30 float-soft" />
        <div className="text-2xl font-extrabold tracking-[0.45em] rainbow-text mt-4 pl-[0.45em]">BIFROST</div>
        <div className="text-[10px] tracking-[0.4em] text-muted-foreground mt-1">OPS CENTER · HEIMDALL WATCH</div>

        {topAttacker && (
          <div className="mt-10 flex flex-col items-center">
            <div className="text-[10px] tracking-[0.3em] text-muted-foreground mb-3">TOP ADVERSARY</div>
            <div className="relative flex items-center justify-center">
              <span
                className="ops-pulse-ring absolute w-20 h-20 rounded-full border-2"
                style={{ borderColor: sevColor(topAttacker.threatLevel), animationPlayState: preview ? "paused" : "running" }}
              />
              <span
                className="absolute w-20 h-20 rounded-full"
                style={{ boxShadow: `0 0 60px 4px ${sevColor(topAttacker.threatLevel)}55` }}
              />
              <div className="relative text-4xl">{topAttacker.flag}</div>
            </div>
            <div className="mt-4 font-mono text-lg text-white/90">{topAttacker.ip}</div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {topAttacker.country} · {fmtNum(topAttacker.totalHits)} hits ·{" "}
              <span style={{ color: sevColor(topAttacker.threatLevel) }}>{topAttacker.threatLevel}</span>
            </div>
          </div>
        )}
      </div>

      {/* floating live metrics */}
      <div className={`absolute inset-0 pointer-events-none transition-[filter] duration-500 ${preview ? "blur-[3px]" : ""}`}>
        {metrics.map((m, i) => {
          const positions = [
            { top: "12%", left: "8%" },
            { top: "20%", right: "9%" },
            { top: "40%", left: "5%" },
            { top: "48%", right: "6%" },
            { bottom: "30%", left: "10%" },
            { bottom: "24%", right: "11%" },
            { top: "30%", left: "22%" },
            { bottom: "34%", right: "23%" },
          ][i];
          return (
            <motion.div
              key={m.label}
              className="absolute glass-panel rounded-xl px-4 py-3 min-w-[120px]"
              style={{ ...positions, borderColor: `${m.color}55` }}
              animate={preview ? { y: 0, x: 0 } : { y: [0, -8, 0], x: [0, i % 2 ? 5 : -5, 0] }}
              transition={{ duration: 6 + i, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="text-[9px] tracking-[0.2em] text-muted-foreground">{m.label}</div>
              <div className="text-2xl font-bold font-mono mt-1" style={{ color: m.color }}>
                {m.value}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* scrolling attack feed (top, right-to-left) */}
      <div className="absolute top-6 left-0 right-0 px-2">
        <div className={`ops-marquee left transition-[filter] duration-500 ${preview ? "blur-sm" : ""}`}>
          <div className="ops-marquee-track text-xs font-mono" style={{ animationPlayState: preview ? "paused" : "running" }}>
            {[...feed, ...feed].map((f, i) => (
              <span key={i} className="inline-flex items-center gap-2 mx-5">
                <span>{f.flag}</span>
                <span className="text-white/80">{f.ip}</span>
                <span className="text-muted-foreground">{f.country}</span>
                <span style={{ color: sevColor(f.sev) }}>{f.type}</span>
                <span className="text-muted-foreground/60">{f.time}</span>
                <span className="text-[#9D4EDD]">›</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* scrolling glyph ticker (bottom, left-to-right) */}
      <div className="absolute bottom-6 left-0 right-0 px-2">
        <div className={`ops-marquee right transition-[filter] duration-500 ${preview ? "blur-sm" : ""}`}>
          <div className="ops-marquee-track text-xs font-mono text-[#9D4EDD]/70" style={{ animationPlayState: preview ? "paused" : "running" }}>
            {[...ATTACK_TYPES, ...ATTACK_TYPES, ...ATTACK_TYPES].map((t, i) => (
              <span key={i} className="inline-flex items-center gap-2 mx-6">
                <span>{GLYPHS[i % GLYPHS.length]}</span>
                <span>{t}</span>
                <span className="text-muted-foreground/40">::</span>
                <span className="text-[#4ECDC4]/60">{randHex(6)}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* preview hint */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-16 text-[11px] text-muted-foreground/60 font-mono">
        {preview ? "Click or press a key to return" : "Move the mouse to peek · click to return"}
      </div>
    </motion.div>
  );
}

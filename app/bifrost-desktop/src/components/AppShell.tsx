import { Link, useLocation } from "wouter";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard, ShieldAlert, Crosshair, Radio, Activity,
  Grid3x3, Settings as SettingsIcon, ScrollText, Minus, Square, X,
  Hammer, BrainCircuit, Eye,
} from "lucide-react";
import { BifrostLogo } from "./BifrostLogo";
import { useRollingNumber } from "./SplitFlap";
import { useGuardian, useConnection, computeOverview } from "@/lib/api";
import { useMood, MOOD_CLASS } from "@/lib/mood";
import { fmtUptime, fmtNum } from "@/lib/format";
import { isTauri, minimizeWindow, toggleMaximize, closeWindow } from "@/lib/tauri";

const NAV = [
  { path: "/overview", label: "Overview", icon: LayoutDashboard },
  { path: "/heimdall", label: "Heimdall Speaks", icon: Eye },
  { path: "/incidents", label: "Incidents", icon: ShieldAlert },
  { path: "/attackers", label: "Attackers", icon: Crosshair },
  { path: "/live", label: "Live Monitor", icon: Radio },
  { path: "/timeline", label: "Timeline", icon: Activity },
  { path: "/mitre", label: "MITRE ATT&CK", icon: Grid3x3 },
  { path: "/mjolnir", label: "Mjolnir", icon: Hammer },
  { path: "/analyst", label: "Analyst Matrix", icon: BrainCircuit },
  { path: "/settings", label: "Settings", icon: SettingsIcon },
  { path: "/legal", label: "Legal", icon: ScrollText },
];

function ConnectionStatus() {
  const conn = useConnection();
  const ok = conn.status === "connected";
  return (
    <div className="flex items-center gap-2 text-xs font-mono no-drag">
      <span
        className="w-2 h-2 rounded-full"
        style={{
          background: ok ? "#4ECDC4" : "#FF2D2D",
          boxShadow: `0 0 8px ${ok ? "#4ECDC4" : "#FF2D2D"}`,
        }}
      />
      {ok ? (
        <span className="text-[#4ECDC4]">Connected</span>
      ) : (
        <span className="text-[#FF6B35]">
          Disconnected{conn.retryInSec > 0 ? ` · retry ${conn.retryInSec}s` : ""}
        </span>
      )}
    </div>
  );
}

function StatusTicker() {
  const { aiModel, hardware, counters, incidents, attackers } = useGuardian();
  const ram = useRollingNumber(hardware.ramUsed, { decimals: 1 });
  const cpu = useRollingNumber(hardware.cpuPercent, { decimals: 0 });
  const blockedPct = computeOverview(incidents, attackers.length, counters.processedToday).blockedPct;

  const items: { label: string; value: string }[] = [
    { label: "Model", value: aiModel.model },
    { label: "RAM", value: `${ram} / ${hardware.ramTotal}G` },
    { label: "CPU", value: `${cpu}%` },
    { label: "Uptime", value: fmtUptime(hardware.uptimeSec) },
    { label: "Active Attackers", value: fmtNum(counters.activeAttackers) },
    { label: "Events Today", value: fmtNum(counters.processedToday) },
    { label: "Blocked", value: `${blockedPct}%` },
  ];

  const Group = () => (
    <div className="inline-flex items-center" aria-hidden="true">
      {items.map((it, i) => (
        <span key={i} className="inline-flex items-center">
          <span className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground/55 mr-2">
            {it.label}
          </span>
          <span className="ticker-value text-[12px] font-semibold tracking-tight">{it.value}</span>
          <span className="ticker-sep" />
        </span>
      ))}
    </div>
  );

  return (
    <div className="hidden lg:block no-drag w-[440px] xl:w-[600px] overflow-hidden ticker-mask">
      <div className="ticker-track">
        <Group />
        <Group />
      </div>
    </div>
  );
}

function WindowControls() {
  if (!isTauri()) return null;
  return (
    <div className="flex items-center gap-1 no-drag ml-2">
      <button onClick={minimizeWindow} className="p-1.5 rounded hover:bg-white/10 transition-colors" aria-label="Minimize">
        <Minus className="w-3.5 h-3.5" />
      </button>
      <button onClick={toggleMaximize} className="p-1.5 rounded hover:bg-white/10 transition-colors" aria-label="Maximize">
        <Square className="w-3 h-3" />
      </button>
      <button onClick={closeWindow} className="p-1.5 rounded hover:bg-[#FF2D2D]/80 transition-colors" aria-label="Close">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const mood = useMood();
  const active = (p: string) => location === p || (p === "/overview" && (location === "/" || location === ""));

  return (
    <div className={`h-screen w-full bg-background p-[2px] active-border ${MOOD_CLASS[mood]} overflow-hidden`}>
      <div className="h-full w-full flex flex-col rounded-[10px] bg-background/95 overflow-hidden relative">
        {/* ambient aurora */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.18]">
          <div className="absolute top-0 left-1/4 w-1/2 h-1/2 bg-[#7B2FBE] blur-[160px]" />
          <div className="absolute bottom-0 right-1/4 w-1/2 h-1/2 bg-[#E040FB] blur-[160px]" />
        </div>

        {/* title bar */}
        <header className="drag-region h-11 shrink-0 flex items-center justify-between px-4 border-b border-border/50 glass-panel z-20 group">
          <div className="flex items-center gap-2 no-drag">
            <span className="icon-ring inline-flex p-0.5">
              <BifrostLogo className="w-5 h-5 group-hover:rotate-3 transition-transform" />
            </span>
            <span className="text-sm font-bold tracking-wide rainbow-text">BIFROST</span>
          </div>
          <div className="flex items-center gap-4">
            <StatusTicker />
            <ConnectionStatus />
            <WindowControls />
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden z-10">
          {/* sidebar */}
          <aside className="w-60 shrink-0 border-r border-border/50 bg-sidebar/60 glass-panel flex flex-col">
            <div className="px-5 py-5 border-b border-border/40 flex items-center gap-3">
              <span className="icon-ring inline-flex p-1 float-soft">
                <BifrostLogo className="w-9 h-9" />
              </span>
              <div>
                <div className="font-extrabold tracking-wide leading-none">BIFROST</div>
                <div className="text-[10px] tracking-[0.25em] text-muted-foreground mt-1">RAINBOW BRIDGE</div>
              </div>
            </div>
            <nav className="flex-1 p-3 flex flex-col gap-1 overflow-auto scroll-thin">
              {NAV.map((n) => {
                const Icon = n.icon;
                const on = active(n.path);
                return (
                  <Link key={n.path} href={n.path}>
                    <div
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-all ${
                        on ? "nav-active font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {n.label}
                    </div>
                  </Link>
                );
              })}
            </nav>
            <div className="p-4 border-t border-border/40">
              <div className="text-[10px] text-muted-foreground font-mono leading-relaxed">
                The Bridge Is Watched.
                <br />
                Heimdall Never Sleeps.
              </div>
            </div>
          </aside>

          {/* content */}
          <motion.main
            key={location}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="flex-1 overflow-auto scroll-thin p-6"
          >
            {children}
          </motion.main>
        </div>
      </div>
    </div>
  );
}

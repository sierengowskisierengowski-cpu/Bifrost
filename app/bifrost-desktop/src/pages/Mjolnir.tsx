import { AnimatePresence, motion } from "framer-motion";
import { Hammer, ShieldCheck, ShieldOff, Bug, Zap, ScrollText } from "lucide-react";
import { PageHeader, Toggle } from "@/components/shared";
import {
  useCountermeasures,
  setTrapDeployed,
  deployAllTraps,
  recallAllTraps,
} from "@/lib/countermeasures";
import { fmtDateTime } from "@/lib/format";

export default function Mjolnir() {
  const { traps, log } = useCountermeasures();
  const deployedCount = traps.filter((t) => t.deployed).length;
  const allDeployed = deployedCount === traps.length;

  return (
    <div>
      <PageHeader
        title="Mjolnir"
        desc="The hammer that strikes back — deploy deception traps to mislead and unmask intruders"
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={recallAllTraps}
              disabled={deployedCount === 0}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold bg-white/5 border border-border hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ShieldOff className="w-4 h-4" /> Recall all
            </button>
            <button
              onClick={deployAllTraps}
              disabled={allDeployed}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold rainbow-bg text-white disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Zap className="w-4 h-4" /> Deploy all traps
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Stat label="Traps deployed" value={`${deployedCount} / ${traps.length}`} accent="#E040FB" />
        <Stat
          label="Deception status"
          value={deployedCount > 0 ? "Armed" : "Idle"}
          accent={deployedCount > 0 ? "#4ECDC4" : "#6B7280"}
        />
        <Stat label="Trap events logged" value={String(log.length)} accent="#9D4EDD" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {traps.map((t) => (
          <div
            key={t.id}
            className={`glass-panel rounded-xl p-5 transition-colors ${t.deployed ? "glow-low" : ""}`}
            style={t.deployed ? { borderColor: "rgba(78,205,196,0.5)" } : undefined}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <span className={t.deployed ? "text-[#4ECDC4]" : "text-[#E040FB]"}>
                  <Bug className="w-4 h-4" />
                </span>
                <h3 className="font-semibold">{t.name}</h3>
              </div>
              <Toggle
                checked={t.deployed}
                onChange={(v) => setTrapDeployed(t.id, v)}
                label=""
                accent="#4ECDC4"
              />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{t.description}</p>
            {t.deployed && t.deployedAt && (
              <div className="text-[10px] font-mono text-[#4ECDC4] mt-3 flex items-center gap-1.5">
                <ShieldCheck className="w-3 h-3" /> Active since {fmtDateTime(t.deployedAt)}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="glass-panel rounded-xl p-5 mt-4">
        <div className="flex items-center gap-2 mb-4">
          <ScrollText className="w-4 h-4 text-[#9D4EDD]" />
          <h3 className="font-semibold">Trap deployment log</h3>
        </div>
        {log.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground font-mono">
            No trap activity yet. Deploy a trap to begin.
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-auto scroll-thin">
            <AnimatePresence initial={false}>
              {log.map((e) => (
                <motion.div
                  key={e.id}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-between gap-3 rounded-lg bg-black/30 px-3 py-2 text-xs"
                >
                  <span className="text-foreground/90">{e.message}</span>
                  <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                    {fmtDateTime(e.timestamp)}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="glass-panel rounded-xl p-5 relative overflow-hidden">
      <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-25" style={{ background: accent }} />
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <Hammer className="w-4 h-4" style={{ color: accent }} />
      </div>
      <div className="text-2xl font-bold font-mono tracking-tight" style={{ color: accent }}>
        {value}
      </div>
    </div>
  );
}

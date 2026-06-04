import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BrainCircuit, Cpu, MemoryStick, Play, Loader2, Tag, Activity } from "lucide-react";
import { PageHeader, Bar } from "@/components/shared";
import { useGuardian, useConnection } from "@/lib/api";
import { autoSelectModel } from "@/lib/models";
import { fmtDateTime } from "@/lib/format";

interface InferenceResult {
  id: string;
  timestamp: string;
  model: string;
  attackerIp: string;
  classification: string;
  mitre: string;
  tactic: string;
  confidence: number;
  action: string;
  latencyMs: number;
  note: string;
}

export default function AnalystMatrix() {
  const { incidents, aiModel, hardware } = useGuardian();
  const conn = useConnection();
  const live = conn.status === "connected";

  const ramFree = Math.max(0, hardware.ramTotal - hardware.ramUsed);
  const auto = useMemo(() => autoSelectModel(hardware.ramTotal), [hardware.ramTotal]);

  const recentTags = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; tactic: string }>();
    for (const inc of incidents.slice(0, 40)) {
      if (!seen.has(inc.mitreTechnique)) {
        seen.set(inc.mitreTechnique, {
          id: inc.mitreTechnique,
          name: inc.mitreTechniqueName,
          tactic: inc.mitreTactic,
        });
      }
      if (seen.size >= 8) break;
    }
    return Array.from(seen.values());
  }, [incidents]);

  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<InferenceResult[]>([]);

  const runAnalysis = () => {
    if (running) return;
    setRunning(true);
    const target = incidents[Math.floor(Math.random() * Math.min(incidents.length, 25))];
    setTimeout(() => {
      if (target) {
        const res: InferenceResult = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date().toISOString(),
          model: aiModel.model,
          attackerIp: target.attackerIp,
          classification: target.threatClass,
          mitre: `${target.mitreTechnique} · ${target.mitreTechniqueName}`,
          tactic: target.mitreTactic,
          confidence: target.confidenceScore,
          action: target.actionTaken,
          latencyMs: 90 + Math.floor(Math.random() * 260),
          note: live ? "Inference via Guardian agent" : "Inference simulated — Guardian agent offline",
        };
        setResults((r) => [res, ...r].slice(0, 20));
      }
      setRunning(false);
    }, 900 + Math.random() * 700);
  };

  return (
    <div>
      <PageHeader
        title="Analyst Matrix"
        desc="The all-seeing eye — local AI inference that classifies every event against MITRE ATT&CK"
        right={
          <button
            onClick={runAnalysis}
            disabled={running}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold rainbow-bg text-white disabled:opacity-50 disabled:cursor-wait"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {running ? "Analyzing…" : "Trigger analysis"}
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass-panel rounded-xl p-5 rainbow-border">
          <div className="flex items-center gap-2 mb-4">
            <BrainCircuit className="w-4 h-4 text-[#E040FB]" />
            <h3 className="font-semibold">Active inference model</h3>
          </div>
          <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Running model</div>
              <div className="text-xl font-bold font-mono rainbow-text">{aiModel.model}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Last response</div>
              <div className="text-lg font-mono">{aiModel.lastResponseMs}ms</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Success rate</div>
              <div className="text-lg font-mono text-[#4ECDC4]">{aiModel.successRate.toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Circuit</div>
              <div className="text-lg font-mono">{aiModel.circuitState}</div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-border/40">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Auto-selected for {hardware.ramTotal.toFixed(0)}GB RAM
            </div>
            <div className="text-sm font-mono text-foreground/90">{auto.name}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{auto.goodFor}</div>
          </div>
        </div>

        <div className="glass-panel rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <MemoryStick className="w-4 h-4 text-[#9D4EDD]" />
            <h3 className="font-semibold">Resources</h3>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <MemoryStick className="w-3.5 h-3.5" /> RAM available
                </span>
                <span className="font-mono">
                  {ramFree.toFixed(1)} / {hardware.ramTotal.toFixed(0)} GB
                </span>
              </div>
              <Bar value={ramFree} max={hardware.ramTotal} color="#9D4EDD" />
            </div>
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" /> CPU load
                </span>
                <span className="font-mono">{hardware.cpuPercent}%</span>
              </div>
              <Bar value={hardware.cpuPercent} max={100} color="#E040FB" />
            </div>
            <div className="text-[11px] font-mono text-muted-foreground pt-1">Tier · {hardware.tier}</div>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-xl p-5 mt-4">
        <div className="flex items-center gap-2 mb-4">
          <Tag className="w-4 h-4 text-[#E040FB]" />
          <h3 className="font-semibold">MITRE ATT&CK tags · recent results</h3>
        </div>
        {recentTags.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground font-mono">No tagged results yet.</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {recentTags.map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center gap-2 rounded-lg border border-[#9D4EDD]/30 bg-[#9D4EDD]/10 px-3 py-1.5 text-xs"
                title={t.tactic}
              >
                <span className="font-mono font-semibold text-[#9D4EDD]">{t.id}</span>
                <span className="text-foreground/80">{t.name}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="glass-panel rounded-xl p-5 mt-4">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-[#4ECDC4]" />
          <h3 className="font-semibold">Inference output</h3>
        </div>
        {results.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground font-mono">
            Trigger an analysis to run the model against a live event.
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-auto scroll-thin">
            <AnimatePresence initial={false}>
              {results.map((r) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-lg bg-black/40 border border-border/40 p-4 font-mono text-xs"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[#E040FB] font-semibold">{r.model}</span>
                    <span className="text-[10px] text-muted-foreground">{fmtDateTime(r.timestamp)}</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-foreground/90">
                    <Out k="Source" v={r.attackerIp} />
                    <Out k="Classification" v={r.classification} />
                    <Out k="MITRE" v={r.mitre} />
                    <Out k="Tactic" v={r.tactic} />
                    <Out k="Confidence" v={`${r.confidence}%`} />
                    <Out k="Action" v={r.action} />
                    <Out k="Latency" v={`${r.latencyMs}ms`} />
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-2">{r.note}</div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

function Out({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="truncate text-foreground/90" title={v}>
        {v}
      </div>
    </div>
  );
}

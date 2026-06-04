import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X, Fingerprint, KeyRound, Terminal, Clock, Users, ChevronDown } from "lucide-react";
import { useGuardian } from "@/lib/api";
import type { Attacker, ThreatLevel } from "@/lib/types";
import { PageHeader, SeverityBadge, FilterSelect } from "@/components/shared";
import { fmtNum, fmtRelative, fmtDateTime, fmtDuration } from "@/lib/format";
import { findDoppelgangers, maskedIpCount, type Doppelganger } from "@/lib/doppelganger";

type Sort = "hits" | "recent";
const LEVELS: ThreatLevel[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];

export default function Attackers() {
  const { attackers } = useGuardian();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("hits");
  const [level, setLevel] = useState<ThreatLevel | "ALL">("ALL");
  const [sel, setSel] = useState<Attacker | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => {
    let r = [...attackers];
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      r = r.filter((a) => a.ip.includes(t) || a.country.toLowerCase().includes(t));
    }
    if (level !== "ALL") r = r.filter((a) => a.threatLevel === level);
    r.sort((a, b) => (sort === "hits" ? b.totalHits - a.totalHits : +new Date(b.lastSeen) - +new Date(a.lastSeen)));
    return r;
  }, [attackers, q, sort, level]);

  const clusters = useMemo(() => findDoppelgangers(attackers), [attackers]);

  const v = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 8,
  });

  return (
    <div>
      <PageHeader
        title="Attackers"
        desc={`${rows.length} adversaries tracked`}
        right={
          <div className="flex items-center gap-3">
            <FilterSelect
              ariaLabel="Filter by threat level"
              value={level}
              onChange={(v) => setLevel(v as ThreatLevel | "ALL")}
              options={[{ value: "ALL", label: "All threat levels" }, ...LEVELS.map((l) => ({ value: l, label: l }))]}
            />
            <FilterSelect
              ariaLabel="Sort attackers"
              value={sort}
              onChange={(v) => setSort(v as Sort)}
              options={[{ value: "hits", label: "Sort: Most hits" }, { value: "recent", label: "Sort: Most recent" }]}
            />
            <div className="flex items-center gap-2 bg-black/40 border border-border rounded-lg px-3">
              <Search className="w-3.5 h-3.5 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="IP or country" className="bg-transparent py-2 text-xs font-mono outline-none w-36" />
            </div>
          </div>
        }
      />

      {clusters.length > 0 && <DoppelgangerPanel clusters={clusters} onPick={setSel} />}

      <div className="glass-panel rounded-xl overflow-hidden">
        <div className="grid grid-cols-[40px_1fr_120px_110px_110px_110px] gap-3 px-4 py-3 border-b border-border/50 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          <span></span><span>Attacker</span><span>Threat</span><span>Total Hits</span><span>Attack Types</span><span>Last Seen</span>
        </div>
        <div ref={parentRef} className="overflow-auto scroll-thin" style={{ height: "calc(100vh - 280px)" }}>
          <div style={{ height: v.getTotalSize(), position: "relative" }}>
            {v.getVirtualItems().map((vi: { index: number; start: number; size: number }) => {
              const a = rows[vi.index];
              return (
                <button
                  key={a.ip}
                  onClick={() => setSel(a)}
                  className="absolute left-0 right-0 grid grid-cols-[40px_1fr_120px_110px_110px_110px] gap-3 px-4 items-center text-left hover:bg-white/[0.03] border-b border-white/5 group"
                  style={{ top: vi.start, height: vi.size }}
                >
                  <span className="text-2xl leading-none">{a.flag}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-mono text-[#9D4EDD] truncate">{a.ip}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{a.country}</div>
                  </div>
                  <SeverityBadge severity={a.threatLevel} />
                  <span className="text-sm font-mono">{fmtNum(a.totalHits)}</span>
                  <span className="text-[10px] text-muted-foreground truncate">{a.attackTypes.slice(0, 2).join(", ")}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">{fmtRelative(a.lastSeen)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {sel && <AttackerDrawer attacker={sel} onClose={() => setSel(null)} />}
      </AnimatePresence>
    </div>
  );
}

function DoppelgangerPanel({ clusters, onPick }: { clusters: Doppelganger[]; onPick: (a: Attacker) => void }) {
  const [open, setOpen] = useState(true);
  const masked = maskedIpCount(clusters);

  return (
    <div className="glass-panel rounded-xl mb-4 border border-[#7B2FBE]/30">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-[#E040FB]"><Users className="w-4 h-4" /></span>
          <div>
            <div className="text-sm font-semibold">Doppelgänger detection</div>
            <div className="text-[11px] text-muted-foreground">
              {clusters.length} actor{clusters.length === 1 ? "" : "s"} wearing {masked} IP masks — same fingerprint, different addresses
            </div>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {clusters.map((c, i) => (
            <div key={c.id} className="rounded-lg bg-black/30 border border-white/5 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#9D4EDD]">Actor #{i + 1}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {c.members.length} IPs · {c.countries.length} countr{c.countries.length === 1 ? "y" : "ies"} · {fmtNum(c.totalHits)} hits
                  </span>
                </div>
                <div className="flex gap-1">
                  {c.signals.map((s) => (
                    <span key={s} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#7B2FBE]/20 text-[#E040FB] border border-[#7B2FBE]/30">
                      {s} match
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {c.members.map((m) => (
                  <button
                    key={m.ip}
                    onClick={() => onPick(m)}
                    className="flex items-center gap-1.5 text-[11px] font-mono px-2 py-1 rounded-md bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 transition-colors"
                    title={`${m.country} · ${fmtNum(m.totalHits)} hits`}
                  >
                    <span>{m.flag}</span>
                    <span className="text-foreground/90">{m.ip}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AttackerDrawer({ attacker: a, onClose }: { attacker: Attacker; onClose: () => void }) {
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-40 bg-black/60" />
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 220, damping: 28 }}
        className="fixed right-0 top-0 bottom-0 z-50 w-[480px] max-w-[92vw] glass-panel border-l border-border/60 overflow-auto scroll-thin"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-border/50 bg-background/80 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{a.flag}</span>
            <div>
              <div className="font-mono text-[#9D4EDD]">{a.ip}</div>
              <div className="text-xs text-muted-foreground">{a.country}</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <Mini label="Threat"><SeverityBadge severity={a.threatLevel} /></Mini>
            <Mini label="Total Hits"><span className="font-mono">{fmtNum(a.totalHits)}</span></Mini>
            <Mini label="First Seen"><span className="font-mono text-[11px]">{fmtRelative(a.firstSeen)}</span></Mini>
          </div>

          <Section icon={<Fingerprint className="w-3.5 h-3.5" />} title="Fingerprints">
            <Row k="HASSH" v={a.hassh} />
            <Row k="JA4" v={a.ja4} />
            <Row k="Attack types" v={a.attackTypes.join(", ")} />
          </Section>

          <Section icon={<KeyRound className="w-3.5 h-3.5" />} title={`Credential Attempts (${a.credentials.length})`}>
            <div className="max-h-44 overflow-auto scroll-thin">
              {a.credentials.map((c, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 text-xs font-mono border-b border-white/5 last:border-0">
                  <span className="text-foreground">{c.username}</span>
                  <span className="text-muted-foreground">{"•".repeat(Math.min(12, Math.max(4, c.password.length)))}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section icon={<Terminal className="w-3.5 h-3.5" />} title={`Recent Events (${a.events.length})`}>
            <div className="max-h-56 overflow-auto scroll-thin space-y-2">
              {a.events.map((e, i) => (
                <div key={i} className="rounded-lg bg-black/30 p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <SeverityBadge severity={e.severity} />
                    <span className="text-[10px] font-mono text-muted-foreground">{fmtDateTime(e.timestamp)}</span>
                  </div>
                  <div className="text-[11px] font-mono text-foreground/90 break-all">{e.command}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">{e.type} → {e.decision}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section icon={<Clock className="w-3.5 h-3.5" />} title={`Sessions (${a.sessions.length})`}>
            {a.sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-1.5 text-xs font-mono border-b border-white/5 last:border-0">
                <span className="text-muted-foreground">{fmtDateTime(s.start)}</span>
                <span>{fmtDuration(s.durationSec)}</span>
                <span className="text-muted-foreground">{s.commands} cmds</span>
              </div>
            ))}
          </Section>
        </div>
      </motion.div>
    </>
  );
}

function Mini({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-black/30 p-3">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1.5">{label}</div>
      {children}
    </div>
  );
}
function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-xs font-semibold text-foreground mb-2">
        <span className="text-[#E040FB]">{icon}</span> {title}
      </div>
      <div className="glass-panel rounded-lg p-3">{children}</div>
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between py-1 text-xs">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono text-foreground/90 truncate ml-3 max-w-[260px]">{v}</span>
    </div>
  );
}

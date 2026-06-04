import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Activity, ShieldAlert, ShieldCheck, Crosshair, Clock, Flame } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, Cell } from "recharts";
import { useGuardian, filterByRange, computeOverview, buildBuckets } from "@/lib/api";
import type { TimeRange, Incident } from "@/lib/types";
import { StatCard, RangePills, PageHeader, SeverityBadge, Modal } from "@/components/shared";
import { useGreeting } from "@/lib/greeting";
import { fmtNum, fmtRelative } from "@/lib/format";

type ModalKey = "events" | "incidents" | "blocked" | "attackers" | "lastHour" | "criticalHigh" | null;

export default function Overview() {
  const { incidents, attackers, counters } = useGuardian();
  const [range, setRange] = useState<TimeRange>("24H");
  const [modal, setModal] = useState<ModalKey>(null);

  const filtered = useMemo(() => filterByRange(incidents, range), [incidents, range]);
  const stats = useMemo(
    () => computeOverview(filtered, attackers.length, counters.processedToday),
    [filtered, attackers.length, counters.processedToday]
  );
  const buckets = useMemo(() => buildBuckets(filtered, range), [filtered, range]);
  const recent = filtered.slice(0, 100);
  const greeting = useGreeting();

  return (
    <div>
      <PageHeader
        title="Overview"
        desc="Heimdall's watch over the rainbow bridge"
        right={<RangePills value={range} onChange={setRange} />}
      />

      {greeting && (
        <div className="mb-5 -mt-2 text-sm font-medium rainbow-text" data-testid="text-overview-greeting">
          {greeting}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <StatCard label="Total Events" value={fmtNum(stats.totalEvents)} icon={<Activity className="w-4 h-4" />} accent="#9D4EDD" delay={0} onClick={() => setModal("events")} />
        <StatCard label="Incidents" value={fmtNum(stats.incidents)} icon={<ShieldAlert className="w-4 h-4" />} accent="#E040FB" delay={0.05} onClick={() => setModal("incidents")} />
        <StatCard label="Blocked" value={`${stats.blockedPct}%`} icon={<ShieldCheck className="w-4 h-4" />} accent="#4ECDC4" delay={0.1} onClick={() => setModal("blocked")} />
        <StatCard label="Unique Attackers" value={fmtNum(stats.uniqueAttackers)} icon={<Crosshair className="w-4 h-4" />} accent="#C4607A" delay={0.15} onClick={() => setModal("attackers")} />
        <StatCard label="Last Hour" value={fmtNum(stats.lastHour)} icon={<Clock className="w-4 h-4" />} accent="#E91E8C" delay={0.2} onClick={() => setModal("lastHour")} />
        <StatCard label="Critical + High" value={fmtNum(stats.criticalHigh)} icon={<Flame className="w-4 h-4" />} accent="#FF6B35" delay={0.25} onClick={() => setModal("criticalHigh")} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="glass-panel rounded-xl p-5 xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Activity Timeline</h3>
            <span className="text-xs text-muted-foreground font-mono">{range}</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={buckets}>
              <defs>
                <linearGradient id="rainbowBar" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="#7B2FBE" />
                  <stop offset="50%" stopColor="#E040FB" />
                  <stop offset="100%" stopColor="#F48FB1" />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fill: "#888", fontSize: 10, fontFamily: "JetBrains Mono" }} interval="preserveStartEnd" />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                contentStyle={{ background: "#0c0c0c", border: "1px solid #222", borderRadius: 8, fontSize: 12, fontFamily: "JetBrains Mono" }}
                labelStyle={{ color: "#E040FB" }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="url(#rainbowBar)">
                {buckets.map((_, i) => (
                  <Cell key={i} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-panel rounded-xl p-5 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Recent Incidents</h3>
            <Link href="/incidents">
              <span className="text-xs text-[#E040FB] hover:underline cursor-pointer">View all</span>
            </Link>
          </div>
          <div className="overflow-auto scroll-thin -mr-2 pr-2" style={{ maxHeight: 220 }}>
            {recent.map((inc) => (
              <div
                key={inc.id}
                className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0 hover:bg-white/[0.03] rounded px-1"
              >
                <SeverityBadge severity={inc.severity} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs truncate">{inc.threatClass}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{inc.attackerIp}</div>
                </div>
                <div className="text-[10px] text-muted-foreground font-mono shrink-0">{fmtRelative(inc.timestamp)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-6 text-xs text-muted-foreground font-mono glass-panel rounded-xl px-5 py-3">
        <span>events/min <span className="text-foreground">{counters.eventsPerMin}</span></span>
        <span>active attackers <span className="text-foreground">{counters.activeAttackers}</span></span>
        <span>queue depth <span className="text-foreground">{counters.queueDepth}</span></span>
        <span>processed today <span className="text-foreground">{fmtNum(counters.processedToday)}</span></span>
      </div>

      <StatModals
        modal={modal}
        onClose={() => setModal(null)}
        range={range}
        incidents={filtered}
        attackers={attackers}
        stats={stats}
        counters={counters}
      />
    </div>
  );
}

function StatModals({
  modal,
  onClose,
  range,
  incidents,
  attackers,
  stats,
  counters,
}: {
  modal: ModalKey;
  onClose: () => void;
  range: TimeRange;
  incidents: Incident[];
  attackers: ReturnType<typeof useGuardian>["attackers"];
  stats: ReturnType<typeof computeOverview>;
  counters: ReturnType<typeof useGuardian>["counters"];
}) {
  const lastHour = useMemo(() => {
    const cut = Date.now() - 3600_000;
    return incidents.filter((i) => +new Date(i.timestamp) >= cut);
  }, [incidents]);
  const blocked = useMemo(() => incidents.filter((i) => i.actionTaken !== "MONITORED"), [incidents]);
  const critHigh = useMemo(() => incidents.filter((i) => i.severity === "CRITICAL" || i.severity === "HIGH"), [incidents]);

  const blockedByAction = useMemo(() => groupBy(blocked, (i) => i.actionTaken), [blocked]);
  const topAttackers = useMemo(() => [...attackers].sort((a, b) => b.totalHits - a.totalHits).slice(0, 12), [attackers]);

  return (
    <>
      <Modal open={modal === "events"} onClose={onClose} title="Total Events" desc={`Processed today · ${range} view`} accent="#9D4EDD" icon={<Activity className="w-4 h-4" />}>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <StatBox label="Processed today" value={fmtNum(stats.totalEvents)} />
          <StatBox label="Events / min" value={fmtNum(counters.eventsPerMin)} />
          <StatBox label="Active attackers" value={fmtNum(counters.activeAttackers)} />
          <StatBox label="Queue depth" value={fmtNum(counters.queueDepth)} />
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Every connection the bridge sees is an event. Most are noise; the guardian only escalates the ones that look
          hostile into incidents. Run the downloadable agent to feed this dashboard real traffic from your machine.
        </p>
      </Modal>

      <Modal open={modal === "incidents"} onClose={onClose} title="Incidents" desc={`${incidents.length} in the ${range} window`} accent="#E040FB" icon={<ShieldAlert className="w-4 h-4" />}>
        <SeverityBreakdown incidents={incidents} />
        <IncidentList incidents={incidents.slice(0, 40)} />
      </Modal>

      <Modal open={modal === "blocked"} onClose={onClose} title="Blocked" desc={`${stats.blockedPct}% of incidents had an action taken`} accent="#4ECDC4" icon={<ShieldCheck className="w-4 h-4" />}>
        <div className="space-y-2 mb-4">
          {blockedByAction.length === 0 ? (
            <div className="text-xs text-muted-foreground font-mono py-4 text-center">Nothing blocked in this window.</div>
          ) : (
            blockedByAction.map(([action, list]) => (
              <div key={action} className="flex items-center justify-between rounded-lg bg-black/30 px-3 py-2">
                <span className="text-xs font-mono">{action}</span>
                <span className="text-xs font-mono text-[#4ECDC4]">{fmtNum(list.length)}</span>
              </div>
            ))
          )}
        </div>
        <IncidentList incidents={blocked.slice(0, 30)} />
      </Modal>

      <Modal open={modal === "attackers"} onClose={onClose} title="Unique Attackers" desc={`${attackers.length} adversaries tracked`} accent="#C4607A" icon={<Crosshair className="w-4 h-4" />}>
        <div className="space-y-1.5">
          {topAttackers.map((a) => (
            <div key={a.ip} className="flex items-center gap-3 rounded-lg bg-black/30 px-3 py-2">
              <span className="text-lg leading-none">{a.flag}</span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-mono text-[#9D4EDD] truncate">{a.ip}</div>
                <div className="text-[10px] text-muted-foreground truncate">{a.country} · {a.attackTypes.slice(0, 2).join(", ")}</div>
              </div>
              <SeverityBadge severity={a.threatLevel} />
              <span className="text-xs font-mono shrink-0">{fmtNum(a.totalHits)}</span>
            </div>
          ))}
        </div>
        <Link href="/attackers">
          <span className="mt-4 inline-block text-xs text-[#E040FB] hover:underline cursor-pointer" onClick={onClose}>Open full attacker registry →</span>
        </Link>
      </Modal>

      <Modal open={modal === "lastHour"} onClose={onClose} title="Last Hour" desc={`${lastHour.length} incidents in the past 60 minutes`} accent="#E91E8C" icon={<Clock className="w-4 h-4" />}>
        <SeverityBreakdown incidents={lastHour} />
        {lastHour.length === 0 ? (
          <div className="text-xs text-muted-foreground font-mono py-4 text-center">The bridge has been quiet this hour.</div>
        ) : (
          <IncidentList incidents={lastHour.slice(0, 40)} />
        )}
      </Modal>

      <Modal open={modal === "criticalHigh"} onClose={onClose} title="Critical + High" desc={`${critHigh.length} high-severity incidents`} accent="#FF6B35" icon={<Flame className="w-4 h-4" />}>
        <SeverityBreakdown incidents={critHigh} />
        <IncidentList incidents={critHigh.slice(0, 40)} />
      </Modal>
    </>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/30 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className="text-lg font-bold font-mono rainbow-text">{value}</div>
    </div>
  );
}

function SeverityBreakdown({ incidents }: { incidents: Incident[] }) {
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const i of incidents) c[i.severity] = (c[i.severity] || 0) + 1;
    return c;
  }, [incidents]);
  const order = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const;
  const present = order.filter((s) => counts[s]);
  if (present.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {present.map((s) => (
        <div key={s} className="flex items-center gap-2 rounded-lg bg-black/30 px-2.5 py-1.5">
          <SeverityBadge severity={s} />
          <span className="text-xs font-mono">{fmtNum(counts[s])}</span>
        </div>
      ))}
    </div>
  );
}

function IncidentList({ incidents }: { incidents: Incident[] }) {
  if (incidents.length === 0) return null;
  return (
    <div className="space-y-1.5">
      {incidents.map((inc) => (
        <div key={inc.id} className="flex items-center gap-3 rounded-lg bg-black/30 px-3 py-2">
          <SeverityBadge severity={inc.severity} />
          <div className="min-w-0 flex-1">
            <div className="text-xs truncate">{inc.threatClass}</div>
            <div className="text-[10px] text-muted-foreground font-mono truncate">{inc.attackerIp} · {inc.mitreTechnique}</div>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono shrink-0">{fmtRelative(inc.timestamp)}</span>
        </div>
      ))}
    </div>
  );
}

function groupBy<T>(items: T[], key: (t: T) => string): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const arr = map.get(k) ?? [];
    arr.push(it);
    map.set(k, arr);
  }
  return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
}

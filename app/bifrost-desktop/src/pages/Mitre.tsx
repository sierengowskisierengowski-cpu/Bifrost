import { useMemo, useState } from "react";
import { Grid3x3, ChevronRight } from "lucide-react";
import { useGuardian, buildMitre } from "@/lib/api";
import { PageHeader, SeverityBadge, Modal } from "@/components/shared";
import { fmtNum } from "@/lib/format";
import { mitreInfo } from "@/lib/mitreInfo";
import type { MitreTactic, MitreTechnique } from "@/lib/types";

function heat(count: number, max: number): { bg: string; fg: string } {
  if (count === 0) return { bg: "rgba(255,255,255,0.03)", fg: "#777" };
  const t = max ? count / max : 0;
  const stops = ["#2A1B3D", "#5A2A8C", "#7B2FBE", "#9D4EDD", "#C4607A", "#E040FB", "#E91E8C"];
  const idx = Math.min(stops.length - 1, Math.floor(t * (stops.length - 1)));
  return { bg: stops[idx], fg: t > 0.35 ? "#fff" : "#ddd" };
}

export default function Mitre() {
  const { incidents } = useGuardian();
  const tactics = useMemo(() => buildMitre(incidents), [incidents]);
  const max = useMemo(
    () => Math.max(1, ...tactics.flatMap((t) => t.techniques.map((x) => x.count))),
    [tactics]
  );
  const totalTechniques = tactics.reduce((s, t) => s + t.techniques.length, 0);
  const [selected, setSelected] = useState<MitreTechnique | null>(null);

  return (
    <div>
      <PageHeader
        title="MITRE ATT&CK"
        desc={`${tactics.length} tactics · ${totalTechniques} techniques observed · click any technique for detail`}
      />

      <div className="flex items-center gap-2 mb-5 text-[10px] font-mono text-muted-foreground">
        <span>Less</span>
        <div className="flex gap-1">
          {["#2A1B3D", "#5A2A8C", "#7B2FBE", "#9D4EDD", "#C4607A", "#E040FB", "#E91E8C"].map((c) => (
            <span key={c} className="w-4 h-4 rounded" style={{ background: c }} />
          ))}
        </div>
        <span>More</span>
      </div>

      <div className="space-y-3">
        {tactics.map((t) => (
          <TacticRow key={t.id} tactic={t} max={max} onPick={setSelected} />
        ))}
      </div>

      <TechniqueModal technique={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function TacticRow({ tactic: t, max, onPick }: { tactic: MitreTactic; max: number; onPick: (x: MitreTechnique) => void }) {
  const sum = t.techniques.reduce((s, x) => s + x.count, 0);
  return (
    <div className="glass-panel rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2 min-w-0">
          <Grid3x3 className="w-4 h-4 text-[#E040FB] shrink-0" />
          <h3 className="font-semibold truncate">{t.name}</h3>
          <span className="text-[10px] font-mono text-muted-foreground">{t.id}</span>
        </div>
        <span className="text-xs font-mono text-muted-foreground shrink-0">{fmtNum(sum)} incidents</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-3">
        {t.techniques.map((x) => {
          const c = heat(x.count, max);
          const info = mitreInfo(x.id);
          return (
            <button
              key={x.id}
              onClick={() => onPick(x)}
              className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-transform hover:scale-[1.015] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E040FB]/60"
              style={{ background: c.bg, color: c.fg }}
            >
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium truncate">{x.name}</div>
                <div className="flex items-center gap-2 text-[9px] font-mono opacity-80 mt-0.5">
                  <span>{x.id}</span>
                  <span>·</span>
                  <span>{fmtNum(x.count)} hits</span>
                </div>
              </div>
              <span className="text-[9px] font-bold font-mono uppercase tracking-wider opacity-80 shrink-0">{info.severity}</span>
              <ChevronRight className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TechniqueModal({ technique, onClose }: { technique: MitreTechnique | null; onClose: () => void }) {
  const info = technique ? mitreInfo(technique.id) : null;
  return (
    <Modal
      open={!!technique}
      onClose={onClose}
      title={technique?.name ?? ""}
      desc={technique ? `MITRE ATT&CK · ${technique.id}` : undefined}
      icon={<Grid3x3 className="w-4 h-4" />}
    >
      {technique && info && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <SeverityBadge severity={info.severity} />
            <span className="text-xs font-mono text-muted-foreground">{fmtNum(technique.count)} incidents observed</span>
            <a
              href={`https://attack.mitre.org/techniques/${technique.id.replace(".", "/")}/`}
              target="_blank"
              rel="noreferrer"
              className="ml-auto text-xs text-[#E040FB] hover:underline"
            >
              ATT&CK reference →
            </a>
          </div>

          <Field label="What it is">
            <p className="text-sm text-foreground/90 leading-relaxed">{info.description}</p>
          </Field>

          <Field label="In plain English">
            <div className="rounded-lg border border-[#4ECDC4]/30 bg-[#4ECDC4]/5 px-4 py-3">
              <p className="text-sm text-foreground/90 leading-relaxed">{info.plain}</p>
            </div>
          </Field>
        </div>
      )}
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{label}</div>
      {children}
    </div>
  );
}

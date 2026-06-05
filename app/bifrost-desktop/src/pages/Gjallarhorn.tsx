import { AnimatePresence, motion } from "framer-motion";
import { Send, Trash2, CheckCircle2, BellRing, BellOff } from "lucide-react";
import { PageHeader } from "@/components/shared";
import { IntegrationCard, PLATFORM_FIELDS } from "@/components/IntegrationCard";
import { useConnection } from "@/lib/api";
import {
  useIntegrations,
  addDispatch,
  clearDispatches,
  isPlatformConfigured,
  PLATFORM_LABELS,
  type IntegrationsState,
} from "@/lib/integrations";
import { fmtDateTime } from "@/lib/format";

export default function Gjallarhorn() {
  const ints = useIntegrations();
  const conn = useConnection();
  const live = conn.status === "connected";

  const active = ints.active;
  const armed = !!active && isPlatformConfigured(ints, active);

  const fireTest = () => {
    if (!active) return;
    const label = PLATFORM_LABELS[active];
    addDispatch({
      platform: active,
      message: `Test alert — CRITICAL threat simulation routed to ${label}`,
      ok: true,
      note: live ? "Sent via Guardian agent" : "Simulated — Guardian agent offline",
    });
  };

  return (
    <div>
      <PageHeader
        title="Gjallarhorn"
        desc="The horn that sounds the alarm — dispatch alerts across your lights and webhooks"
        right={
          <button
            onClick={fireTest}
            disabled={!armed}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold rainbow-bg text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" /> Sound test alert
          </button>
        }
      />

      <div
        className={`glass-panel rounded-xl p-4 mb-6 flex items-center gap-3 ${
          armed ? "glow-low" : ""
        }`}
        style={armed ? { borderColor: "rgba(78,205,196,0.5)" } : undefined}
      >
        <span className={armed ? "text-[#4ECDC4]" : "text-muted-foreground"}>
          {armed ? <BellRing className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
        </span>
        <div className="text-sm">
          {armed ? (
            <>
              Alerting <span className="text-[#4ECDC4] font-semibold">armed</span> — routing to{" "}
              <span className="font-semibold">{PLATFORM_LABELS[active!]}</span>
            </>
          ) : (
            <span className="text-muted-foreground">
              Alerting is inactive. Configure a platform and set it active to arm Gjallarhorn.
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {PLATFORM_FIELDS.map((p) => (
          <IntegrationCard key={p.key} platform={p.key} fields={p.fields} ints={ints} />
        ))}
      </div>

      <DispatchLog dispatches={ints.dispatches} />
    </div>
  );
}

function DispatchLog({ dispatches }: { dispatches: IntegrationsState["dispatches"] }) {
  return (
    <div className="glass-panel rounded-xl p-5 mt-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Send className="w-4 h-4 text-[#9D4EDD]" />
          <h3 className="font-semibold">Recent dispatches</h3>
        </div>
        {dispatches.length > 0 && (
          <button
            onClick={clearDispatches}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[#FF6B35]"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      {dispatches.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground font-mono">No alerts dispatched yet.</div>
      ) : (
        <div className="space-y-2 max-h-72 overflow-auto scroll-thin">
          <AnimatePresence initial={false}>
            {dispatches.map((d) => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-lg bg-black/30 p-3 flex items-start gap-3"
              >
                <span className="text-[#4ECDC4] mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold">{PLATFORM_LABELS[d.platform]}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{fmtDateTime(d.timestamp)}</span>
                  </div>
                  <div className="text-xs text-foreground/90 mt-0.5">{d.message}</div>
                  <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{d.note}</div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

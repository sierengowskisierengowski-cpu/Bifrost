import { useMemo, useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, Send, Sparkles, BookOpen, ShieldCheck } from "lucide-react";
import { useGuardian, useConnection } from "@/lib/api";
import { PageHeader, RangePills, GlassCard } from "@/components/shared";
import {
  buildSaga,
  verdictFor,
  askHeimdall,
  SUGGESTED_QUESTIONS,
  type HeimdallAnswer,
} from "@/lib/heimdall";
import type { TimeRange } from "@/lib/types";

interface ChatTurn {
  id: string;
  role: "user" | "heimdall";
  text: string[];
  answer?: HeimdallAnswer;
}

const VERDICT_BADGE: Record<string, { label: string; bg: string }> = {
  calm: { label: "CALM", bg: "#4ECDC4" },
  watchful: { label: "WATCHFUL", bg: "#9D4EDD" },
  engaged: { label: "DEFENDING", bg: "#FFB020" },
  besieged: { label: "BESIEGED", bg: "#FF2D2D" },
};

export default function Heimdall() {
  const state = useGuardian();
  const conn = useConnection();
  const [range, setRange] = useState<TimeRange>("24H");

  const verdict = useMemo(() => verdictFor(state, range), [state, range]);
  const saga = useMemo(() => buildSaga(state, range), [state, range]);

  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  function ask(question: string) {
    const text = question.trim();
    if (!text) return;
    const answer = askHeimdall(text, state, range);
    setTurns((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", text: [text] },
      { id: `h-${Date.now()}`, role: "heimdall", text: answer.text, answer },
    ]);
    setDraft("");
  }

  const badge = VERDICT_BADGE[verdict.verdict];

  return (
    <div>
      <PageHeader
        title="Heimdall Speaks"
        desc="The watchman narrates your bridge in plain language — and answers. Reads only your own telemetry; nothing leaves this machine."
        right={<RangePills value={range} onChange={setRange} />}
      />

      {/* Verdict banner */}
      <motion.div
        key={verdict.verdict}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel rounded-2xl p-6 mb-6 relative overflow-hidden"
        style={{ borderColor: `${verdict.accent}55` }}
      >
        <div
          className="absolute -right-10 -top-10 w-48 h-48 rounded-full blur-3xl opacity-25"
          style={{ background: verdict.accent }}
        />
        <div className="flex items-start gap-4 relative">
          <div
            className="shrink-0 w-12 h-12 rounded-xl grid place-items-center"
            style={{ background: `${verdict.accent}22`, color: verdict.accent }}
          >
            <Eye size={24} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold">{verdict.title}</h2>
              <span
                className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full text-black"
                style={{ background: verdict.accent }}
              >
                {badge.label}
              </span>
              {conn.source === "mock" && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-muted-foreground">
                  SIMULATED BRIDGE
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{verdict.line}</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-6 items-start">
        {/* The Saga */}
        <section>
          <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
            <BookOpen size={16} className="text-[#9D4EDD]" />
            The Saga
            <span className="text-xs font-normal text-muted-foreground">· auto-written from your data</span>
          </div>
          <div className="space-y-3">
            {saga.map((ch, idx) => (
              <motion.div
                key={ch.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.06 }}
              >
                <GlassCard className="p-5 relative overflow-hidden">
                  <span
                    className="absolute left-0 top-0 bottom-0 w-1"
                    style={{ background: ch.accent }}
                  />
                  <h3 className="text-sm font-bold mb-2 pl-1" style={{ color: ch.accent }}>
                    {ch.title}
                  </h3>
                  <div className="space-y-2 pl-1">
                    {ch.paragraphs.map((p, i) => (
                      <p key={i} className="text-sm text-foreground/85 leading-relaxed">
                        {p}
                      </p>
                    ))}
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Ask Heimdall */}
        <section className="lg:sticky lg:top-4">
          <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
            <Sparkles size={16} className="text-[#4ECDC4]" />
            Ask Heimdall
          </div>
          <GlassCard className="flex flex-col h-[560px]">
            <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-thin p-4 space-y-3">
              {turns.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center gap-3 px-4">
                  <div className="w-14 h-14 rounded-2xl grid place-items-center bg-[#4ECDC4]/15 text-[#4ECDC4]">
                    <ShieldCheck size={26} />
                  </div>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    I watch your bridge and answer in plain language. Ask about threats, attackers, or
                    what to do next.
                  </p>
                </div>
              )}
              <AnimatePresence initial={false}>
                {turns.map((t) => (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={t.role === "user" ? "flex justify-end" : "flex justify-start"}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        t.role === "user"
                          ? "rainbow-bg text-white rounded-br-sm"
                          : "bg-white/5 border border-white/10 rounded-bl-sm"
                      }`}
                    >
                      {t.text.map((line, i) => (
                        <p key={i} className={i > 0 ? "mt-1.5" : ""}>
                          {line}
                        </p>
                      ))}
                      {t.answer?.refs && t.answer.refs.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {t.answer.refs.map((r) => (
                            <span
                              key={r.id}
                              className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/30 border border-white/10"
                            >
                              {r.label}
                            </span>
                          ))}
                        </div>
                      )}
                      {t.answer?.suggestions && t.answer.suggestions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {t.answer.suggestions.map((s) => (
                            <button
                              key={s}
                              onClick={() => ask(s)}
                              className="text-[10px] px-2 py-1 rounded-full border border-[#4ECDC4]/40 text-[#4ECDC4] hover:bg-[#4ECDC4]/10 transition-colors"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {turns.length === 0 && (
              <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                {SUGGESTED_QUESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => ask(s)}
                    className="text-[11px] px-2.5 py-1 rounded-full border border-white/15 text-muted-foreground hover:text-foreground hover:border-white/30 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                ask(draft);
              }}
              className="p-3 border-t border-white/10 flex items-center gap-2"
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask Heimdall about your bridge…"
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[#4ECDC4]/60 placeholder:text-muted-foreground/60"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                className="shrink-0 w-9 h-9 rounded-lg grid place-items-center rainbow-bg text-white disabled:opacity-40 transition-opacity"
                aria-label="Send"
              >
                <Send size={16} />
              </button>
            </form>
          </GlassCard>
          <p className="text-[10px] text-muted-foreground/70 mt-2 px-1 font-mono">
            Grounded in your live telemetry · 100% on-device · no cloud calls
          </p>
        </section>
      </div>
    </div>
  );
}

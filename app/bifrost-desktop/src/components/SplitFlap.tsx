import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/* A departure-board "split-flap" display. Each character cell flips when its
   value changes, giving the animated rolling-counter feel. */

function FlapChar({ char }: { char: string }) {
  return (
    <span className="relative inline-flex items-center justify-center overflow-hidden align-middle" style={{ width: "0.62em", height: "1.15em" }}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={char}
          initial={{ rotateX: -90, opacity: 0, y: "-40%" }}
          animate={{ rotateX: 0, opacity: 1, y: "0%" }}
          exit={{ rotateX: 90, opacity: 0, y: "40%" }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="absolute inset-0 flex items-center justify-center"
          style={{ transformOrigin: "center", backfaceVisibility: "hidden" }}
        >
          {char}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function SplitFlap({
  value,
  className = "",
  color,
}: {
  value: string;
  className?: string;
  color?: string;
}) {
  const chars = value.split("");
  return (
    <span className={`inline-flex font-mono tabular-nums leading-none ${className}`} style={color ? { color } : undefined}>
      {chars.map((ch, i) => (ch === " " ? <span key={i} style={{ width: "0.32em" }} /> : <FlapChar key={`${i}-slot`} char={ch} />))}
    </span>
  );
}

/* Smoothly tween a number toward its target so the split-flap rolls through
   intermediate values instead of jumping. */
export function useRollingNumber(target: number, opts: { decimals?: number; durationMs?: number } = {}) {
  const { decimals = 0, durationMs = 600 } = opts;
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const startRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    fromRef.current = display;
    startRef.current = performance.now();
    const from = fromRef.current;
    const delta = target - from;
    if (Math.abs(delta) < Math.pow(10, -decimals) / 2) {
      setDisplay(target);
      return;
    }
    const step = (now: number) => {
      const t = Math.min(1, (now - startRef.current) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + delta * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return display.toFixed(decimals);
}

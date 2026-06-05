import { AnimatePresence, motion } from "framer-motion";
import { X, Eye, EyeOff, Check } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { Severity, TimeRange } from "@/lib/types";
import { evaluatePassword } from "@/lib/app-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function severityClass(s: Severity): string {
  return {
    CRITICAL: "severity-critical",
    HIGH: "severity-high",
    MEDIUM: "severity-medium",
    LOW: "severity-low",
    INFO: "severity-info",
  }[s];
}

export function SeverityBadge({ severity, className = "" }: { severity: Severity; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold font-mono tracking-wider ${severityClass(
        severity
      )} ${className}`}
    >
      {severity}
    </span>
  );
}

export function GlassCard({
  children,
  className = "",
  tilt = false,
}: {
  children: ReactNode;
  className?: string;
  tilt?: boolean;
}) {
  return (
    <div className={`glass-panel rounded-xl ${tilt ? "card-hover-tilt" : ""} ${className}`}>{children}</div>
  );
}

export function StatCard({
  label,
  value,
  icon,
  accent = "#E040FB",
  sub,
  delay = 0,
  onClick,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  accent?: string;
  sub?: string;
  delay?: number;
  onClick?: () => void;
}) {
  const clickable = !!onClick;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, type: "spring", stiffness: 120, damping: 18 }}
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); } } : undefined}
      className={`glass-panel rounded-xl card-hover-tilt p-5 flex flex-col gap-3 relative overflow-hidden ${
        clickable ? "cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E040FB]/60" : ""
      }`}
    >
      <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-25 transition-opacity group-hover:opacity-40" style={{ background: accent }} />
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <span style={{ color: accent }}>{icon}</span>
      </div>
      <div className="text-3xl font-bold font-mono tracking-tight rainbow-text">{value}</div>
      {sub && <div className="text-xs text-muted-foreground font-mono">{sub}</div>}
      {clickable && (
        <span className="absolute bottom-2 right-3 text-[9px] uppercase tracking-widest text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity">
          details →
        </span>
      )}
    </motion.div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  desc,
  accent = "#E040FB",
  icon,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  desc?: string;
  accent?: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: "spring", stiffness: 240, damping: 24 }}
              className="pointer-events-auto w-full max-w-lg max-h-[85vh] flex flex-col glass-panel rounded-2xl border border-border/60 overflow-hidden"
              style={{ boxShadow: `0 0 60px -20px ${accent}` }}
            >
              <div className="h-1 w-full rainbow-bg shrink-0" />
              <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-border/50">
                <div className="flex items-center gap-3 min-w-0">
                  {icon && <span style={{ color: accent }} className="shrink-0">{icon}</span>}
                  <div className="min-w-0">
                    <h3 className="font-bold tracking-tight truncate">{title}</h3>
                    {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
                  </div>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0" aria-label="Close">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="overflow-auto scroll-thin px-6 py-5">{children}</div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

export function RangePills({
  value,
  onChange,
  options = ["1H", "24H", "7D", "30D", "ALL"],
}: {
  value: TimeRange;
  onChange: (r: TimeRange) => void;
  options?: TimeRange[];
}) {
  return (
    <div className="inline-flex rounded-lg border border-border/60 bg-black/30 p-1 gap-1">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`px-3 py-1 rounded-md text-xs font-mono font-semibold transition-all ${
            value === o ? "rainbow-bg text-white shadow" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ title, desc, right }: { title: string; desc?: string; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {desc && <p className="text-sm text-muted-foreground mt-1">{desc}</p>}
      </div>
      {right}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  accent = "#E040FB",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  accent?: string;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 group no-drag"
      type="button"
    >
      <span
        className="relative w-11 h-6 rounded-full transition-all duration-300 border border-white/10"
        style={{
          background: checked ? accent : "rgba(255,255,255,0.08)",
          boxShadow: checked ? `0 0 14px -2px ${accent}` : "none",
        }}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all duration-300"
          style={{ left: checked ? "22px" : "2px" }}
        />
      </span>
      <span className="text-sm">{label}</span>
    </button>
  );
}

const PW_COLORS = ["#FF2D2D", "#FF6B35", "#4ECDC4", "#9D4EDD"];

/* Password input with a show/hide toggle. */
export function PasswordField({
  value,
  onChange,
  placeholder,
  autoFocus,
  testid,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  testid?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        data-testid={testid}
        className="w-full bg-black/40 border border-border rounded-lg pl-3 pr-10 py-2.5 text-sm font-mono outline-none focus:border-[#E040FB]"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

/* Strength meter + live requirement checklist for the strong-password policy. */
export function PasswordMeter({ pw }: { pw: string }) {
  const ev = evaluatePassword(pw);
  const reqs: { ok: boolean; text: string }[] = [
    { ok: ev.checks.length, text: "At least 12 characters" },
    { ok: ev.checks.upper, text: "Uppercase letter" },
    { ok: ev.checks.lower, text: "Lowercase letter" },
    { ok: ev.checks.number, text: "Number" },
    { ok: ev.checks.special, text: "Special character" },
  ];
  return (
    <div>
      <div className="flex gap-1 mb-1.5">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-colors"
            style={{ background: pw && i <= ev.index ? PW_COLORS[ev.index] : "rgba(255,255,255,0.1)" }}
          />
        ))}
      </div>
      {pw && (
        <div
          className="text-[10px] font-mono mb-2"
          style={{ color: ev.acceptable ? "#4ECDC4" : "#FF6B35" }}
        >
          {ev.label}
        </div>
      )}
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
        {reqs.map((r) => (
          <li
            key={r.text}
            className="flex items-center gap-1.5 text-[11px]"
            style={{ color: r.ok ? "#4ECDC4" : "rgba(255,255,255,0.45)" }}
          >
            {r.ok ? <Check className="w-3 h-3 shrink-0" /> : <X className="w-3 h-3 shrink-0" />}
            {r.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-2 w-full rounded-full bg-white/8 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-sm text-muted-foreground font-mono">{message}</div>
  );
}

export function FilterSelect({
  value,
  onChange,
  options,
  ariaLabel,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label={ariaLabel}
        className={`h-auto w-auto gap-2 rounded-lg border-border bg-black/40 px-3 py-2 text-xs font-mono text-foreground focus:ring-1 focus:ring-[#E040FB]/60 ${className}`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="border-border bg-[hsl(var(--popover))] text-popover-foreground">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-xs font-mono focus:bg-white/10">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

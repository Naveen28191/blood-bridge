import { useEffect, useState } from "react";

/**
 * Circular countdown ring. This is BloodBridge's signature element: the
 * entire product exists to beat a clock (get blood to the hospital before
 * or around the patient's arrival), so the countdown itself — not a card,
 * not a table — is what both the ambulance and the matched source watch.
 *
 * @param totalMinutes - the ETA window (etaMinutes from the request)
 * @param since - ISO timestamp the countdown started from
 * @param size - pixel diameter
 * @param label - small caption under the number, e.g. "TO MARINA GENERAL"
 * @param theme - "light" (default, for the paper-background ambulance view)
 *   or "dark" (for the ink-background dashboard) — only affects the
 *   neutral track/label colors, not the urgency colors.
 */
export default function EtaRing({ totalMinutes, since, size = 168, label, theme = "light" }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const startMs = new Date(since).getTime();
  const totalSeconds = Math.max(totalMinutes, 0) * 60;
  const elapsedSeconds = Math.floor((now - startMs) / 1000);
  const remainingSeconds = totalSeconds - elapsedSeconds;
  const overdue = remainingSeconds < 0;
  const fraction = totalSeconds > 0 ? Math.max(0, Math.min(1, remainingSeconds / totalSeconds)) : 0;

  const stroke = 10;
  const radius = size / 2 - stroke;
  const circumference = 2 * Math.PI * radius;
  const dashoffset = circumference * (1 - fraction);

  const urgency = overdue ? "overdue" : fraction < 0.25 ? "critical" : fraction < 0.5 ? "warning" : "ok";
  const ringColor = {
    ok: "stroke-teal",
    warning: "stroke-amber",
    critical: "stroke-signal",
    overdue: "stroke-signal",
  }[urgency];
  const textColor = {
    ok: "text-teal",
    warning: "text-amber",
    critical: "text-signal",
    overdue: "text-signal",
  }[urgency];

  const displaySeconds = Math.abs(remainingSeconds);
  const mm = String(Math.floor(displaySeconds / 60)).padStart(2, "0");
  const ss = String(displaySeconds % 60).padStart(2, "0");

  return (
    <div className="inline-flex flex-col items-center gap-2" role="timer" aria-live="polite">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className={overdue ? "animate-pulse" : ""}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className={theme === "dark" ? "text-white/10" : "text-ink-900/10"}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className={`${ringColor} transition-[stroke-dashoffset] duration-1000 ease-linear`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-data text-3xl font-medium tabular-nums ${textColor}`}>
            {overdue ? "+" : ""}
            {mm}:{ss}
          </span>
          <span className={`text-[10px] uppercase tracking-wider mt-0.5 ${theme === "dark" ? "text-white/50" : "text-ink-900/50"}`}>
            {overdue ? "overdue" : "remaining"}
          </span>
        </div>
      </div>
      {label && (
        <span className={`text-xs uppercase tracking-wider font-medium ${theme === "dark" ? "text-white/70" : "text-ink-900/70"}`}>
          {label}
        </span>
      )}
    </div>
  );
}

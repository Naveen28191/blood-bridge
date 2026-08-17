import { STATUS_META } from "./StatusBadge.jsx";

const SEQUENCE = ["requested", "matched", "in_transit", "ready"];

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function StatusTimeline({ statusHistory, currentStatus }) {
  const cancelled = currentStatus === "cancelled";
  const byStatus = Object.fromEntries(statusHistory.map((h) => [h.status, h.timestamp]));
  const steps = cancelled ? [...SEQUENCE.filter((s) => byStatus[s]), "cancelled"] : SEQUENCE;

  return (
    <ol className="flex flex-col gap-0">
      {steps.map((status, i) => {
        const meta = STATUS_META[status];
        const timestamp = byStatus[status];
        const reached = Boolean(timestamp);
        const isLast = i === steps.length - 1;
        return (
          <li key={status} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={[
                  "h-3 w-3 rounded-full border-2 mt-1",
                  reached ? `${meta.dot} border-transparent` : "bg-transparent border-ink-700/30",
                ].join(" ")}
              />
              {!isLast && <span className={`w-px flex-1 ${reached ? "bg-ink-700/30" : "bg-ink-700/10"}`} />}
            </div>
            <div className="pb-5">
              <div className={`text-sm font-medium ${reached ? "text-ink-900" : "text-ink-700/40"}`}>{meta.label}</div>
              {timestamp && <div className="font-data text-xs text-ink-700/50">{formatTime(timestamp)}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

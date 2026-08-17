export const STATUS_META = {
  requested: { label: "Requested", dot: "bg-amber", text: "text-amber", bg: "bg-amber-soft" },
  matched: { label: "Matched", dot: "bg-slate", text: "text-slate", bg: "bg-slate-soft" },
  in_transit: { label: "In transit", dot: "bg-slate", text: "text-slate", bg: "bg-slate-soft" },
  ready: { label: "Ready", dot: "bg-teal", text: "text-teal", bg: "bg-teal-soft" },
  cancelled: { label: "Cancelled", dot: "bg-signal", text: "text-signal", bg: "bg-signal-soft" },
};

export default function StatusBadge({ status }) {
  const meta = STATUS_META[status] ?? STATUS_META.requested;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${meta.bg} ${meta.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

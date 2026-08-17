import EtaRing from "./EtaRing.jsx";

export default function PrepBanner({ request }) {
  const matchedAt = request.statusHistory.find((h) => h.status === "matched")?.timestamp ?? request.createdAt;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-ink-700 to-ink-800 border border-signal/30 p-5 flex items-center gap-5 shadow-console">
      <EtaRing totalMinutes={request.etaMinutes} since={matchedAt} size={104} theme="dark" />
      <div className="flex-1 min-w-0">
        <div className="text-signal text-xs font-semibold uppercase tracking-wider mb-1">Prep before arrival</div>
        <div className="text-white font-display text-xl font-semibold">
          {request.bloodGroup} · {request.unitsNeeded} unit{request.unitsNeeded === 1 ? "" : "s"}
        </div>
        <div className="text-white/60 text-sm mt-1 capitalize">
          {request.component.replace("_", " ")} for ambulance {request.ambulanceId}
        </div>
      </div>
    </div>
  );
}

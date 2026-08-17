import { useState } from "react";
import StatusBadge from "./StatusBadge.jsx";
import { api } from "../lib/api.js";

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function RequestCard({ request, sourceId, apiKey, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const isMatchedHere = request.matchedSourceId === sourceId;
  const isOwnDestination = request.destinationHospitalId === sourceId;

  async function act(action) {
    setBusy(true);
    setError(null);
    try {
      let result;
      if (action === "reject") {
        result = await api.patchRequestStatus(request.id, { status: "matched", reject: true }, apiKey);
      } else {
        result = await api.patchRequestStatus(request.id, { status: action }, apiKey);
      }
      onChanged?.(result.request);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-ink-800 p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-data text-lg font-medium text-white">{request.bloodGroup}</span>
            <span className="text-xs text-white/50 uppercase tracking-wide">{request.component.replace("_", " ")}</span>
          </div>
          <div className="text-sm text-white/70 mt-0.5">
            {request.unitsNeeded} unit{request.unitsNeeded === 1 ? "" : "s"} · ambulance {request.ambulanceId}
          </div>
        </div>
        <StatusBadge status={request.status} />
      </div>

      <div className="flex items-center justify-between text-xs text-white/40 font-data">
        <span>ETA {request.etaMinutes}m</span>
        <span>created {formatTime(request.createdAt)}</span>
      </div>

      {error && <div className="text-xs text-signal">{error}</div>}

      {isMatchedHere && request.status === "matched" && (
        <div className="flex gap-2 pt-1">
          <button
            disabled={busy}
            onClick={() => act("in_transit")}
            className="flex-1 rounded-lg bg-teal text-ink-900 text-sm font-medium py-2 disabled:opacity-50"
          >
            Accept &amp; prep
          </button>
          <button
            disabled={busy}
            onClick={() => act("reject")}
            className="flex-1 rounded-lg border border-signal/40 text-signal text-sm font-medium py-2 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      )}

      {isMatchedHere && request.status === "in_transit" && (
        <button
          disabled={busy}
          onClick={() => act("ready")}
          className="rounded-lg bg-teal text-ink-900 text-sm font-medium py-2 disabled:opacity-50"
        >
          Mark ready for patient
        </button>
      )}

      {isOwnDestination && !isMatchedHere && request.matchedSourceId && (
        <div className="text-xs text-white/40">Sourced from another location — you'll be notified when it arrives.</div>
      )}

      {request.status === "requested" && !request.matchedSourceId && (
        <div className="text-xs text-amber">No source matched yet — no candidate met the requirement.</div>
      )}
    </div>
  );
}

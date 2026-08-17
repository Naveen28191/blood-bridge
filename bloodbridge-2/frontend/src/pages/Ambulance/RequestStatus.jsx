import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import EtaRing from "../../components/EtaRing.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import StatusTimeline from "../../components/StatusTimeline.jsx";
import { api } from "../../lib/api.js";
import { useRequestUpdates } from "../../lib/hooks.js";

export default function RequestStatus() {
  const { id } = useParams();
  const [request, setRequest] = useState(null);
  const [matchedSource, setMatchedSource] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [error, setError] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  async function refresh() {
    try {
      const data = await api.getRequest(id);
      setRequest(data.request);
      setMatchedSource(data.matchedSource);
      setTransfers(data.transfers);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useRequestUpdates(id, (updated) => {
    setRequest(updated);
    refresh(); // matchedSource / transfers can change alongside the request doc
  });

  async function cancel() {
    setCancelling(true);
    try {
      const data = await api.patchRequestStatus(id, { status: "cancelled" });
      setRequest(data.request);
    } catch (err) {
      setError(err.message);
    } finally {
      setCancelling(false);
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-paper-50 flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-signal font-medium mb-4">{error}</p>
          <Link to="/ambulance/new" className="text-ink-900 underline">
            Start a new request
          </Link>
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-paper-50 flex items-center justify-center">
        <p className="text-ink-900/50">Loading…</p>
      </div>
    );
  }

  const active = !["ready", "cancelled"].includes(request.status);
  const matchedAt = request.statusHistory.find((h) => h.status === "matched")?.timestamp;

  return (
    <div className="min-h-screen bg-paper-50 pb-10">
      <header className="px-5 pt-6 pb-4 border-b border-paper-200 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-signal flex items-center justify-center">
              <span className="font-display font-bold text-white text-sm">B</span>
            </div>
            <span className="font-display text-lg font-semibold text-ink-900">Request status</span>
          </div>
          <p className="text-ink-900/50 text-sm mt-1 font-data">{request.ambulanceId}</p>
        </div>
        <StatusBadge status={request.status} />
      </header>

      <div className="px-5 py-8 flex flex-col items-center border-b border-paper-200">
        {matchedAt ? (
          <EtaRing totalMinutes={request.etaMinutes} since={matchedAt} size={200} label="To hospital" />
        ) : (
          <div className="text-center py-6">
            <p className="text-ink-900/60 text-sm">Searching for a source with {request.bloodGroup} {request.component.replace("_", " ")}…</p>
          </div>
        )}
        <div className="font-data text-sm text-ink-900/60 mt-4">
          {request.bloodGroup} · {request.unitsNeeded} unit{request.unitsNeeded === 1 ? "" : "s"} · {request.component.replace("_", " ")}
        </div>
      </div>

      {matchedSource && (
        <div className="px-5 py-5 border-b border-paper-200">
          <p className="text-xs uppercase tracking-wider text-ink-900/40 font-medium mb-2">
            {request.matchedSourceId === request.destinationHospitalId ? "Sourced from destination stock" : "Sourced from"}
          </p>
          <p className="font-display text-lg font-semibold text-ink-900">{matchedSource.name}</p>
          <p className="text-sm text-ink-900/60">{matchedSource.address}</p>
          <p className="font-data text-sm text-ink-900/60 mt-1">{matchedSource.phone}</p>

          {transfers.map((t) => (
            <div key={t.id} className="mt-3 rounded-lg bg-slate-soft px-3 py-2 text-sm text-slate">
              Courier transfer to hospital — ETA {t.courierEtaMinutes}m ({t.status})
            </div>
          ))}
        </div>
      )}

      <div className="px-5 py-6">
        <p className="text-xs uppercase tracking-wider text-ink-900/40 font-medium mb-3">Timeline</p>
        <StatusTimeline statusHistory={request.statusHistory} currentStatus={request.status} />
      </div>

      {active && (
        <div className="px-5">
          <button
            onClick={cancel}
            disabled={cancelling}
            className="w-full rounded-xl border-2 border-signal/30 text-signal font-medium py-3 disabled:opacity-50"
          >
            {cancelling ? "Cancelling…" : "Cancel request"}
          </button>
        </div>
      )}

      {request.status === "cancelled" && (
        <div className="px-5">
          <Link
            to="/ambulance/new"
            className="block text-center w-full rounded-xl bg-ink-900 text-white font-medium py-3"
          >
            Start a new request
          </Link>
        </div>
      )}
    </div>
  );
}

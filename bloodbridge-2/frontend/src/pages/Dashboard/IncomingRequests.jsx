import { useEffect, useState, useCallback } from "react";
import { useSession } from "../../context/SessionContext.jsx";
import { api } from "../../lib/api.js";
import { useSourceInbox } from "../../lib/hooks.js";
import RequestCard from "../../components/RequestCard.jsx";
import PrepBanner from "../../components/PrepBanner.jsx";

export default function IncomingRequests() {
  const { session } = useSession();
  const sourceId = session.source.id;
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const [asDestination, asMatched] = await Promise.all([
        api.listRequests({ destinationHospitalId: sourceId }),
        api.listRequests({ matchedSourceId: sourceId }),
      ]);
      const byId = new Map();
      for (const r of [...asDestination.requests, ...asMatched.requests]) byId.set(r.id, r);
      setRequests(Array.from(byId.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch (err) {
      setError(err.message);
    }
  }, [sourceId]);

  useEffect(() => {
    load();
  }, [load]);

  const mergeUpdate = useCallback((updated) => {
    setRequests((list) => {
      const exists = list.some((r) => r.id === updated.id);
      const next = exists ? list.map((r) => (r.id === updated.id ? updated : r)) : [updated, ...list];
      return next.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    });
  }, []);

  useSourceInbox(sourceId, { onUpdate: mergeUpdate, onMatched: mergeUpdate });

  const activePrep = requests.find(
    (r) => r.matchedSourceId === sourceId && ["matched", "in_transit"].includes(r.status)
  );

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="font-display text-2xl font-semibold text-white mb-6">Incoming requests</h1>

      {error && <p className="text-signal text-sm mb-4">{error}</p>}

      {activePrep && (
        <div className="mb-6">
          <PrepBanner request={activePrep} />
        </div>
      )}

      <div className="flex flex-col gap-3">
        {requests.map((r) => (
          <RequestCard key={r.id} request={r} sourceId={sourceId} apiKey={session.apiKey} onChanged={mergeUpdate} />
        ))}
        {requests.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-ink-800 p-8 text-center text-white/30">
            No requests yet. They'll appear here in real time as ambulances dispatch.
          </div>
        )}
      </div>
    </div>
  );
}

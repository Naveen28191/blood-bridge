import { matchRequest } from "./matchingEngine.js";
import { buildCandidateSources } from "./candidateBuilder.js";
import { emitRequestUpdate, emitRequestMatched } from "../socket.js";

/**
 * Runs the matching engine for a persisted request and applies the result:
 *  - sets matchedSourceId / matchScore / status on the request
 *  - opens a `transfers` record when the match isn't the destination
 *    hospital's own stock (spec 3.4: "only when blood must move between
 *    two sources")
 *  - emits realtime updates (spec section 6)
 *
 * This is what POST /api/requests calls right after creating a request
 * (section 4.5: "Top candidate is auto-matched"), and what a reject action
 * calls to re-match excluding the rejected source.
 */
export function runMatchAndApply(requestId, store) {
  const request = store.getRequest(requestId);
  if (!request) return null;

  const candidates = buildCandidateSources(request, store);
  const result = matchRequest(request, candidates);

  if (result.matched) {
    const { source } = result.matched.candidate;
    store.updateRequest(requestId, {
      matchedSourceId: source.id,
      matchScore: result.matched.score,
      status: "matched",
    });
    store.pushStatusHistory(requestId, "matched");

    if (source.id !== request.destinationHospitalId) {
      store.createTransfer({
        requestId,
        fromSourceId: source.id,
        toSourceId: request.destinationHospitalId,
        courierEtaMinutes: result.matched.candidate.travelTimeMinutes,
      });
    }
  } else {
    store.updateRequest(requestId, { matchedSourceId: null, matchScore: null });
  }

  const updated = store.getRequest(requestId);
  emitRequestUpdate(updated);
  if (updated.matchedSourceId) emitRequestMatched(updated);

  return { request: updated, matchResult: result };
}

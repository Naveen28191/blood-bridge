import { Router } from "express";
import { store } from "../data/store.js";
import { matchRequest } from "../lib/matchingEngine.js";
import { buildCandidateSources } from "../lib/candidateBuilder.js";

const router = Router();

// POST /api/match — run the matching engine, returns ranked candidates.
// This is a read-only preview: it does NOT mutate a request. (Creating a
// request via POST /api/requests already auto-matches per section 4.5; use
// this endpoint to re-check candidates without committing to one — e.g. the
// hospital dashboard previewing fallback options, or the ambulance app
// previewing before submitting.)
//
// Body: either { requestId } to evaluate a persisted request, or an inline
// request object: { bloodGroup, component, unitsNeeded, destinationHospitalId,
// etaMinutes, patientLocation? }
router.post("/", (req, res) => {
  const body = req.body ?? {};
  let request = body;

  if (body.requestId) {
    request = store.getRequest(body.requestId);
    if (!request) return res.status(404).json({ error: "Request not found" });
  } else {
    const missing = ["bloodGroup", "component", "unitsNeeded", "destinationHospitalId", "etaMinutes"].filter(
      (k) => body[k] === undefined
    );
    if (missing.length) return res.status(400).json({ error: `Missing fields: ${missing.join(", ")}` });
  }

  let candidates;
  try {
    candidates = buildCandidateSources(request, store);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const result = matchRequest(request, candidates);

  res.json({
    matched: result.matched && {
      sourceId: result.matched.candidate.source.id,
      sourceName: result.matched.candidate.source.name,
      score: result.matched.score,
      tier: result.matched.tier,
      breakdown: result.matched.breakdown,
    },
    fallback: result.fallback.map((f) => ({
      sourceId: f.candidate.source.id,
      sourceName: f.candidate.source.name,
      score: f.score,
      tier: f.tier,
      breakdown: f.breakdown,
    })),
    excluded: result.excluded.map((e) => ({
      sourceId: e.candidate.source.id,
      sourceName: e.candidate.source.name,
      reason: e.exclusionReason,
    })),
  });
});

export default router;

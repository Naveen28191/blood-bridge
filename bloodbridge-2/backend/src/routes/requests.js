import { Router } from "express";
import { store } from "../data/store.js";
import { identifySource } from "../middleware/auth.js";
import { runMatchAndApply } from "../lib/matchOrchestrator.js";
import { emitRequestUpdate } from "../socket.js";

const router = Router();

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const COMPONENTS = ["whole_blood", "plasma", "platelets", "rbc"];

// requested -> matched -> in_transit -> ready, cancelled from any stage.
// "matched" is also the re-entry point for a reject-and-rematch cycle.
const ALLOWED_TRANSITIONS = {
  requested: ["matched", "cancelled"],
  matched: ["in_transit", "cancelled", "matched"], // matched->matched: rematch after reject
  in_transit: ["ready", "cancelled"],
  ready: ["cancelled"],
  cancelled: [],
};

function validateCreateBody(body) {
  const errors = [];
  if (!body.ambulanceId) errors.push("ambulanceId is required");
  if (!BLOOD_GROUPS.includes(body.bloodGroup)) errors.push(`bloodGroup must be one of ${BLOOD_GROUPS.join(", ")}`);
  if (!COMPONENTS.includes(body.component)) errors.push(`component must be one of ${COMPONENTS.join(", ")}`);
  if (!Number.isFinite(body.unitsNeeded) || body.unitsNeeded <= 0) errors.push("unitsNeeded must be a positive number");
  if (!body.patientLocation || !Number.isFinite(body.patientLocation.lat) || !Number.isFinite(body.patientLocation.lng)) {
    errors.push("patientLocation.lat and patientLocation.lng are required");
  }
  if (!body.destinationHospitalId || !store.getSource(body.destinationHospitalId)) {
    errors.push("destinationHospitalId must reference a known source");
  }
  if (!Number.isFinite(body.etaMinutes) || body.etaMinutes < 0) errors.push("etaMinutes must be a non-negative number");
  return errors;
}

// POST /api/requests — ambulance creates a new blood request.
// MVP note: intentionally not gated behind requireApiKey — see
// middleware/auth.js for why ambulance-side auth is deferred to Phase 2.
router.post("/", (req, res) => {
  const errors = validateCreateBody(req.body ?? {});
  if (errors.length) return res.status(400).json({ errors });

  const request = store.createRequest(req.body);
  // Section 4.5: top candidate is auto-matched at creation time.
  const { request: matched, matchResult } = runMatchAndApply(request.id, store);

  res.status(201).json({ request: matched, matchResult: summarizeMatchResult(matchResult) });
});

// GET /api/requests/:id — status + matched source.
router.get("/:id", (req, res) => {
  const request = store.getRequest(req.params.id);
  if (!request) return res.status(404).json({ error: "Request not found" });

  const matchedSource = request.matchedSourceId ? store.getSource(request.matchedSourceId) : null;
  const transfers = store.listTransfersForRequest(request.id);
  res.json({ request, matchedSource, transfers });
});

// GET /api/requests?destinationHospitalId=...&matchedSourceId=...&status=...
// Not in the original table verbatim, but needed for the dashboard's
// "incoming requests" list — same resource, filtered read.
router.get("/", (req, res) => {
  const { destinationHospitalId, matchedSourceId, status } = req.query;
  const list = store.listRequests({ destinationHospitalId, matchedSourceId, status });
  res.json({ requests: list });
});

// PATCH /api/requests/:id/status — update status.
// Body: { status, sourceId, reject?: boolean }
// A source can PATCH to "matched" with reject:true to decline a match
// it was assigned; the engine re-runs excluding that source (spec doesn't
// define a separate reject endpoint, so this reuses the status resource
// the way the "accept/reject requests" actor action maps onto the
// requested -> matched -> in_transit -> ready flow in section 6).
router.patch("/:id/status", identifySource, (req, res) => {
  const request = store.getRequest(req.params.id);
  if (!request) return res.status(404).json({ error: "Request not found" });

  const { status, reject } = req.body ?? {};

  if (reject) {
    if (!req.authedSource || req.authedSource.id !== request.matchedSourceId) {
      return res.status(403).json({ error: "Only the currently matched source can reject" });
    }
    store.updateRequest(request.id, {
      rejectedSourceIds: [...request.rejectedSourceIds, req.authedSource.id],
      matchedSourceId: null,
      matchScore: null,
      status: "requested",
    });
    const { request: rematched, matchResult } = runMatchAndApply(request.id, store);
    return res.json({ request: rematched, matchResult: summarizeMatchResult(matchResult) });
  }

  if (!ALLOWED_TRANSITIONS[request.status]?.includes(status)) {
    return res.status(409).json({
      error: `Cannot transition from '${request.status}' to '${status}'`,
      allowed: ALLOWED_TRANSITIONS[request.status] ?? [],
    });
  }

  store.updateRequest(request.id, { status });
  store.pushStatusHistory(request.id, status);

  // Keep an in-flight transfer's status loosely in sync with the request.
  if (["in_transit", "ready", "cancelled"].includes(status)) {
    const transferStatus = status === "in_transit" ? "dispatched" : status === "ready" ? "delivered" : undefined;
    if (transferStatus) {
      for (const t of store.listTransfersForRequest(request.id)) {
        store.updateTransfer(t.id, { status: transferStatus });
      }
    }
  }

  const updated = store.getRequest(request.id);
  emitRequestUpdate(updated);
  res.json({ request: updated });
});

function summarizeMatchResult(matchResult) {
  if (!matchResult) return null;
  return {
    matched: matchResult.matched
      ? { sourceId: matchResult.matched.candidate.source.id, score: matchResult.matched.score, tier: matchResult.matched.tier }
      : null,
    fallback: matchResult.fallback.map((f) => ({ sourceId: f.candidate.source.id, score: f.score, tier: f.tier })),
    excludedCount: matchResult.excluded.length,
  };
}

export default router;

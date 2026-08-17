// BloodBridge matching engine — SPEC.md section 4.
//
// Pure, side-effect-free by design: it takes a request and a list of
// candidate sources and returns a ranked result. No I/O, no store access,
// no network calls. That's what makes it unit-testable in isolation
// (milestone: "Matching engine complete with unit tests, 5+ scenarios incl.
// no-match") and keeps it comfortably under the <1s / 50-candidates
// non-functional requirement — it's O(n log n) in candidate count with no
// external calls in the hot path.
//
// Two judgment calls the spec leaves open, resolved here and documented:
//
// 1. Section 4.2's `distanceKm` / `travelTimeMinutes` are distance/time
//    *from the candidate source to the destination hospital* — i.e. how
//    long it takes the blood itself to reach the hospital, not how far the
//    ambulance is from the patient. Section 4.1 confirms this
//    (`distanceFromDestination`), and it's what makes the hard constraint
//    `travelTimeMinutes > etaMinutes + 15` meaningful: can the source get
//    blood to the hospital before/around the patient's arrival?
//
// 2. Section 4.4's "priority order" and section 4.2's numeric score are two
//    ranking signals. We treat priority as the primary sort key (tier) and
//    score as the tiebreaker within a tier. This means the destination
//    hospital's own stock is *always* preferred over a transfer when it
//    clears the hard constraints, even if a nearby source scores higher on
//    paper — avoiding a transfer entirely is strictly safer than the
//    formula alone captures. This is a design decision, not a spec literal;
//    flagged here for review.

export const DEFAULT_WEIGHTS = Object.freeze({
  w1: 0.3, // surplus buffer
  w2: 0.4, // speed to hospital
  w3: 0.2, // inventory freshness
  w4: 0.1, // distance penalty
});

// Spec says freshness is "days until expiry, normalized 0-1" but doesn't
// pin the normalization window. Whole blood / RBC shelf life tops out
// around 42 days, so we use that as the ceiling: a unit expiring in 42+
// days scores 1.0 fresh, one expiring right now scores 0.0. Configurable
// via options.freshnessWindowDays for components with different shelf life.
export const DEFAULT_FRESHNESS_WINDOW_DAYS = 42;

export const CONSTRAINT_BUFFER_MINUTES = 15;

export const EXCLUSION_REASON = Object.freeze({
  INSUFFICIENT_UNITS: "insufficient_units",
  TOO_SLOW: "exceeds_eta_buffer",
  UNVERIFIED_SOURCE: "source_unverified",
  NO_MATCHING_INVENTORY: "no_matching_inventory",
});

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

function freshnessScore(expiryDate, now, windowDays) {
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysUntilExpiry = (new Date(expiryDate).getTime() - now.getTime()) / msPerDay;
  return clamp01(daysUntilExpiry / windowDays);
}

/** Tier used as the primary sort key, per spec 4.4 priority order. */
function priorityTier(candidate, request) {
  const { source } = candidate;
  if (source.id === request.destinationHospitalId) return 1; // own stock, no transfer
  if (source.type === "hospital") return 2; // nearby hospital
  if (source.type === "blood_bank") return 3; // nearby blood bank
  return 4; // reserved for Phase 2 donors
}

/**
 * Evaluate a single candidate against a request: hard constraints first,
 * then score. Always returns a fully-annotated record so callers (and
 * tests) can see *why* something was excluded, not just that it was.
 *
 * @param {object} candidate - { source, inventoryForGroup, travelTimeMinutes, distanceKm }
 * @param {object} request - { bloodGroup, component, unitsNeeded, etaMinutes, destinationHospitalId }
 */
export function evaluateCandidate(candidate, request, options = {}) {
  const weights = { ...DEFAULT_WEIGHTS, ...(options.weights || {}) };
  const freshnessWindowDays = options.freshnessWindowDays ?? DEFAULT_FRESHNESS_WINDOW_DAYS;
  const now = options.now ?? new Date();

  const { source, inventoryForGroup, travelTimeMinutes, distanceKm } = candidate;

  if (!inventoryForGroup) {
    return {
      candidate,
      eligible: false,
      exclusionReason: EXCLUSION_REASON.NO_MATCHING_INVENTORY,
      score: null,
    };
  }

  if (source.verified === false) {
    return {
      candidate,
      eligible: false,
      exclusionReason: EXCLUSION_REASON.UNVERIFIED_SOURCE,
      score: null,
    };
  }

  if (inventoryForGroup.unitsAvailable < request.unitsNeeded) {
    return {
      candidate,
      eligible: false,
      exclusionReason: EXCLUSION_REASON.INSUFFICIENT_UNITS,
      score: null,
    };
  }

  if (travelTimeMinutes > request.etaMinutes + CONSTRAINT_BUFFER_MINUTES) {
    return {
      candidate,
      eligible: false,
      exclusionReason: EXCLUSION_REASON.TOO_SLOW,
      score: null,
    };
  }

  const surplus = inventoryForGroup.unitsAvailable - request.unitsNeeded;
  const speed = 1 / Math.max(travelTimeMinutes, 1); // guard div-by-zero
  const freshness = freshnessScore(inventoryForGroup.expiryDate, now, freshnessWindowDays);

  const score =
    weights.w1 * surplus +
    weights.w2 * speed +
    weights.w3 * freshness -
    weights.w4 * distanceKm;

  return {
    candidate,
    eligible: true,
    exclusionReason: null,
    score,
    tier: priorityTier(candidate, request),
    breakdown: {
      surplus,
      speed,
      freshness,
      distanceKm,
      travelTimeMinutes,
    },
  };
}

/**
 * Rank all candidates for a request. Returns eligible candidates sorted by
 * priority tier (asc) then score (desc), plus excluded candidates with
 * their reasons.
 */
export function rankCandidates(request, candidateSources, options = {}) {
  const evaluated = candidateSources.map((c) => evaluateCandidate(c, request, options));

  const eligible = evaluated
    .filter((e) => e.eligible)
    .sort((a, b) => (a.tier !== b.tier ? a.tier - b.tier : b.score - a.score));

  const excluded = evaluated.filter((e) => !e.eligible);

  return { eligible, excluded };
}

/**
 * Full matching pipeline per spec 4.5: top candidate auto-matched, next 2
 * shown as fallback options.
 */
export function matchRequest(request, candidateSources, options = {}) {
  const { eligible, excluded } = rankCandidates(request, candidateSources, options);

  return {
    matched: eligible[0] ?? null,
    fallback: eligible.slice(1, 3),
    ranked: eligible,
    excluded,
  };
}

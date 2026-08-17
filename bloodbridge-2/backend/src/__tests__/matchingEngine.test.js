import { matchRequest, rankCandidates, EXCLUSION_REASON } from "../lib/matchingEngine.js";

// Fixed "now" so freshness scoring is deterministic across test runs.
const NOW = new Date("2026-08-15T12:00:00Z");
const daysFromNow = (d) => new Date(NOW.getTime() + d * 86400000).toISOString();

const baseRequest = {
  bloodGroup: "O-",
  component: "rbc",
  unitsNeeded: 2,
  etaMinutes: 20,
  destinationHospitalId: "hosp-dest",
};

function source(id, type, verified = true) {
  return { id, type, verified };
}

function inv(unitsAvailable, expiryInDays) {
  return { bloodGroup: "O-", component: "rbc", unitsAvailable, expiryDate: daysFromNow(expiryInDays) };
}

function candidate({ id, type = "hospital", verified = true, units = 5, expiryInDays = 20, travelTimeMinutes = 5, distanceKm = 3 }) {
  return {
    source: source(id, type, verified),
    inventoryForGroup: inv(units, expiryInDays),
    travelTimeMinutes,
    distanceKm,
  };
}

const opts = { now: NOW };

describe("matching engine — priority tiers", () => {
  test("destination hospital's own sufficient stock wins even if a nearby source scores higher", () => {
    const own = candidate({ id: "hosp-dest", units: 3, travelTimeMinutes: 0, distanceKm: 0 });
    const nearbyBetterScore = candidate({ id: "hosp-2", units: 20, travelTimeMinutes: 2, distanceKm: 1 });

    const result = matchRequest(baseRequest, [own, nearbyBetterScore], opts);

    expect(result.matched.candidate.source.id).toBe("hosp-dest");
    expect(result.matched.tier).toBe(1);
  });

  test("falls through to nearby hospital when destination hospital lacks stock", () => {
    const own = candidate({ id: "hosp-dest", units: 1 }); // below unitsNeeded=2
    const nearbyHospital = candidate({ id: "hosp-2", units: 5 });

    const result = matchRequest(baseRequest, [own, nearbyHospital], opts);

    expect(result.matched.candidate.source.id).toBe("hosp-2");
    expect(result.matched.tier).toBe(2);
  });

  test("falls through to blood bank when no hospital qualifies", () => {
    const hospitalShort = candidate({ id: "hosp-2", type: "hospital", units: 1 });
    const bank = candidate({ id: "bank-1", type: "blood_bank", units: 5 });

    const result = matchRequest(baseRequest, [hospitalShort, bank], opts);

    expect(result.matched.candidate.source.id).toBe("bank-1");
    expect(result.matched.tier).toBe(3);
  });
});

describe("matching engine — hard constraints (no-match scenarios)", () => {
  test("no eligible candidates when every source is short on units", () => {
    const c1 = candidate({ id: "hosp-2", units: 1 });
    const c2 = candidate({ id: "bank-1", type: "blood_bank", units: 0 });

    const { eligible, excluded } = rankCandidates(baseRequest, [c1, c2], opts);

    expect(eligible).toHaveLength(0);
    expect(excluded.every((e) => e.exclusionReason === EXCLUSION_REASON.INSUFFICIENT_UNITS)).toBe(true);
  });

  test("excludes a candidate whose travel time exceeds etaMinutes + 15 buffer", () => {
    // baseRequest.etaMinutes = 20, so anything over 35 minutes is excluded.
    const tooSlow = candidate({ id: "bank-1", type: "blood_bank", units: 5, travelTimeMinutes: 36 });

    const { eligible, excluded } = rankCandidates(baseRequest, [tooSlow], opts);

    expect(eligible).toHaveLength(0);
    expect(excluded[0].exclusionReason).toBe(EXCLUSION_REASON.TOO_SLOW);
  });

  test("excludes unverified sources even when otherwise the best candidate", () => {
    const unverified = candidate({ id: "bank-1", type: "blood_bank", verified: false, units: 50 });
    const okButWorse = candidate({ id: "bank-2", type: "blood_bank", units: 5 });

    const result = matchRequest(baseRequest, [unverified, okButWorse], opts);

    expect(result.matched.candidate.source.id).toBe("bank-2");
    expect(result.excluded.some((e) => e.exclusionReason === EXCLUSION_REASON.UNVERIFIED_SOURCE)).toBe(true);
  });

  test("returns no match at all when the only candidate is unverified", () => {
    const unverified = candidate({ id: "bank-1", verified: false });

    const result = matchRequest(baseRequest, [unverified], opts);

    expect(result.matched).toBeNull();
    expect(result.fallback).toHaveLength(0);
  });
});

describe("matching engine — scoring and fallback", () => {
  test("within the same tier, higher score (fresher/closer/faster) ranks first", () => {
    const fresher = candidate({ id: "bank-1", type: "blood_bank", units: 5, expiryInDays: 40, travelTimeMinutes: 5, distanceKm: 2 });
    const staler = candidate({ id: "bank-2", type: "blood_bank", units: 5, expiryInDays: 1, travelTimeMinutes: 5, distanceKm: 2 });

    const { eligible } = rankCandidates(baseRequest, [staler, fresher], opts);

    expect(eligible[0].candidate.source.id).toBe("bank-1");
    expect(eligible[0].score).toBeGreaterThan(eligible[1].score);
  });

  test("auto-match is top candidate; fallback holds up to the next two", () => {
    const c1 = candidate({ id: "bank-1", type: "blood_bank", units: 5, travelTimeMinutes: 3 });
    const c2 = candidate({ id: "bank-2", type: "blood_bank", units: 5, travelTimeMinutes: 6 });
    const c3 = candidate({ id: "bank-3", type: "blood_bank", units: 5, travelTimeMinutes: 9 });
    const c4 = candidate({ id: "bank-4", type: "blood_bank", units: 5, travelTimeMinutes: 12 });

    const result = matchRequest(baseRequest, [c4, c3, c2, c1], opts);

    expect(result.matched.candidate.source.id).toBe("bank-1");
    expect(result.fallback).toHaveLength(2);
    expect(result.fallback.map((f) => f.candidate.source.id)).toEqual(["bank-2", "bank-3"]);
  });

  test("a source with no inventory for the requested group is excluded, not scored as zero", () => {
    const noInventory = { source: source("bank-1", "blood_bank"), inventoryForGroup: null, travelTimeMinutes: 5, distanceKm: 2 };

    const { eligible, excluded } = rankCandidates(baseRequest, [noInventory], opts);

    expect(eligible).toHaveLength(0);
    expect(excluded[0].exclusionReason).toBe(EXCLUSION_REASON.NO_MATCHING_INVENTORY);
  });
});

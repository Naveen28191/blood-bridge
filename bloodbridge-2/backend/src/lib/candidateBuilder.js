// Bridges the data store to the matching engine's input shape (spec 4.1):
//   candidateSources: [ { source, inventoryForGroup, distanceFromDestination } ]
//
// Kept separate from matchingEngine.js on purpose: the engine stays a pure
// function you can unit-test with plain objects, while this file is the
// only place that touches the store and the ETA estimator.

import { distanceKm } from "./geo.js";
import { estimateTravelMinutes } from "./eta.js";

const DEFAULT_SEARCH_RADIUS_KM = 60;

/**
 * @param {object} request - a request doc (or request-shaped object) with
 *   bloodGroup, component, unitsNeeded, destinationHospitalId
 * @param {object} store
 * @param {object} [options]
 */
export function buildCandidateSources(request, store, options = {}) {
  const radiusKm = options.radiusKm ?? DEFAULT_SEARCH_RADIUS_KM;
  const destination = store.getSource(request.destinationHospitalId);
  if (!destination) {
    throw new Error(`Unknown destinationHospitalId: ${request.destinationHospitalId}`);
  }

  const rejected = new Set(request.rejectedSourceIds ?? []);

  return store
    .listSources()
    .filter((source) => !rejected.has(source.id))
    .map((source) => {
      const km = distanceKm(source.location, destination.location);
      // Destination hospital itself is always a candidate (distance 0),
      // regardless of search radius. Everything else is radius-filtered —
      // a lightweight stand-in for a real geohash-bounded Firestore query.
      if (source.id !== destination.id && km > radiusKm) return null;

      const inventory = store.getInventory(source.id) ?? [];
      const inventoryForGroup =
        inventory.find(
          (i) => i.bloodGroup === request.bloodGroup && i.component === request.component
        ) ?? null;

      const travelTimeMinutes =
        source.id === destination.id ? 0 : estimateTravelMinutes(source.location, destination.location);

      return {
        source,
        inventoryForGroup,
        distanceKm: km,
        travelTimeMinutes,
      };
    })
    .filter(Boolean);
}

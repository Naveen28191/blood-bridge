// Travel-time estimation for BloodBridge.
//
// MVP NOTE: spec section 7 calls for the Google Maps Distance Matrix API.
// That needs a billed Google Cloud API key we don't have here, so this
// module estimates travel time from straight-line distance and an assumed
// average urban courier/ambulance speed, with a fixed traffic-fudge factor.
// It exposes the exact same signature a Distance Matrix wrapper would
// (origin, destination) -> minutes, so routes/matchingEngine never need to
// change when a real Maps client is swapped in — only this file does.

import { distanceKm } from "./geo.js";

const AVG_SPEED_KMH = 32; // conservative urban average incl. traffic/lights
const TRAFFIC_FACTOR = 1.15; // pad for non-straight-line roads + congestion
const MIN_TRAVEL_MINUTES = 3; // floor, for same-building / adjacent-block cases

/**
 * Estimate travel time in minutes between two lat/lng points.
 * Swap this implementation for a real Google Maps Distance Matrix call
 * (same signature) when an API key is available.
 */
export function estimateTravelMinutes(origin, destination) {
  const km = distanceKm(origin, destination);
  const rawMinutes = (km / AVG_SPEED_KMH) * 60 * TRAFFIC_FACTOR;
  return Math.max(MIN_TRAVEL_MINUTES, Math.round(rawMinutes));
}

// Geo utilities for BloodBridge.
//
// MVP NOTE: the spec calls for Firestore + the `geofire` geohash library for
// proximity queries. Without a live Firestore project to point at, this
// module implements the same *shape* of query (radius search around a
// lat/lng) directly against the in-memory store using the haversine
// formula. `geohashFor()` still stamps every source with a geohash string
// (same precision/format geofire would use) so the `sources.geohash` field
// in the data model is populated correctly and the swap to real Firestore +
// geofire later only touches this file.

const EARTH_RADIUS_KM = 6371;

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

/** Great-circle distance between two lat/lng points, in kilometers. */
export function distanceKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_KM * c;
}

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/** Standard geohash encoder (precision in characters, default 7 ≈ ~150m cells). */
export function geohashFor({ lat, lng }, precision = 7) {
  let latRange = [-90, 90];
  let lngRange = [-180, 180];
  let hash = "";
  let bit = 0;
  let ch = 0;
  let evenBit = true;

  while (hash.length < precision) {
    if (evenBit) {
      const mid = (lngRange[0] + lngRange[1]) / 2;
      if (lng >= mid) {
        ch |= 1 << (4 - bit);
        lngRange[0] = mid;
      } else {
        lngRange[1] = mid;
      }
    } else {
      const mid = (latRange[0] + latRange[1]) / 2;
      if (lat >= mid) {
        ch |= 1 << (4 - bit);
        latRange[0] = mid;
      } else {
        latRange[1] = mid;
      }
    }
    evenBit = !evenBit;
    if (bit < 4) {
      bit++;
    } else {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return hash;
}

/** Filters+sorts a list of {location} items to those within radiusKm of origin, nearest first. */
export function withinRadius(origin, items, radiusKm, getLocation = (i) => i.location) {
  return items
    .map((item) => ({ item, distanceKm: distanceKm(origin, getLocation(item)) }))
    .filter(({ distanceKm: d }) => d <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

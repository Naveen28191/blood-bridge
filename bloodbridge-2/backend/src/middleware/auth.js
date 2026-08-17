// Simple API-key auth, per SPEC.md section 5 ("Auth: simple API key per
// source for MVP; proper auth (Firebase Auth) is Phase 2").
//
// Only endpoints acting *as* a source (updating its own inventory, changing
// the status of a request matched to it) require a key. Ambulance-facing
// endpoints (creating a request, reading status) stay open in the MVP: the
// data model has no `ambulances` collection or credential of its own yet —
// that's a Phase 2 concern alongside Firebase Auth, not a gap in this pass.

import { store } from "../data/store.js";

export function identifySource(req, _res, next) {
  const key = req.header("x-api-key");
  req.authedSource = key ? store.resolveApiKey(key) : null;
  next();
}

/** Requires a valid API key, with no ownership check (any known source). */
export function requireApiKey(req, res, next) {
  if (!req.authedSource) {
    return res.status(401).json({ error: "Missing or invalid x-api-key header" });
  }
  next();
}

/**
 * Requires the API key to belong to the source identified by the given
 * request-param name (defaults to `:id`).
 */
export function requireOwnSource(paramName = "id") {
  return (req, res, next) => {
    if (!req.authedSource) {
      return res.status(401).json({ error: "Missing or invalid x-api-key header" });
    }
    if (req.authedSource.id !== req.params[paramName]) {
      return res.status(403).json({ error: "API key does not authorize this source" });
    }
    next();
  };
}

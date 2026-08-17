import { Router } from "express";
import { store } from "../data/store.js";
import { identifySource, requireOwnSource } from "../middleware/auth.js";
import { withinRadius } from "../lib/geo.js";

const router = Router();

// GET /api/sources — list all sources (for the ambulance's destination-hospital picker).
router.get("/", (req, res) => {
  const { type } = req.query;
  let list = store.listSources();
  if (type) list = list.filter((s) => s.type === type);
  res.json({ sources: list });
});

// GET /api/sources/nearby?lat=&lng=&radiusKm=&type=
router.get("/nearby", (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const radiusKm = req.query.radiusKm ? Number(req.query.radiusKm) : 25;
  const { type } = req.query;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: "lat and lng query params are required" });
  }

  let candidates = store.listSources();
  if (type) candidates = candidates.filter((s) => s.type === type);

  const results = withinRadius({ lat, lng }, candidates, radiusKm).map(({ item, distanceKm }) => ({
    ...item,
    distanceKm: Math.round(distanceKm * 10) / 10,
  }));

  res.json({ sources: results });
});

// GET /api/sources/:id/inventory
router.get("/:id/inventory", (req, res) => {
  const inventory = store.getInventory(req.params.id);
  if (inventory === null) return res.status(404).json({ error: "Source not found" });
  res.json({ sourceId: req.params.id, inventory });
});

// PATCH /api/sources/:id/inventory — manual stock entry (MVP), auth required,
// source can only update its own inventory.
// Body: { bloodGroup, component, unitsAvailable, expiryDate }
router.patch("/:id/inventory", identifySource, requireOwnSource("id"), (req, res) => {
  const { bloodGroup, component, unitsAvailable, expiryDate } = req.body ?? {};
  if (!bloodGroup || !component) {
    return res.status(400).json({ error: "bloodGroup and component are required" });
  }
  if (unitsAvailable !== undefined && (!Number.isFinite(unitsAvailable) || unitsAvailable < 0)) {
    return res.status(400).json({ error: "unitsAvailable must be a non-negative number" });
  }

  const item = store.upsertInventoryItem(req.params.id, { bloodGroup, component, unitsAvailable, expiryDate });
  res.json({ sourceId: req.params.id, item });
});

export default router;

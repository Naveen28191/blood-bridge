// In-memory data store for BloodBridge MVP.
//
// MVP NOTE: SPEC.md section 7 specifies Firestore as the database, with
// `sources`, `requests`, and `transfers` as top-level collections and
// `inventory` as a subcollection under each source. We don't have a live
// Firestore project to point at here, so this module holds the exact same
// document shapes in memory (a Map per "collection"). Every route talks to
// this store through the functions below and never touches the Maps
// directly — so swapping this file for a real `firebase-admin` Firestore
// client later is a one-file change, not a rewrite.

import { v4 as uuid } from "uuid";
import { geohashFor } from "../lib/geo.js";

const now = () => new Date().toISOString();

// --- "collections" -----------------------------------------------------
const sources = new Map(); // sources/{id}
const inventories = new Map(); // sources/{id}/inventory -> array of line items
const requests = new Map(); // requests/{id}
const transfers = new Map(); // transfers/{id}
const apiKeys = new Map(); // apiKey -> sourceId  (MVP auth, per spec section 5)

// --- helpers -------------------------------------------------------------

function addSource({ id, name, type, location, address, phone, verified = true, apiKey }) {
  const doc = {
    id,
    name,
    type,
    location,
    geohash: geohashFor(location),
    address,
    phone,
    verified,
    createdAt: now(),
  };
  sources.set(id, doc);
  inventories.set(id, []);
  if (apiKey) apiKeys.set(apiKey, id);
  return doc;
}

function addInventory(sourceId, items) {
  const list = inventories.get(sourceId) ?? [];
  for (const item of items) {
    list.push({
      bloodGroup: item.bloodGroup,
      component: item.component,
      unitsAvailable: item.unitsAvailable,
      expiryDate: item.expiryDate,
      lastUpdated: now(),
    });
  }
  inventories.set(sourceId, list);
}

function daysFromNow(d) {
  return new Date(Date.now() + d * 86400000).toISOString();
}

// --- seed data (Chennai-area, fictional sources) --------------------------
// Coordinates are plausible for the Chennai metro area for a realistic demo
// (proximity queries, ETA estimates) but names/addresses are invented —
// this is sample data, not a real directory of blood sources.

function seed() {
  addSource({
    id: "hosp-marina-general",
    name: "Marina General Hospital",
    type: "hospital",
    location: { lat: 13.0500, lng: 80.2824 },
    address: "12 Marina Loop Road, Chennai",
    phone: "+91-44-5550-1010",
    verified: true,
    apiKey: "key_marina_general",
  });
  addInventory("hosp-marina-general", [
    { bloodGroup: "O-", component: "rbc", unitsAvailable: 1, expiryDate: daysFromNow(9) },
    { bloodGroup: "O+", component: "rbc", unitsAvailable: 6, expiryDate: daysFromNow(21) },
    { bloodGroup: "A+", component: "whole_blood", unitsAvailable: 4, expiryDate: daysFromNow(15) },
    { bloodGroup: "B+", component: "platelets", unitsAvailable: 2, expiryDate: daysFromNow(3) },
  ]);

  addSource({
    id: "hosp-anna-nagar-multi",
    name: "Anna Nagar Multispecialty Hospital",
    type: "hospital",
    location: { lat: 13.0850, lng: 80.2101 },
    address: "45 2nd Avenue, Anna Nagar, Chennai",
    phone: "+91-44-5550-2020",
    verified: true,
    apiKey: "key_anna_nagar",
  });
  addInventory("hosp-anna-nagar-multi", [
    { bloodGroup: "O-", component: "rbc", unitsAvailable: 5, expiryDate: daysFromNow(30) },
    { bloodGroup: "AB+", component: "plasma", unitsAvailable: 3, expiryDate: daysFromNow(60) },
    { bloodGroup: "O+", component: "rbc", unitsAvailable: 2, expiryDate: daysFromNow(5) },
  ]);

  addSource({
    id: "hosp-t-nagar-community",
    name: "T. Nagar Community Hospital",
    type: "hospital",
    location: { lat: 13.0418, lng: 80.2341 },
    address: "8 Usman Road, T. Nagar, Chennai",
    phone: "+91-44-5550-3030",
    verified: true,
    apiKey: "key_tnagar_community",
  });
  addInventory("hosp-t-nagar-community", [
    { bloodGroup: "B+", component: "rbc", unitsAvailable: 4, expiryDate: daysFromNow(18) },
    { bloodGroup: "O-", component: "rbc", unitsAvailable: 0, expiryDate: daysFromNow(0) },
  ]);

  addSource({
    id: "bank-chennai-metro",
    name: "Chennai Metro Blood Bank",
    type: "blood_bank",
    location: { lat: 13.0674, lng: 80.2376 },
    address: "21 Poonamallee High Road, Chennai",
    phone: "+91-44-5550-4040",
    verified: true,
    apiKey: "key_chennai_metro_bank",
  });
  addInventory("bank-chennai-metro", [
    { bloodGroup: "O-", component: "rbc", unitsAvailable: 12, expiryDate: daysFromNow(35) },
    { bloodGroup: "AB-", component: "plasma", unitsAvailable: 6, expiryDate: daysFromNow(90) },
    { bloodGroup: "B+", component: "platelets", unitsAvailable: 8, expiryDate: daysFromNow(4) },
    { bloodGroup: "A-", component: "rbc", unitsAvailable: 3, expiryDate: daysFromNow(12) },
  ]);

  addSource({
    id: "bank-southline",
    name: "Southline Blood Services",
    type: "blood_bank",
    location: { lat: 12.9915, lng: 80.2203 },
    address: "60 GST Road, Chennai",
    phone: "+91-44-5550-5050",
    verified: false, // deliberately unverified — exercises the hard-constraint filter
    apiKey: "key_southline",
  });
  addInventory("bank-southline", [
    { bloodGroup: "O-", component: "rbc", unitsAvailable: 20, expiryDate: daysFromNow(40) },
  ]);
}

seed();

// --- public store API ----------------------------------------------------

export const store = {
  // sources
  getSource: (id) => sources.get(id) ?? null,
  listSources: () => Array.from(sources.values()),
  updateSource: (id, patch) => {
    const doc = sources.get(id);
    if (!doc) return null;
    Object.assign(doc, patch);
    return doc;
  },

  // inventory (sources/{id}/inventory)
  getInventory: (sourceId) => inventories.get(sourceId) ?? null,
  upsertInventoryItem: (sourceId, { bloodGroup, component, unitsAvailable, expiryDate }) => {
    const list = inventories.get(sourceId);
    if (!list) return null;
    const existing = list.find((i) => i.bloodGroup === bloodGroup && i.component === component);
    if (existing) {
      if (unitsAvailable !== undefined) existing.unitsAvailable = unitsAvailable;
      if (expiryDate !== undefined) existing.expiryDate = expiryDate;
      existing.lastUpdated = now();
      return existing;
    }
    const item = {
      bloodGroup,
      component,
      unitsAvailable: unitsAvailable ?? 0,
      expiryDate: expiryDate ?? null,
      lastUpdated: now(),
    };
    list.push(item);
    return item;
  },

  // requests
  createRequest: (data) => {
    const id = uuid();
    const doc = {
      id,
      ambulanceId: data.ambulanceId,
      bloodGroup: data.bloodGroup,
      component: data.component,
      unitsNeeded: data.unitsNeeded,
      patientLocation: data.patientLocation,
      destinationHospitalId: data.destinationHospitalId,
      etaMinutes: data.etaMinutes,
      status: "requested",
      matchedSourceId: null,
      matchScore: null,
      rejectedSourceIds: [],
      createdAt: now(),
      updatedAt: now(),
      statusHistory: [{ status: "requested", timestamp: now() }],
    };
    requests.set(id, doc);
    return doc;
  },
  getRequest: (id) => requests.get(id) ?? null,
  listRequests: (filter = {}) => {
    let list = Array.from(requests.values());
    if (filter.destinationHospitalId) {
      list = list.filter((r) => r.destinationHospitalId === filter.destinationHospitalId);
    }
    if (filter.matchedSourceId) {
      list = list.filter((r) => r.matchedSourceId === filter.matchedSourceId);
    }
    if (filter.status) {
      list = list.filter((r) => r.status === filter.status);
    }
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },
  updateRequest: (id, patch) => {
    const doc = requests.get(id);
    if (!doc) return null;
    Object.assign(doc, patch, { updatedAt: now() });
    return doc;
  },
  pushStatusHistory: (id, status) => {
    const doc = requests.get(id);
    if (!doc) return null;
    doc.statusHistory.push({ status, timestamp: now() });
    return doc;
  },

  // transfers
  createTransfer: (data) => {
    const id = uuid();
    const doc = {
      id,
      requestId: data.requestId,
      fromSourceId: data.fromSourceId,
      toSourceId: data.toSourceId,
      courierEtaMinutes: data.courierEtaMinutes,
      status: "pending",
      createdAt: now(),
    };
    transfers.set(id, doc);
    return doc;
  },
  getTransfer: (id) => transfers.get(id) ?? null,
  updateTransfer: (id, patch) => {
    const doc = transfers.get(id);
    if (!doc) return null;
    Object.assign(doc, patch);
    return doc;
  },
  listTransfersForRequest: (requestId) =>
    Array.from(transfers.values()).filter((t) => t.requestId === requestId),

  // auth (MVP: API key per source)
  resolveApiKey: (key) => {
    const sourceId = apiKeys.get(key);
    return sourceId ? sources.get(sourceId) : null;
  },
};

export default store;

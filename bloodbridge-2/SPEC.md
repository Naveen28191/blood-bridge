# BloodBridge — Project Specification

## 1. Overview

BloodBridge is a real-time emergency blood coordination system that connects
ambulances, hospitals, blood banks, and verified donors to locate and
coordinate delivery of required blood **before** a patient reaches the
hospital.

**MVP goal:** given an ambulance request (blood group, units, patient
location, ETA), find the best matching blood source (hospital or blood bank)
within reach, and keep all parties updated on status in real time.

Out of scope for MVP: donor network activation, predictive/low-stock alerts,
multi-city analytics dashboard, EMR integration. These are Phase 2/3.

---

## 2. Actors

| Actor | Access | Core actions |
|---|---|---|
| **Ambulance / Paramedic** | Mobile-first PWA | Create a blood request, view matched source + ETA, see live status |
| **Hospital** | Web dashboard | View/manage own inventory, view incoming requests, receive "prep before arrival" alerts, accept/reject requests |
| **Blood Bank** | Web dashboard | Same as hospital, but no patient intake — supply-only role |
| **(Phase 2) Donor** | Mobile app | Opt in/out of availability, receive geofenced activation alerts |

---

## 3. Data Model

### 3.1 `sources` (hospitals + blood banks, unified collection)

```json
{
  "id": "string (uuid)",
  "name": "string",
  "type": "hospital | blood_bank",
  "location": { "lat": "number", "lng": "number" },
  "geohash": "string",              // for proximity queries
  "address": "string",
  "phone": "string",
  "verified": "boolean",
  "createdAt": "timestamp"
}
```

### 3.2 `inventory` (subcollection under `sources/{sourceId}/inventory`)

```json
{
  "bloodGroup": "A+ | A- | B+ | B- | O+ | O- | AB+ | AB-",
  "component": "whole_blood | plasma | platelets | rbc",
  "unitsAvailable": "number",
  "expiryDate": "timestamp",
  "lastUpdated": "timestamp"
}
```

### 3.3 `requests`

```json
{
  "id": "string (uuid)",
  "ambulanceId": "string",
  "bloodGroup": "string (enum as above)",
  "component": "string (enum as above)",
  "unitsNeeded": "number",
  "patientLocation": { "lat": "number", "lng": "number" },
  "destinationHospitalId": "string",
  "etaMinutes": "number",           // ambulance's ETA to hospital
  "status": "requested | matched | in_transit | ready | cancelled",
  "matchedSourceId": "string | null",
  "matchScore": "number | null",
  "createdAt": "timestamp",
  "updatedAt": "timestamp",
  "statusHistory": [
    { "status": "string", "timestamp": "timestamp" }
  ]
}
```

### 3.4 `transfers` (only when blood must move between two sources)

```json
{
  "id": "string (uuid)",
  "requestId": "string",
  "fromSourceId": "string",
  "toSourceId": "string",
  "courierEtaMinutes": "number",
  "status": "pending | dispatched | delivered",
  "createdAt": "timestamp"
}
```

---

## 4. Matching Engine

### 4.1 Inputs

```
request: {
  bloodGroup, component, unitsNeeded,
  patientLocation, destinationHospitalId, etaMinutes
}
candidateSources: [ { source, inventoryForGroup, distanceFromDestination } ]
```

### 4.2 Scoring formula

```
score =  w1 * (unitsAvailable - unitsNeeded)       // surplus buffer
       + w2 * (1 / travelTimeMinutes)              // speed to hospital
       + w3 * inventoryFreshnessScore              // days until expiry, normalized 0-1
       - w4 * distanceKm                           // distance penalty

Default weights: w1 = 0.3, w2 = 0.4, w3 = 0.2, w4 = 0.1
```

### 4.3 Hard constraints (exclude candidate if violated)

- `unitsAvailable < unitsNeeded`
- `travelTimeMinutes > etaMinutes + 15` (buffer, in minutes)
- `source.verified == false`

### 4.4 Priority order

1. Destination hospital's own stock (no transfer needed)
2. Nearby hospitals with matching stock
3. Nearby blood banks
4. *(Phase 2)* Verified on-call donors

### 4.5 Output

Ranked list of candidates with score, sorted descending. Top candidate is
auto-matched; next 2 are shown as fallback options to the hospital dashboard.

---

## 5. API Contract (MVP)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/requests` | Ambulance creates a new blood request |
| GET | `/api/requests/:id` | Get request status + matched source |
| PATCH | `/api/requests/:id/status` | Update status (matched, in_transit, ready, cancelled) |
| GET | `/api/sources/:id/inventory` | Get a source's current inventory |
| PATCH | `/api/sources/:id/inventory` | Update stock counts (manual entry, MVP) |
| POST | `/api/match` | Run matching engine for a given request, returns ranked candidates |
| GET | `/api/sources/nearby` | Query sources near a lat/lng within radius |

All endpoints return JSON. Auth: simple API key per source for MVP;
proper auth (Firebase Auth) is Phase 2.

---

## 6. Real-time Status Flow

```
requested → matched → in_transit → ready
                  ↘ cancelled (any stage)
```

- Ambulance and hospital both subscribe to the same `requests/{id}` document.
- Any status change is pushed via Firestore listeners (or WebSocket if not
  using Firebase) to both dashboards within ~1s.
- When status becomes `matched`, the matched source's dashboard gets a
  **"prep before arrival"** banner showing blood group, units, and a live
  countdown based on `etaMinutes`.

---

## 7. Tech Stack (MVP)

- **Frontend:** React + Tailwind, PWA-installable for ambulance use
- **Backend:** Node.js + Express (Cloud Run)
- **Database:** Firestore (documents above map directly to collections)
- **Realtime:** Firestore listeners
- **Geo queries:** Firestore + geohash (e.g. `geofire` library) for MVP;
  migrate to PostGIS if scale demands it later
- **Maps/ETA:** Google Maps Distance Matrix API
- **Notifications:** Firebase Cloud Messaging (push to dashboards/app)
- **Auth:** API key per source (MVP) → Firebase Auth (Phase 2)

---

## 8. Build Order / Milestones

| Day | Milestone |
|---|---|
| 1 | Firestore schema live, Cloud Run skeleton deployed |
| 2 | Matching engine complete with unit tests (5+ scenarios incl. no-match) |
| 3 | Ambulance request flow + hospital dashboard, wired to seed/test data |
| 4 | End-to-end realtime status sync working |
| 5 | Maps ETA integration, notifications, demo polish |

---

## 9. Non-functional requirements

- Status updates must propagate to all subscribed clients in **< 2 seconds**
- Matching engine must return a ranked result in **< 1 second** for up to
  50 candidate sources
- All timestamps stored in UTC; displayed in local time client-side
- No PII beyond what's needed for coordination (no patient names/records —
  only blood group, location, ETA)

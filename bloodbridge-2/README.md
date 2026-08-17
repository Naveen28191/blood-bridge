# BloodBridge

Real-time emergency blood coordination system — ambulances, hospitals, and
blood banks connected to locate and coordinate delivery of required blood
before a patient reaches the hospital. Built against `SPEC.md`.

This repo has two apps:

```
bloodbridge/
├── backend/     Node.js + Express API, matching engine, Socket.io realtime
└── frontend/    React + Tailwind (ambulance PWA + hospital/blood bank dashboard)
```

**MVP substitution note:** the spec calls for Firestore, Firebase Auth, and
the Google Maps Distance Matrix API. Those need your own cloud
credentials, so this build uses an in-memory data store shaped exactly
like the Firestore collections, Socket.io in place of Firestore listeners
(the spec explicitly allows this fallback), and a haversine-distance ETA
estimate in place of the Maps API. Every place this matters is commented
in the code (`backend/src/data/store.js`, `backend/src/lib/eta.js`,
`backend/src/lib/geo.js`) so swapping in the real services later is a
small, contained change — not a rewrite.

---

## 0. Before you start

You'll need on your Mac:

- **Node.js 18+** — check with `node -v` in Terminal. If you don't have it:
  ```bash
  brew install node
  ```
  (If you don't have Homebrew: install it first from https://brew.sh)
- **Git** — check with `git -v`. Macs usually have this already; if not,
  `brew install git`.
- A **GitHub account**, and (recommended) the **GitHub CLI**:
  ```bash
  brew install gh
  gh auth login
  ```
  You can also just use the GitHub website instead of `gh` — both paths
  are below.

---

## 1. Get the project onto your Mac

If you're reading this after downloading the files Claude gave you, unzip
them into a folder, then open **Terminal** (Cmd+Space → type `Terminal`)
and `cd` into it:

```bash
cd ~/Downloads/bloodbridge   # adjust to wherever you put it
```

---

## 2. Run the backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

You should see:

```
BloodBridge backend listening on http://localhost:4000
Socket.io realtime layer active (CORS origin: http://localhost:5173)
```

Leave this Terminal tab running. Quick check it's alive — open a **new**
Terminal tab (Cmd+T) and run:

```bash
curl http://localhost:4000/api/health
```

You should get back `{"ok":true, ...}`.

### Run the matching engine tests (optional but recommended)

Still in `backend/`:

```bash
npm test
```

You should see 10 passing tests covering priority tiers, hard constraints,
scoring, and fallback — including the "no-match" scenarios called out in
the spec's build milestones.

---

## 3. Run the frontend

Open **another** new Terminal tab (Cmd+T), then:

```bash
cd frontend    # from the bloodbridge/ root, or ../frontend if you're still in backend/
npm install
npm run dev
```

You should see something like:

```
VITE ready
➜  Local:   http://localhost:5173/
```

Open that URL in your browser. You'll land on the BloodBridge role picker.

**Try it end to end:**
1. Open **http://localhost:5173** in one browser tab → choose **"I'm in an
   ambulance"** → fill out a request (pick a blood group, a Chennai-area
   location preset, a destination hospital) → **Dispatch request**.
2. Open **http://localhost:5173/dashboard/login** in a second tab → pick
   the hospital/blood bank the request matched to (the API key is
   prefilled for the demo) → **Sign in**.
3. Watch the dashboard — you should see the "prep before arrival" banner
   with the live countdown ring, and the same request updating in real
   time in the ambulance tab, with no page refresh needed on either side.

Both dev servers auto-reload on file changes (`npm run dev` uses `--watch`
on the backend and Vite's HMR on the frontend), so you can edit code and
just save.

---

## 4. Put it on GitHub

### Option A — using the `gh` CLI (fastest)

From the `bloodbridge/` root folder:

```bash
git init
git add .
git commit -m "Initial commit: BloodBridge MVP"
gh repo create bloodbridge --private --source=. --remote=origin --push
```

`--private` keeps it private; use `--public` instead if you want it
public. This single `gh repo create` command creates the GitHub repo *and*
pushes your code in one step.

### Option B — using the GitHub website

1. Go to https://github.com/new, name it `bloodbridge`, **don't**
   initialize it with a README (you already have one), click **Create
   repository**.
2. GitHub will show you a page with a remote URL like
   `https://github.com/YOUR-USERNAME/bloodbridge.git`. Back in Terminal,
   from the `bloodbridge/` root:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: BloodBridge MVP"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/bloodbridge.git
   git push -u origin main
   ```

### After the first push

Any time you make changes:

```bash
git add .
git commit -m "describe what changed"
git push
```

---

## 5. What's already set up to keep out of Git

A `.gitignore` is included at the root so `node_modules/`, `.env`, and
build output (`dist/`) don't get committed. If you ever see `node_modules`
show up in `git status`, double check you're running `git` from the repo
root and that `.gitignore` is present there.

---

## 6. Project structure reference

```
backend/
  src/
    server.js              Express + Socket.io entrypoint
    data/store.js           In-memory store (Firestore-shaped collections + seed data)
    lib/matchingEngine.js   Pure scoring/matching function (spec section 4)
    lib/candidateBuilder.js Bridges store -> matching engine input shape
    lib/matchOrchestrator.js Runs a match against a persisted request, applies result
    lib/geo.js, lib/eta.js  Distance + ETA helpers (stand in for geofire / Google Maps)
    middleware/auth.js      API-key auth (spec section 5)
    routes/                 requests.js, sources.js, match.js
    socket.js                Realtime rooms/events (spec section 6)
    __tests__/matchingEngine.test.js   10 unit tests incl. no-match scenarios

frontend/
  src/
    pages/Ambulance/        NewRequest.jsx, RequestStatus.jsx
    pages/Dashboard/        Login.jsx, Layout.jsx, Inventory.jsx, IncomingRequests.jsx
    components/             EtaRing.jsx (countdown ring), RequestCard.jsx, PrepBanner.jsx, ...
    lib/                    api.js (REST client), socket.js + hooks.js (realtime)
    context/SessionContext.jsx   Dashboard login session (source + API key)
```

## 7. Known gaps vs. the spec (documented, not hidden)

- **Real-time transport**: Socket.io, not Firestore listeners (see note
  above) — same effect, different plumbing.
- **Auth**: MVP API-key check only; no Firebase Auth (spec marks that
  Phase 2). The dashboard login page shows demo keys directly since
  there's no out-of-band way to deliver them in a local demo — remove
  that panel before any real deployment.
- **ETA/distance**: haversine straight-line estimate with a traffic
  padding factor, not live Google Maps traffic data.
- **PWA**: manifest + a minimal (non-caching) service worker are wired up
  so the ambulance app is installable; there are no app icon PNGs yet —
  drop `icon-192.png` / `icon-512.png` into `frontend/public/icons/` to
  finish that.
- **Data persistence**: in-memory — restarting the backend resets to seed
  data. Swapping `backend/src/data/store.js` for a real Firestore client
  is the natural next step; every other file talks to it through the same
  function calls, so nothing else needs to change.

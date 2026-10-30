# Architecture

## Runtime paths

`public/` is a buildless ES-module web app. `public/model.js` is the shared transition engine. It runs unchanged in the browser sandbox and the local Node server.

Local: Browser → Node HTTP API → SQLite state row. A `BEGIN IMMEDIATE` transaction checks the state revision, executes a role-checked transition, and commits the complete result. A failed transition leaves the prior state intact. Sessions are random, short-lived demonstration tokens. No external session/authentication service is implied.

Hosted example: Browser → IndexedDB read/write transaction → same transition engine. BroadcastChannel and polling refresh other tabs. This is per-origin, per-browser demonstration storage, not shared cloud infrastructure.

Camera: browser `getUserMedia` / image upload → OpenCV.js in-memory quality processing, or local `/api/vision` → Python OpenCV subprocess via stdin/stdout. No shell interpolation, image files or persisted image blobs. Optional `/api/scene` requires image-sharing consent and server environment credentials.

Hospital directory: explicit coordinate search → Nominatim → hospital-feature and distance filter. If unavailable, try Overpass. SQLite mode caches results for five minutes. The directory never adds institutions to the fictional capacity database.

## State machines

Incident: reported → requested → accepted → en_route (when transport assigned) → arrived → discharged.

A reroute creates `reroute_pending`, retaining `hospitalId` while storing the alternative in `proposedHospitalId`. On acceptance, the new hospital becomes the destination; on decline, the original accepted/en-route state resumes. The original capacity commitment remains counted while the alternative is pending. Pending requests themselves do not reserve capacity; acceptance is the atomic commit point.

Supply: requested → approved → received. Each receipt creates a new active batch with future expiry. Expired stock remains separately quarantined until a disposal record with a certificate is recorded. This is a ledger, not proof of real disposal.

Claims: submitted → approved → simulated_paid. A tariff snapshot is captured at creation and cannot change when the current tariff is revised. Settlement groups approved claims by hospital and cannot pay them twice.

Incident reports: draft → simulated_acknowledgement. No submitted-to-police/FIR state is falsely asserted.

## API

- `GET /api/health`: runtime and optional AI configuration flags, never keys.
- `POST /api/session {role}`: freely selectable demo session.
- `GET /api/state`: bearer-authenticated shared prototype state.
- `POST /api/action {revision, action, payload}`: role-checked transition.
- `GET /api/hospitals?lat=…&lon=…&radius=…`: live named hospital directory.
- `POST /api/vision {image}`: OpenCV image-quality result.
- `POST /api/scene {image,consent:true}`: optional provider scene observations.
- `POST /api/reset`: administration-only demonstration reset.

Use the interface or `examples/journey.mjs` for action payload examples. Sessions are not real identity: production needs verified staff accounts and facility-scoped authorisation.

## Deliberate prototype limits

The complete demo state is readable to any selected demo role; it contains fictional data only. Audit records are editable by whoever owns the database, so they are not tamper-evident compliance evidence. Capacity freshness is shown, but clinical suitability and staffing require human verification. Distance is straight-line; no traffic or real ETA is inferred. One requested OPD slot locks a facility/time combination; production needs department/provider-specific calendars. Weekly payouts and supplier activities are manually driven simulations. There is no claim of national deployment, clinical approval, guaranteed admission, or complete directory coverage.

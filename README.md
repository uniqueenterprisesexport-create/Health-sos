# Health SOS

Patient-first emergency assistance with real address/hospital search, concise first-aid prompts, automatic **in-app** reservations, and hospital, ambulance, pharmacy, police and administration workspaces.

Live app: https://health-sos-kappa.vercel.app/

Hospital names and addresses come from OpenStreetMap. Hospital capacity and all hospital/police operations are demonstration workflows. One preview label in the interface explains this boundary: the app does not actually reserve external beds, dispatch ambulances, register FIRs, order stock or move money.

## Run locally

Use Node.js 24.x and Python 3.10+:

```bash
git clone https://github.com/uniqueenterprisesexport-create/Health-sos.git
cd Health-sos
python -m pip install -r vision/requirements.txt
npm run setup:opencv
npm start
```

Open http://127.0.0.1:3000. No API key is required for address search, hospital listings or browser OpenCV processing. SQLite is created at `.data/prototype.sqlite` and can be discarded after a demonstration. On Windows, set `PYTHON=python` or `PYTHON=py` in your shell if `python3` is unavailable.

## Patient flow

- Enter an address, area or landmark and choose a returned location; or use GPS. Coordinates stay internal.
- Real nearby hospitals appear with source links, directions and available telephone numbers. Directory listings do not establish current availability or clinical suitability.
- Save an incident with only the location and incident type. Patient name, phone, observations and access notes are optional.
- The app automatically records a capacity reservation in the preview workspace. No hospital acceptance step is required. The patient is prompted to call the hospital to confirm external admission.
- A hospital operator can reroute to an alternative with workspace capacity. The transfer is atomic: if the alternative is unavailable, the original reservation remains.
- First aid uses a single question or instruction at a time, large answer buttons and optional speech. Danger responses immediately escalate to 112 without requiring completion of all questions. Camera use is optional and does not delay emergency calls.

## Police desk

Road-accident incidents automatically create a local case intake. Police operators can assign a station/officer, edit facts, prepare an FIR draft, download a draft, close/reopen cases and record a reference **already issued externally**. An issued reference requires explicit operator attestation and is marked operator-reported, not verified or submitted by Health SOS. The app never invents an FIR number or claims registration.

## Other workspaces

Hospital capacity, walk-ins, handover, discharge, ambulance assignments, outpatient requests, batch stock, expiry quarantine, replenishment, disposal records, versioned tariffs, claims and settlement ledgers remain usable. Staff roles are selectable preview workspaces, not verified professional identities.

## Storage and deployment

Local: Node HTTP API + transactional SQLite with role checks and revision conflict detection.

Vercel: static frontend + stateless functions for health, real hospital queries, address geocoding and optional AI scene descriptions. Records use transactional IndexedDB in the browser. Tabs share one browser/origin database; separate devices do not. Camera processing uses real OpenCV.js / WebAssembly. The build downloads the pinned, checksum-verified runtime. See `docs/VERCEL.md`.

Earlier local records are preserved and normalised to the automatic reservation workflow. Reservations stay explicitly internal to the preview environment.

## Address-service policy

The implementation deliberately uses OpenStreetMap's public Nominatim service for a small, manually operated prototype. Read its usage policy: https://operations.osmfoundation.org/policies/nominatim/.

There is no autocomplete or periodic geocoding. Searches occur only on explicit submission, are cached for 30 minutes per process, and are serialised at least 1.1 seconds apart per process. These limits are **not a distributed global limiter**: use a hosted/self-managed geocoder and shared rate limiting before increasing traffic. Aggregate requests across all users must respect the provider's maximum of one request per second. Server deployments can change `GEOCODER_BASE_URL` without editing source. Keep OpenStreetMap attribution visible.

## OpenCV and optional AI

`public/camera.js` and `vision/analyze.py` measure brightness, Laplacian sharpness and edge density. Images are processed in memory and not stored. These are engineering image-quality checks, not injury diagnosis.

Optional scene description uses a configurable vision-capable OpenRouter model. Configure `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` server-side. On Vercel, also explicitly enable `HEALTH_SOS_AI_ENABLED=true` after setting access and spend controls. The image is sent to that provider only after the user's separate permission. Generated observations are unverified and never determine medical treatment. The feature remains off without configuration.

First-aid content requires qualified clinical review and validation before clinical deployment. Follow the emergency dispatcher; call 112 for real emergencies.

## Checks

```bash
npm run check
npm test
python tests/vision_test.py
npm run demo
npm run build:vercel
```

Tests cover automatic reservations and last-bed conflicts, atomic rerouting, police role permissions and reference provenance, stock expiry, immutable tariff snapshots, one-time settlement, API boundaries and actual Python OpenCV image analysis.

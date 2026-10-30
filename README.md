# Health SOS · NEEEV Emergency Grid

A runnable, patient-first emergency coordination **prototype**: a camera-assisted incident workspace, real nearby hospital directory, receiving-hospital acceptance, ambulance assignment, accountable rerouting, inpatient/OPD handling, batch-level pharmacy stock, supplier/disposal queues, agreement tariffs, claims, and simulated weekly settlements.

**This is not a clinical service. Do not use it for real emergencies or real patient data. Call 112 in India for emergency assistance.** Hospital capacity, staff, ambulances, tariffs, government actions, reports, supplies and payments in this repository are explicitly fictional. Nothing contacts emergency services, files an FIR, orders real medicine, or moves money.

## Deploy to Vercel

Import this repository into Vercel. The included `vercel.json` selects the static frontend plus stateless API functions, downloads the checksum-verified OpenCV.js runtime during the build, and serves `dist/`. The five prototype workspaces share an IndexedDB database within one browser/origin. They do not use Vercel function memory or temporary files as a shared SQLite database. No API key is required for the core demo. See `docs/VERCEL.md` for deployment and optional server-side OpenRouter settings.

## Run locally

Requirements: **Node.js 24+**, **Python 3.10+**, and internet access for the live hospital directory. Core server and UI have **zero npm dependencies**.

```bash
git clone https://github.com/uniqueenterprisesexport-create/Health-sos.git
cd Health-sos
python -m pip install -r vision/requirements.txt
npm run setup:opencv
npm start
```

Open **http://127.0.0.1:3000**. On Windows, use `py -m pip` if appropriate and set `PYTHON=py` in your shell if `python3` is not available. No API key is needed for the core demo.

SQLite is automatically created at `.data/prototype.sqlite`. It is disposable but survives process restarts. To get an in-memory database on macOS/Linux:

```bash
HEALTH_SOS_DB=:memory: npm start
```

PowerShell:

```powershell
$env:PYTHON="python"
$env:HEALTH_SOS_DB=":memory:"
npm start
```

The freely selectable role menu is **demonstration access**, not production authentication. Demo API sessions are server-issued and role-checked, but anyone opening this prototype can choose any role. Bind defaults to loopback. `HOST=0.0.0.0` is for a trusted demonstration network only; do not expose this data model as a patient system.

## Hosted example versus full local prototype

The hosted example serves the same UI and domain rules with **IndexedDB** as a temporary browser database. Multiple tabs on the same browser/origin share it, with transactional writes and update notifications. Different devices do not share that database.

The local Node server uses **SQLite**, role-scoped demo sessions, revision checks, atomic transitions, shared multi-browser state, an automatic inventory sweep, server-side hospital-directory caching, and Python OpenCV. The hosted static example uses actual **OpenCV.js** locally in the browser instead. If Python is unavailable in the local preview, the camera falls back to the browser engine and displays the engine used. The app labels the active storage mode.

The application shell caches after the first online visit. Directory lookups, external maps and optional AI still need network access. A camera requires HTTPS or localhost; image upload works as an alternative. Device permission and hardware availability are browser-controlled.

## Try a complete journey

1. Patient & family → **Start a sample journey**. Confirm permission for the fictional notes and create the incident.
2. The nearest suitable fictional facility is requested automatically when that checkbox is enabled; **Request hospital** lets you choose another demo facility. Real hospital directory listings are deliberately separate from simulated participating facilities.
3. Switch to **Hospital team** → accept the request. Capacity is committed only after acceptance.
4. Switch to **Ambulance dispatch** → assign an available fictional unit.
5. Hospital team → **Propose reroute**. The original destination and commitment remain until the alternative hospital accepts. Declining the proposal restores the existing journey.
6. Hospital team → **Receive handover**. A staffed bed becomes occupied and the ambulance becomes available.
7. Hospital team → create a claim. Administration → **Tariffs & claims** → approve it and run the simulated weekly settlement. No funds move.
8. Pharmacy → inspect automatic low-stock and expired-batch requests. Administration → **Supply & collection** → approve supply and record a demonstration disposal certificate. Pharmacy → receive the approved supply into a **new batch**.
9. Patient → prepare a family update or request a non-emergency OPD slot. Hospital staff must confirm the OPD slot.
10. Inspect **Activity log**, or export/reset the sandbox through Administration.

A dependency-free command-line example exercises the same domain rules:

```bash
npm run demo
```

## Actual OpenCV functionality

Two implementations are included and exercised independently:

- `vision/analyze.py`: decodes the image with `cv2.imdecode`, scales it, converts to grayscale, computes mean brightness and Laplacian variance, and measures Canny edge density.
- `public/camera.js`: runs equivalent processing with **OpenCV.js / WebAssembly**. Mats are released after use. The official runtime is downloaded by `npm run setup:opencv` with a pinned SHA-256 check; the browser can also load the same official version when the local asset is absent.

Camera frames and uploads are processed in memory, never written to SQLite or disk. Image-quality warnings are **engineering heuristics**, not medical validation. Camera images cannot establish normal breathing, internal injuries, consciousness or treatment needs. The reference first-aid flow is selected from explicit user answers, not visual diagnoses, and requires qualified clinical review before deployment.

## Optional OpenRouter scene observations

The local server and optional Vercel scene function support a configurable vision-capable model. Export these values in your environment (the `.env.example` file is documentation, not automatically loaded):

```bash
export OPENROUTER_API_KEY='your-key'
export OPENROUTER_MODEL='your-provider/your-vision-model'
npm start
```

Use **Emergency help → Optional AI scene description**, select an image, explicitly consent, and request a description. The image is sent to the configured provider only then. The prompt restricts output to unverified visible observations, not diagnosis or generated treatment instructions. Provider availability, cost and data handling depend on your chosen model. Keys remain server-side and are not stored in the browser or repository. Without credentials, the rest of the prototype works and this feature returns an explicit configuration message.

## Real nearby hospitals

Choose **Nearby hospitals → Use my location**, or enter coordinates and press Search. The default coordinates are an explicitly labelled Delhi example, not your detected location.

Live results come from OpenStreetMap Nominatim, with Overpass as a fallback. They are filtered to hospital features and the requested radius, with straight-line distances, source links and retrieval time. Nominatim returns a limited result set: it is not an exhaustive list. A listing does not confirm emergency capability, staffed beds, current opening hours or hospital participation. Failed requests show an error, never substitute fictional hospitals. Manual searches only; the local server caches results for five minutes. Respect upstream usage policies and use an appropriate hosted provider for scale.

## Implemented safeguards and additional workflows

- Unknown-patient labels; no mandatory bystander identity or payment gate.
- Explicit hospital acknowledgement and capability matching.
- Single capacity ledger for incoming commitments, walk-ins and handovers.
- Reroute proposals retain the original accepted destination until alternative acceptance.
- Arrival fails if physical capacity has become unavailable, requiring clinical escalation.
- OPD requests require staff confirmation and reject duplicate requested slots.
- Expired/quarantined stock cannot be dispensed. New supply creates a separate batch.
- Automatic low-stock requests are deduplicated across the same item/facility. A local server sweep runs every minute and after each successful domain transition; browser mode evaluates at startup and after transitions.
- Draft incident notifications and simulated acknowledgements are never labelled FIRs.
- Tariff versions are immutable in claim snapshots; duplicate same-service claims and repeat settlement are rejected.
- Weekly settlement is a **manual simulation trigger**; production needs funded accounts, claims rules and a real scheduler.
- Consent-aware, prepared-only family messages. Nothing is automatically sent.
- Role checks, same-origin mutation protection, input limits, audit events, and optimistic concurrency in the SQLite server.
- Images excluded from persistent records; external-provider image sharing is opt-in.

## Verification

```bash
npm run check
npm test
python tests/vision_test.py
npm run demo
```

See `docs/ARCHITECTURE.md`, `docs/DEMO.md`, and `docs/PRODUCTION.md`. Browser QA covers patient incident creation, hospital acceptance, actual hospital directory results, and OpenCV image processing; synthetic images are used for camera testing, never patient photos.

## Integration boundaries

No authorised interface to 112, eDAR/police, hospitals, government procurement, insurers or payment providers is configured. The prototype implements the local workflows and honest simulation states for those integrations. Government prices are not universally imposed by an app: real billing must use the applicable law, scheme, state rules and participating agreements.

The production design must be evaluated against existing emergency and road-accident-care infrastructure. It should interoperate with those systems through authorised interfaces, not claim to replace them.

# Architecture

`public/model.js` provides the same domain transitions to the SQLite server and the browser's IndexedDB transactions. Vercel uses IndexedDB for preview records and stateless Node functions for external directory/geocoding/AI requests. The local Node server uses an atomic SQLite transaction and revision check.

## Incident lifecycle

Reported → automatically reserved in this workspace → en route → handover complete → discharged.

Directory-only destinations without configured capacity can be selected without claiming a reservation. Preview capacity is explicitly tagged and external confirmation remains false. Hospital operators alone can reroute. A valid reroute commits the new hold and releases the previous hold in one transition. A failed reroute leaves the previous state unchanged. There is no hospital accept/decline gate.

## Police lifecycle

Road accident → local case intake → review / FIR draft → optional externally-issued reference recorded → closed. A closed case can be reopened.

Reference entry requires an operator attestation and is marked `operator_reported`. `externalSubmission` remains false. No report-submission integration or FIR-registration service is configured.

## Locations

Users enter addresses or select GPS, not coordinates. `public/places.js` implements explicit, cached, throttled geocoding and reverse geocoding. No autocomplete. `api/places.js` exposes the same adapter through Vercel. Coordinates remain internal to distance and map calculations. Source links and OpenStreetMap attribution accompany hospital results.

## First aid and camera

The interface displays one question or instruction at a time. Urgent responses short-circuit the questionnaire. Spoken prompts are optional. OpenCV checks are separate from the reference guidance and never infer normal breathing, consciousness or internal injury.

## Other ledgers

Batch expiry blocks dispensing. Replenishment receipts create a separate batch. Claims retain an immutable tariff snapshot; settlement cannot pay a claim twice. These are local preview ledgers rather than government pricing, supply or financial integrations.

## Boundaries

Preview roles are freely selectable, storage is not a cross-device clinical system, and local audit records are not tamper-proof official evidence. Directory listings and real hospital names do not imply participation or verified capacity. Real operation requires verified identities, authorised partner integrations, clinical validation and shared durable storage.

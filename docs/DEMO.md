# Competition demonstration

## 90-second connected journey

1. Explain that the interface is a prototype with fictional capacity, not an active emergency service.
2. Patient: start a sample incident, send a hospital request.
3. Hospital: accept. Show reduced uncommitted capacity.
4. Dispatch: assign Unit 01.
5. Hospital: propose rerouting. Show the existing destination retained; accept at the alternative.
6. Receive the handover. Show ambulance availability restored.
7. Create claim; administration approves and runs weekly simulation. Show the transfer ledger and preserved tariff snapshot.
8. Pharmacy: show automatic low-stock and expiry requests. Administration approves, pharmacy receives a new batch.

## OpenCV example

Use a synthetic image (a checkerboard or printed pattern), not a patient image. Open Emergency help → upload → Check image with OpenCV. Show engine name, brightness, detail and dimensions. Repeat with a dark/blurred frame to trigger a quality warning. Explain that quality measurement cannot establish an injury diagnosis.

## Real hospital example

Enter 28.5672, 77.2100 and an 8 km radius. Search. Results are real OpenStreetMap records; use source links to verify. Results depend on the live service and may change. Show explicitly that listing availability is unverified and capacity commitments exist only in fictional participating facilities.

## Failure examples

- Two incidents request the final free bed: only the first accepted request can consume the commitment.
- Walk-ins consume capacity: the accepted incoming journey is flagged for review; staff propose another hospital.
- No alternative available: the current destination is retained and the operator gets an escalation message.
- An expired batch cannot be dispensed.
- A second settlement run has no eligible claims and is rejected.
- A stale SQLite revision returns HTTP 409 rather than overwriting another operator's update.

`npm run demo` runs an entire journey in memory with no API keys, external services or browser.

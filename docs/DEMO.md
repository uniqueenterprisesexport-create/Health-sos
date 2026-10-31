# Presentation walkthrough

The interface has one discreet preview-environment label. Directory addresses and hospitals are real; capacity and operator workflows are demonstration records.

1. Patient → Find a hospital → enter an address and choose a result.
2. Save an incident. Only location and incident type are needed. Patient details are optional.
3. Show the automatic in-app reservation. There is no hospital acceptance queue.
4. Hospital desk → Reroute. The app moves the reservation to a suitable alternative immediately, without losing the original if transfer fails.
5. Ambulance desk → Assign unit. Hospital desk → Receive patient.
6. Police desk → review the road-accident intake, prepare an FIR draft and download it. Optionally record an already-issued reference; the record stays operator-reported and unverified.
7. Pharmacy → check batch expiry and supply requests. Administration → review tariffs, claims and settlement.
8. First aid → answer one short question at a time. A dangerous answer immediately brings up urgent assistance; no long form or camera upload is required.

For camera processing use an ordinary non-patient test image: upload it and choose Check image. OpenCV reports quality measurements, not a diagnosis.

No external hospital, ambulance, police, supplier or payment service is contacted by preview operations. Call buttons and directions are real links chosen by the user.

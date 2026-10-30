# Deploy Health SOS to Vercel

Import https://github.com/uniqueenterprisesexport-create/Health-sos into Vercel and deploy its `main` branch. Root directory: repository root. `vercel.json` sets Framework Preset to Other, Build Command to `npm run build:vercel`, and Output Directory to `dist`. Use Node.js 24.x.

The build downloads the pinned, checksum-verified OpenCV.js runtime and bundles it with the frontend. No Python installation or API key is required for the core hosted demonstration.

## Hosted storage and functions

The five workspaces use the same transactional IndexedDB sandbox in a single browser/origin. Multiple tabs share that sandbox; different devices do not. Do not use a Vercel function's local filesystem or process memory as a shared database. The SQLite multi-browser server remains available with `npm start` for a local demonstration.

Vercel serves the static UI and three stateless Node functions:

- `/api/health`: reports browser-sandbox mode and optional AI configuration.
- `/api/hospitals`: validates coordinates and queries the real OpenStreetMap directory; no invented fallback names.
- `/api/scene`: optional, consent-gated OpenRouter scene description. It never generates treatment instructions.

Camera processing runs in the browser through actual OpenCV.js / WebAssembly. Camera permission requires HTTPS, which Vercel supplies.

## Optional paid AI

The app works without these settings. To enable scene observations, add `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` (a vision-capable model), and `HEALTH_SOS_AI_ENABLED=true` in Vercel environment variables and redeploy. Keys stay server-side.

The prototype does not verify end-user identities. Keep the deployment protected and configure provider spend limits before enabling paid AI. The enable flag defaults to off to prevent accidental paid use. Real patient images must not be used in this prototype.

## After deployment

1. Open the URL in a browser and check that it opens the patient home screen without an IndexedDB error.
2. Start a sample journey; switch to the hospital workspace to accept it.
3. Emergency help → Try sample image → Check image with OpenCV.
4. Nearby hospitals → Search hospitals or use your location.
5. Open `/api/health`; it must report `mode: "browser"`.

Hospital commitments, ambulance dispatch, police acknowledgements, supply requests and settlement are simulations. Vercel deployment does not establish any real external-service integration.

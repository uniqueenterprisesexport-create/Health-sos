# OpenCV.js

The prepared preview includes the official OpenCV.js 4.13.0 runtime (WebAssembly embedded in JavaScript), downloaded from https://docs.opencv.org/4.13.0/opencv.js.

Upstream: https://github.com/opencv/opencv
License: Apache License 2.0, https://github.com/opencv/opencv/blob/4.13.0/LICENSE

The runtime is a generated 11 MB dependency. `npm run setup:opencv` downloads the pinned, checksum-verified file if a source distribution omits it. The browser also falls back to that exact official URL when the local file is absent.

OpenCV is used for image-quality engineering measurements only. It does not diagnose injuries or validate clinical fitness.

# Leaflet

Leaflet 1.9.4 JavaScript/CSS is vendored from https://unpkg.com/leaflet@1.9.4/dist/. Upstream: https://github.com/Leaflet/Leaflet. BSD 2-Clause license: https://github.com/Leaflet/Leaflet/blob/v1.9.4/LICENSE. Used for a 2D hospital map without requiring WebGL. Map tiles: © OpenStreetMap contributors.

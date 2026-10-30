# GitHub repository

The prototype source is maintained at https://github.com/uniqueenterprisesexport-create/Health-sos.

Clone the repository, install the Python requirements, download the checksum-verified OpenCV browser runtime, and start the server:

```bash
git clone https://github.com/uniqueenterprisesexport-create/Health-sos.git
cd Health-sos
python -m pip install -r vision/requirements.txt
npm run setup:opencv
npm start
```

Use Node.js 24 or newer. The large generated OpenCV runtime is not checked into GitHub. The setup command downloads it; the browser also falls back to the pinned official OpenCV URL if the local runtime is missing.

To publish changes, use a feature branch and an authenticated local Git connection. Never commit API keys or the SQLite runtime database.

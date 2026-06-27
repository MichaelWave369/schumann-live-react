# EIRM PWA Shell

EIRM includes a lightweight service worker for the GitHub Pages app shell.

## What it caches

The service worker caches only the app shell under:

```text
/schumann-live-react/
```

It includes:

- the app entry route
- `index.html`
- the EIRM SVG mark
- the web app manifest
- same-origin app assets requested by the dashboard

## What it does not claim

The PWA shell does not make EIRM a live offline data source.

Schumann visual feeds and NOAA JSON feeds remain network/current sources. If the network is unavailable, the app shell may still open, but live feed data may be missing, stale, or unavailable.

## Registration

The service worker is registered from:

```text
src/registerServiceWorker.js
```

The worker file lives at:

```text
public/eirm-sw.js
```

It is skipped in Vite dev mode and registered only in production builds.

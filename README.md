# EIRM · Earth-Ionosphere Resonance Monitor

A public MIT React + Vite dashboard for live / near-live Schumann resonance viewing with source boundaries, NOAA space-weather context, and a clean adapter for future measured Schumann APIs.

## What it shows

- Live or near-live Schumann spectrogram image with cache-busted refreshes.
- Short EIRM hero identity with the full name preserved as subtitle.
- EIRM logo mark: Earth, ionosphere rings, and resonance waveform.
- Feed freshness console with local and UTC refresh receipts.
- Station/source selector with configured source, Tomsk visual feed preset, and custom permitted image URL mode.
- Persistent station/custom source preferences in local browser storage.
- Visual image health badge: loading, ready, or error.
- Local Observation Log for timestamped research notes, CSV export, JSON export, and JSON import.
- Observation Analytics for local summaries and trend review.
- Local Watchtower for claim-safe threshold review of the latest saved observation snapshot.
- Operator diagnostics panel with copyable runtime JSON.
- Reference Schumann mode grid: SR1 through SR5.
- Optional measured Schumann JSON mode provider.
- Data-confidence badges: visual, reference, measured, NOAA, and ledger.
- Refresh timeline strip for recent feed checks.
- NOAA planetary Kp context.
- NOAA GOES X-ray flux context.
- NOAA real-time solar wind context.
- Claim-safe source ledger and clear data boundaries.
- Configured source map for quick audit and debugging.
- Mobile-polished layout for phone-sized screens.
- SVG favicon and web app manifest metadata.

## Claim boundary

This project is for educational monitoring and pattern-safe exploration. It does **not** claim that Schumann resonance readings cause health symptoms, mood changes, spiritual states, earthquakes, or personal events.

By default, the app treats Schumann frequencies as **reference harmonics** and the spectrogram as the visual receipt. Numeric Schumann mode measurements only switch to measured mode when you configure a permitted JSON provider with `VITE_SR_JSON_URL`.

Observation Log entries are local user notes paired with the current dashboard snapshot. They are useful for personal review, debugging, or later analysis, but they are not evidence of causation by themselves. Observation Analytics and Watchtower states summarize saved local marks only and are not causal analysis.

## Data sources

Default sources are configurable in `.env.example`.

- Schumann spectrogram image: configurable, default `https://schumannresonance.today/live/tomsk1.jpg`
- Optional Schumann JSON provider: `VITE_SR_JSON_URL`
- NOAA planetary Kp: `https://services.swpc.noaa.gov/json/planetary_k_index_1m.json`
- NOAA GOES primary X-ray flux: `https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json`
- NOAA real-time solar wind: `https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json`

Check the terms and usage rules of any spectrogram or Schumann provider before public deployment. NOAA endpoints are public, but production apps should still cache politely and handle downtime gracefully.

## Station / source selector

The visual station selector currently includes:

- **Configured source**: whatever `VITE_SR_SPECTROGRAM_URL` points to.
- **Tomsk visual feed**: the current default public image preset.
- **Custom image URL**: a runtime input for any permitted spectrogram image URL.

The selector changes the visual spectrogram only. Reference harmonics and optional measured JSON remain governed separately so the dashboard does not mix image receipts with numerical measurement claims.

## Observation Log

The local Observation Log lets a user mark a moment and save:

- UTC timestamp.
- Freeform note.
- Current feed status.
- Active visual spectrogram source.
- Image health state.
- Schumann source mode: reference harmonics or measured JSON.
- SR1 reference/measurement value.
- Kp, GOES X-ray class/flux, solar-wind speed, and density.

Entries are stored only in the browser local storage and can be exported as CSV or JSON. JSON import can restore or merge a previous EIRM observation backup. Clearing the log removes local entries from that browser.

## Observation Analytics

Observation Analytics summarizes only the local marks stored in the browser. It currently shows:

- Total marks.
- Average Kp across saved marks.
- Average solar-wind speed across saved marks.
- Most common GOES X-ray class in saved marks.
- First/latest mark time.
- Station count and highest logged Kp.
- Small trend views for Kp, solar wind, and X-ray flux.

These are review tools, not causal statistics.

## Local Watchtower

The Local Watchtower checks the latest saved observation snapshot against local browser thresholds for:

- Kp watch / alert values.
- Solar-wind watch / alert values.
- GOES X-ray watch / alert class.
- Spectrogram image load state.
- Feed availability state.

Rules are stored locally in the browser and can be adjusted or reset. Watchtower states are dashboard awareness markers only; they are not predictions, diagnoses, or causal claims.

## Operator diagnostics

The operator panel exposes a compact runtime JSON snapshot including:

- Current app/feed status.
- Local and UTC refresh receipts.
- Active visual spectrogram URL.
- Image load status and visual failure count.
- Schumann mode source: reference harmonics or measured JSON.
- Key NOAA context values.

This is meant to make bug reports and source-audits easier without turning dashboard output into unsupported claims.

## Optional Schumann JSON shape

The adapter is intentionally flexible. Any of these common field names should work:

```json
{
  "station": "Example Station",
  "updatedAt": "2026-06-27T03:00:00Z",
  "signalQuality": 91,
  "amplitudeIndex": 42,
  "modes": [
    { "mode": "SR1", "frequencyHz": 7.83, "amplitude": 18.2, "qualityFactor": 5.6 },
    { "mode": "SR2", "frequencyHz": 14.3, "amplitude": 8.1, "qualityFactor": 4.8 }
  ]
}
```

Accepted alternates include `harmonics`, `frequency`, `hz`, `amplitude_pT`, `qFactor`, `quality_factor`, `signal_quality`, `time_tag`, and `timestamp`.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Then open the local Vite URL shown in your terminal.

## Build

```bash
npm run build
npm run preview
```

## GitHub Pages

This repo includes `.github/workflows/pages.yml`, which builds the Vite app and deploys `dist/` to GitHub Pages from the `main` branch.

Expected public URL after the first successful deployment:

```text
https://michaelwave369.github.io/schumann-live-react/
```

If the first Pages run asks for configuration, open repository **Settings → Pages** and set **Source** to **GitHub Actions**.

## Deploy elsewhere

- Netlify: import GitHub repo, build command `npm run build`, publish directory `dist`.
- Vercel: import GitHub repo, framework `Vite`, output directory `dist`.

## License

MIT © Michael Hughes and contributors.

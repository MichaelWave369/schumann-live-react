# Schumann Live React

A public MIT React + Vite dashboard for live / near-live Schumann resonance viewing with source boundaries, NOAA space-weather context, and a clean adapter for future measured Schumann APIs.

## What it shows

- Live or near-live Schumann spectrogram image with cache-busted refreshes.
- Reference Schumann mode grid: SR1 through SR5.
- Optional measured Schumann JSON mode provider.
- NOAA planetary Kp context.
- NOAA GOES X-ray flux context.
- NOAA real-time solar wind context.
- Claim-safe source ledger and clear data boundaries.

## Claim boundary

This project is for educational monitoring and pattern-safe exploration. It does **not** claim that Schumann resonance readings cause health symptoms, mood changes, spiritual states, earthquakes, or personal events.

By default, the app treats Schumann frequencies as **reference harmonics** and the spectrogram as the visual receipt. Numeric Schumann mode measurements only switch to measured mode when you configure a permitted JSON provider with `VITE_SR_JSON_URL`.

## Data sources

Default sources are configurable in `.env.example`.

- Schumann spectrogram image: configurable, default `https://schumannresonance.today/live/tomsk1.jpg`
- Optional Schumann JSON provider: `VITE_SR_JSON_URL`
- NOAA planetary Kp: `https://services.swpc.noaa.gov/json/planetary_k_index_1m.json`
- NOAA GOES primary X-ray flux: `https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json`
- NOAA real-time solar wind: `https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json`

Check the terms and usage rules of any spectrogram or Schumann provider before public deployment. NOAA endpoints are public, but production apps should still cache politely and handle downtime gracefully.

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

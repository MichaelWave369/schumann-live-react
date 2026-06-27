import { useCallback, useEffect, useMemo, useState } from 'react';

const HARMONICS = [
  { mode: 'SR1', hz: 7.83, note: 'fundamental reference' },
  { mode: 'SR2', hz: 14.3, note: 'common second mode' },
  { mode: 'SR3', hz: 20.8, note: 'common third mode' },
  { mode: 'SR4', hz: 27.3, note: 'common fourth mode' },
  { mode: 'SR5', hz: 33.8, note: 'common fifth mode' }
];

const DEFAULTS = {
  spectrogram: import.meta.env.VITE_SR_SPECTROGRAM_URL || 'https://schumannresonance.today/live/tomsk1.jpg',
  schumannJson: import.meta.env.VITE_SR_JSON_URL || '',
  kp: import.meta.env.VITE_NOAA_KP_URL || 'https://services.swpc.noaa.gov/json/planetary_k_index_1m.json',
  xray: import.meta.env.VITE_NOAA_XRAY_URL || 'https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json',
  wind: import.meta.env.VITE_NOAA_WIND_URL || 'https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json'
};

const initialState = {
  status: 'loading',
  message: 'Connecting to public feeds…',
  updatedAt: null,
  schumann: {
    measured: false,
    station: 'Reference harmonics',
    updatedAt: null,
    signalQuality: null,
    amplitudeIndex: null,
    modes: HARMONICS.map((item) => ({ mode: item.mode, frequencyHz: item.hz, source: 'reference' }))
  },
  space: {
    kp: { current: null, max24h: null, avg24h: null, points: [] },
    xray: { flux: null, classLabel: '—', points: [] },
    wind: { speed: null, density: null, temperature: null, points: [] }
  }
};

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function latest(array) {
  return Array.isArray(array) && array.length ? array[array.length - 1] : null;
}

function avg(values) {
  const usable = values.filter((value) => Number.isFinite(value));
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null;
}

function fmt(value, digits = 1, suffix = '') {
  return Number.isFinite(value) ? `${value.toFixed(digits)}${suffix}` : '—';
}

function readTime(row) {
  return row?.time_tag || row?.timeTag || row?.time || row?.date || row?.timestamp || row?.updatedAt || null;
}

function readFirstNumber(row, keys) {
  for (const key of keys) {
    const value = asNumber(row?.[key]);
    if (value !== null) return value;
  }
  return null;
}

function xrayClass(flux) {
  if (!Number.isFinite(flux) || flux <= 0) return '—';
  if (flux >= 1e-4) return `X${(flux / 1e-4).toFixed(1)}`;
  if (flux >= 1e-5) return `M${(flux / 1e-5).toFixed(1)}`;
  if (flux >= 1e-6) return `C${(flux / 1e-6).toFixed(1)}`;
  if (flux >= 1e-7) return `B${(flux / 1e-7).toFixed(1)}`;
  return `A${(flux / 1e-8).toFixed(1)}`;
}

async function getJson(url, signal) {
  const response = await fetch(url, { signal, cache: 'no-store', headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

async function loadSchumann(signal) {
  if (!DEFAULTS.schumannJson.trim()) return initialState.schumann;
  const data = await getJson(DEFAULTS.schumannJson, signal);
  const root = Array.isArray(data) ? latest(data) : data;
  const rawModes = Array.isArray(root?.modes) ? root.modes : Array.isArray(root?.harmonics) ? root.harmonics : [];
  const modes = rawModes
    .map((row, index) => {
      const frequencyHz = readFirstNumber(row, ['frequencyHz', 'frequency', 'freq_hz', 'hz']);
      if (frequencyHz === null) return null;
      return {
        mode: String(row.mode || row.name || `SR${index + 1}`),
        frequencyHz,
        amplitude: readFirstNumber(row, ['amplitude', 'amp', 'power', 'amplitude_pT']),
        qualityFactor: readFirstNumber(row, ['qualityFactor', 'qFactor', 'quality_factor', 'q']),
        source: 'measured'
      };
    })
    .filter(Boolean);

  return {
    measured: modes.length > 0,
    station: root?.station || root?.site || 'Custom Schumann JSON provider',
    updatedAt: readTime(root),
    signalQuality: readFirstNumber(root, ['signalQuality', 'quality', 'signal_quality']),
    amplitudeIndex: readFirstNumber(root, ['amplitudeIndex', 'activity', 'amplitude_index']),
    modes: modes.length ? modes : initialState.schumann.modes
  };
}

async function loadKp(signal) {
  const rows = await getJson(DEFAULTS.kp, signal);
  const points = rows
    .map((row) => ({ time: readTime(row), value: readFirstNumber(row, ['kp_index', 'kp', 'estimated_kp', 'Kp']) }))
    .filter((point) => point.time && point.value !== null);
  const values = points.map((point) => point.value);
  return { current: latest(values), max24h: values.length ? Math.max(...values) : null, avg24h: avg(values), points };
}

async function loadXray(signal) {
  const rows = await getJson(DEFAULTS.xray, signal);
  const preferred = rows.filter((row) => String(row.energy || row.channel || '').includes('0.1-0.8'));
  const usable = preferred.length ? preferred : rows;
  const points = usable
    .map((row) => ({ time: readTime(row), value: readFirstNumber(row, ['flux', 'observed_flux', 'value']) }))
    .filter((point) => point.time && point.value !== null);
  const current = latest(points)?.value ?? null;
  return { flux: current, classLabel: xrayClass(current), points };
}

async function loadWind(signal) {
  const rows = await getJson(DEFAULTS.wind, signal);
  const latestRow = latest(rows);
  const points = rows
    .map((row) => ({ time: readTime(row), value: readFirstNumber(row, ['speed', 'speed_kms', 'proton_speed', 'bulk_speed']) }))
    .filter((point) => point.time && point.value !== null);
  return {
    speed: latest(points)?.value ?? null,
    density: readFirstNumber(latestRow, ['density', 'proton_density', 'density_pcc']),
    temperature: readFirstNumber(latestRow, ['temperature', 'temperature_k']),
    points
  };
}

function MiniLine({ points }) {
  const path = useMemo(() => {
    const values = points.slice(-80).map((point) => point.value).filter((value) => Number.isFinite(value));
    if (values.length < 2) return '';
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    return values
      .map((value, index) => {
        const x = (index / (values.length - 1)) * 100;
        const y = 34 - ((value - min) / span) * 28;
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ');
  }, [points]);

  return path ? (
    <svg className="spark" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
      <path d={path} />
    </svg>
  ) : (
    <div className="spark empty">waiting for feed</div>
  );
}

function Stat({ label, value, detail }) {
  return (
    <article className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

export default function App() {
  const [state, setState] = useState(initialState);
  const [refreshKey, setRefreshKey] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const controller = new AbortController();
    setBusy(true);
    setRefreshKey(Date.now());

    const settled = await Promise.allSettled([
      loadSchumann(controller.signal),
      loadKp(controller.signal),
      loadXray(controller.signal),
      loadWind(controller.signal)
    ]);

    const failures = settled.filter((result) => result.status === 'rejected').length;
    setState({
      status: failures === 0 ? 'live' : failures < settled.length ? 'partial' : 'offline',
      message:
        failures === 0
          ? 'Public feeds connected.'
          : failures < settled.length
            ? `${failures} feed${failures === 1 ? '' : 's'} unavailable; showing remaining data.`
            : 'Feeds unavailable; showing reference values only.',
      updatedAt: new Date().toISOString(),
      schumann: settled[0].status === 'fulfilled' ? settled[0].value : initialState.schumann,
      space: {
        kp: settled[1].status === 'fulfilled' ? settled[1].value : initialState.space.kp,
        xray: settled[2].status === 'fulfilled' ? settled[2].value : initialState.space.xray,
        wind: settled[3].status === 'fulfilled' ? settled[3].value : initialState.space.wind
      }
    });
    setBusy(false);
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const spectrogramUrl = `${DEFAULTS.spectrogram}${DEFAULTS.spectrogram.includes('?') ? '&' : '?'}t=${refreshKey}`;
  const sr1 = state.schumann.modes[0];

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Schumann Live React · MIT public dashboard</p>
        <h1>Earth-ionosphere resonance monitor</h1>
        <p>
          A claim-safe live viewer for Schumann spectrograms, reference harmonics, optional measured-mode JSON, and NOAA
          space-weather context.
        </p>
        <div className="actions">
          <span className={`pill ${state.status}`}>{busy ? 'refreshing' : state.status}</span>
          <button onClick={refresh} disabled={busy}>{busy ? 'Refreshing…' : 'Refresh feeds'}</button>
        </div>
      </section>

      <section className="stats">
        <Stat label="SR1" value={fmt(sr1?.frequencyHz, 2, ' Hz')} detail={state.schumann.measured ? 'measured JSON provider' : 'reference harmonic'} />
        <Stat label="Kp index" value={fmt(state.space.kp.current, 1)} detail={`24h max ${fmt(state.space.kp.max24h, 1)}`} />
        <Stat label="GOES X-ray" value={state.space.xray.classLabel} detail={fmt(state.space.xray.flux, 8, ' W/m²')} />
        <Stat label="Solar wind" value={fmt(state.space.wind.speed, 0, ' km/s')} detail={`${fmt(state.space.wind.density, 1, ' p/cc')} density`} />
      </section>

      <section className="grid two">
        <article className="panel spectrogram">
          <div className="panel-head">
            <div>
              <p className="eyebrow">visual receipt</p>
              <h2>Schumann spectrogram</h2>
            </div>
            <a href={DEFAULTS.spectrogram} target="_blank" rel="noreferrer">open source</a>
          </div>
          <img src={spectrogramUrl} alt="Live or near-live Schumann resonance spectrogram" />
          <p className="note">
            The image source is treated as near-live unless the provider documents exact cadence. Numeric mode values remain
            reference-only unless `VITE_SR_JSON_URL` is configured.
          </p>
        </article>

        <article className="panel">
          <p className="eyebrow">harmonics</p>
          <h2>Reference modes</h2>
          <div className="harmonics">
            {state.schumann.modes.map((mode, index) => (
              <div className="harmonic" key={`${mode.mode}-${index}`}>
                <span>{mode.mode}</span>
                <strong>{fmt(mode.frequencyHz, 2, ' Hz')}</strong>
                <small>{mode.source || HARMONICS[index]?.note || 'mode'}</small>
              </div>
            ))}
          </div>
          <div className="mini-ledger">
            <strong>{state.schumann.station}</strong>
            <small>Signal quality: {fmt(state.schumann.signalQuality, 0)} · amplitude index: {fmt(state.schumann.amplitudeIndex, 0)}</small>
          </div>
        </article>
      </section>

      <section className="panel">
        <p className="eyebrow">NOAA context</p>
        <h2>Space-weather stats</h2>
        <div className="grid three">
          <div className="chart"><h3>Planetary Kp</h3><MiniLine points={state.space.kp.points} /></div>
          <div className="chart"><h3>GOES X-ray flux</h3><MiniLine points={state.space.xray.points} /></div>
          <div className="chart"><h3>Solar wind speed</h3><MiniLine points={state.space.wind.points} /></div>
        </div>
      </section>

      <section className="panel ledger">
        <p className="eyebrow">source ledger</p>
        <h2>Claim boundary</h2>
        <p>{state.message}</p>
        <ul>
          <li>Schumann spectrogram: visual monitoring source, configurable by environment variable.</li>
          <li>Schumann frequencies: reference harmonics unless a permitted JSON provider is connected.</li>
          <li>NOAA feeds: used only as contextual space-weather data.</li>
          <li>No health, consciousness, earthquake, or personal-event causation claims are made.</li>
        </ul>
        <small>Last refresh: {state.updatedAt ? new Date(state.updatedAt).toLocaleString() : 'not yet'}</small>
      </section>
    </main>
  );
}

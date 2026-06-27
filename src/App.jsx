import { useCallback, useEffect, useMemo, useState } from 'react';
import ObservationAnalytics from './ObservationAnalytics.jsx';

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

const STORAGE_KEYS = {
  stationId: 'eirm.stationId',
  customSpectrogramUrl: 'eirm.customSpectrogramUrl',
  observations: 'eirm.observations'
};

const STATION_PRESETS = [
  {
    id: 'env',
    name: 'Configured source',
    location: 'Environment default',
    url: DEFAULTS.spectrogram,
    confidence: 'visual'
  },
  {
    id: 'tomsk',
    name: 'Tomsk visual feed',
    location: 'Public visual spectrogram',
    url: 'https://schumannresonance.today/live/tomsk1.jpg',
    confidence: 'visual'
  },
  {
    id: 'custom',
    name: 'Custom image URL',
    location: 'Paste a permitted spectrogram image URL',
    url: '',
    confidence: 'visual'
  }
];

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

function formatClock(value, mode = 'local') {
  if (!value) return 'not yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'not yet';
  return mode === 'utc'
    ? date.toLocaleString(undefined, { timeZone: 'UTC', hour12: false }) + ' UTC'
    : date.toLocaleString();
}

function minutesAgo(value) {
  if (!value) return 'waiting';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return 'waiting';
  const diff = Math.max(0, Date.now() - then);
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

function xrayClass(flux) {
  if (!Number.isFinite(flux) || flux <= 0) return '—';
  if (flux >= 1e-4) return `X${(flux / 1e-4).toFixed(1)}`;
  if (flux >= 1e-5) return `M${(flux / 1e-5).toFixed(1)}`;
  if (flux >= 1e-6) return `C${(flux / 1e-6).toFixed(1)}`;
  if (flux >= 1e-7) return `B${(flux / 1e-7).toFixed(1)}`;
  return `A${(flux / 1e-8).toFixed(1)}`;
}

function kpTone(value) {
  if (!Number.isFinite(value)) return 'waiting';
  if (value >= 7) return 'storm';
  if (value >= 5) return 'active';
  return 'quiet';
}

function safeGetLocal(key, fallback) {
  try {
    return window.localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function safeSetLocal(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be blocked in private or hardened browser modes.
  }
}

function safeGetJson(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    if (!value) return fallback;
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function isHttpUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function getInitialStationId() {
  const saved = safeGetLocal(STORAGE_KEYS.stationId, 'env');
  return STATION_PRESETS.some((station) => station.id === saved) ? saved : 'env';
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadText(filename, content, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
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

function LogoMark() {
  return (
    <svg className="logo-mark" viewBox="0 0 120 120" role="img" aria-label="EIRM logo mark">
      <defs>
        <linearGradient id="ringGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
      <circle className="logo-earth" cx="60" cy="60" r="18" />
      <ellipse className="logo-ring ring-a" cx="60" cy="60" rx="44" ry="18" />
      <ellipse className="logo-ring ring-b" cx="60" cy="60" rx="44" ry="18" transform="rotate(62 60 60)" />
      <ellipse className="logo-ring ring-c" cx="60" cy="60" rx="44" ry="18" transform="rotate(-62 60 60)" />
      <path className="logo-wave" d="M18 82 C30 68, 42 96, 54 82 S78 68, 90 82 S108 96, 116 82" />
    </svg>
  );
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

function Stat({ label, value, detail, tone, confidence }) {
  return (
    <article className={`stat ${tone || ''}`}>
      <div className="stat-top">
        <span>{label}</span>
        {confidence ? <ConfidenceBadge label={confidence} /> : null}
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function ConfidenceBadge({ label }) {
  return <em className={`confidence confidence-${String(label).toLowerCase()}`}>{label}</em>;
}

function SourceRow({ label, value }) {
  return (
    <div className="source-row">
      <span>{label}</span>
      <code>{value}</code>
    </div>
  );
}

function TimelineStrip({ entries }) {
  const display = entries.slice(-10);
  return (
    <div className="timeline-strip">
      <div className="timeline-head">
        <span>refresh timeline</span>
        <small>last {display.length || 0} feed checks</small>
      </div>
      <div className="timeline-track" aria-label="recent refresh history">
        {display.length ? (
          display.map((entry, index) => (
            <div className={`timeline-node ${entry.status}`} key={`${entry.time}-${index}`} title={`${entry.status} · ${formatClock(entry.time)}`}>
              <i />
              <small>{minutesAgo(entry.time)}</small>
            </div>
          ))
        ) : (
          <div className="timeline-empty">waiting for first refresh</div>
        )}
      </div>
    </div>
  );
}

function ObservationLog({ note, setNote, observations, onAdd, onExport, onExportJson, onImportJson, onClear }) {
  return (
    <article className="panel observation-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">observation log</p>
          <h2>Local research notes</h2>
        </div>
        <span className="receipt-tag">local only · {observations.length} marks</span>
      </div>
      <p className="note">
        Mark what you notice while EIRM stores the current dashboard snapshot. These are personal observations, not proof of causation.
      </p>
      <div className="observation-compose">
        <label>
          <span>note</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Example: bright band on spectrogram, app check, personal note…"
          />
        </label>
        <button onClick={onAdd}>Mark observation</button>
      </div>
      <div className="observation-actions">
        <button className="small-button" onClick={onExport} disabled={!observations.length}>Export CSV</button>
        <button className="small-button" onClick={onExportJson} disabled={!observations.length}>Export JSON</button>
        <label className="file-button small-button">
          Import JSON
          <input type="file" accept="application/json" onChange={onImportJson} />
        </label>
        <button className="small-button danger" onClick={onClear} disabled={!observations.length}>Clear log</button>
      </div>
      <div className="observation-list">
        {observations.length ? observations.slice(0, 6).map((entry) => (
          <div className="observation-item" key={entry.id}>
            <div>
              <strong>{formatClock(entry.time)}</strong>
              <small>{entry.note || 'No note'} · {entry.status} · {entry.schumannMode}</small>
            </div>
            <code>Kp {entry.kp ?? '—'} · X-ray {entry.xrayClass || '—'} · wind {entry.solarWindKmS ?? '—'} km/s</code>
          </div>
        )) : <div className="observation-empty">No observations yet. Mark one when something is worth saving.</div>}
      </div>
    </article>
  );
}

function OperatorPanel({ diagnostics, onCopy, copyState }) {
  return (
    <article className="panel operator-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">operator panel</p>
          <h2>Runtime diagnostics</h2>
        </div>
        <button className="small-button" onClick={onCopy}>{copyState || 'Copy diagnostics'}</button>
      </div>
      <div className="operator-grid">
        <div><span>Visual image</span><strong>{diagnostics.imageStatus}</strong></div>
        <div><span>Feed status</span><strong>{diagnostics.status}</strong></div>
        <div><span>SR mode source</span><strong>{diagnostics.schumannMode}</strong></div>
        <div><span>Visual failures</span><strong>{diagnostics.imageErrors}</strong></div>
      </div>
      <pre>{JSON.stringify(diagnostics, null, 2)}</pre>
    </article>
  );
}

export default function App() {
  const [state, setState] = useState(initialState);
  const [refreshKey, setRefreshKey] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [stationId, setStationId] = useState(getInitialStationId);
  const [customSpectrogramUrl, setCustomSpectrogramUrl] = useState(() => safeGetLocal(STORAGE_KEYS.customSpectrogramUrl, ''));
  const [refreshHistory, setRefreshHistory] = useState([]);
  const [imageStatus, setImageStatus] = useState('loading');
  const [imageErrors, setImageErrors] = useState(0);
  const [copyState, setCopyState] = useState('');
  const [observationNote, setObservationNote] = useState('');
  const [observations, setObservations] = useState(() => safeGetJson(STORAGE_KEYS.observations, []));

  const selectedStation = STATION_PRESETS.find((station) => station.id === stationId) || STATION_PRESETS[0];
  const trimmedCustomUrl = customSpectrogramUrl.trim();
  const customUrlValid = stationId !== 'custom' || trimmedCustomUrl === '' || isHttpUrl(trimmedCustomUrl);
  const activeSpectrogramUrl = stationId === 'custom' && isHttpUrl(trimmedCustomUrl) ? trimmedCustomUrl : selectedStation.url || DEFAULTS.spectrogram;

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
    const nextStatus = failures === 0 ? 'live' : failures < settled.length ? 'partial' : 'offline';
    const now = new Date().toISOString();

    setState({
      status: nextStatus,
      message:
        failures === 0
          ? 'Public feeds connected.'
          : failures < settled.length
            ? `${failures} feed${failures === 1 ? '' : 's'} unavailable; showing remaining data.`
            : 'Feeds unavailable; showing reference values only.',
      updatedAt: now,
      schumann: settled[0].status === 'fulfilled' ? settled[0].value : initialState.schumann,
      space: {
        kp: settled[1].status === 'fulfilled' ? settled[1].value : initialState.space.kp,
        xray: settled[2].status === 'fulfilled' ? settled[2].value : initialState.space.xray,
        wind: settled[3].status === 'fulfilled' ? settled[3].value : initialState.space.wind
      }
    });

    setRefreshHistory((history) => [...history.slice(-9), { time: now, status: nextStatus }]);
    setBusy(false);
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    safeSetLocal(STORAGE_KEYS.stationId, stationId);
    setRefreshKey(Date.now());
  }, [stationId]);

  useEffect(() => {
    safeSetLocal(STORAGE_KEYS.customSpectrogramUrl, customSpectrogramUrl);
    setRefreshKey(Date.now());
  }, [customSpectrogramUrl]);

  useEffect(() => {
    safeSetLocal(STORAGE_KEYS.observations, JSON.stringify(observations));
  }, [observations]);

  useEffect(() => {
    setImageStatus('loading');
  }, [activeSpectrogramUrl, refreshKey]);

  const spectrogramUrl = `${activeSpectrogramUrl}${activeSpectrogramUrl.includes('?') ? '&' : '?'}t=${refreshKey}`;
  const sr1 = state.schumann.modes[0];
  const kpStatus = kpTone(state.space.kp.current);
  const refreshAge = minutesAgo(state.updatedAt);

  const diagnostics = useMemo(() => ({
    app: 'EIRM',
    status: state.status,
    lastRefreshLocal: formatClock(state.updatedAt),
    lastRefreshUtc: formatClock(state.updatedAt, 'utc'),
    stationId,
    stationName: selectedStation.name,
    activeSpectrogramUrl,
    imageStatus,
    imageErrors,
    schumannMode: state.schumann.measured ? 'measured JSON' : 'reference harmonics',
    schumannStation: state.schumann.station,
    kp: state.space.kp.current,
    xrayClass: state.space.xray.classLabel,
    solarWindKmS: state.space.wind.speed
  }), [activeSpectrogramUrl, imageErrors, imageStatus, selectedStation.name, state, stationId]);

  async function copyDiagnostics() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
      setCopyState('Copied');
    } catch {
      setCopyState('Copy failed');
    }
    window.setTimeout(() => setCopyState(''), 1600);
  }

  function addObservation() {
    const entry = {
      id: crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      time: new Date().toISOString(),
      note: observationNote.trim(),
      status: state.status,
      stationName: selectedStation.name,
      activeSpectrogramUrl,
      imageStatus,
      schumannMode: state.schumann.measured ? 'measured JSON' : 'reference harmonics',
      schumannStation: state.schumann.station,
      sr1Hz: sr1?.frequencyHz ?? null,
      kp: state.space.kp.current,
      xrayClass: state.space.xray.classLabel,
      xrayFlux: state.space.xray.flux,
      solarWindKmS: state.space.wind.speed,
      densityPcc: state.space.wind.density
    };
    setObservations((items) => [entry, ...items].slice(0, 100));
    setObservationNote('');
  }

  function exportObservationsCsv() {
    const headers = [
      'time_utc', 'note', 'feed_status', 'station', 'visual_url', 'image_status', 'sr_mode_source',
      'schumann_station', 'sr1_hz', 'kp', 'xray_class', 'xray_flux', 'solar_wind_km_s', 'density_pcc'
    ];
    const rows = observations.map((entry) => [
      entry.time, entry.note, entry.status, entry.stationName, entry.activeSpectrogramUrl, entry.imageStatus,
      entry.schumannMode, entry.schumannStation, entry.sr1Hz, entry.kp, entry.xrayClass, entry.xrayFlux,
      entry.solarWindKmS, entry.densityPcc
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
    downloadText(`eirm-observations-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv');
  }

  function exportObservationsJson() {
    const payload = {
      app: 'EIRM',
      version: 1,
      exportedAt: new Date().toISOString(),
      claimBoundary: 'Observation entries are local notes and are not proof of causation.',
      observations
    };
    downloadText(`eirm-observations-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), 'application/json');
  }

  function importObservationsJson(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ''));
        const incoming = Array.isArray(parsed) ? parsed : Array.isArray(parsed.observations) ? parsed.observations : [];
        const normalized = incoming
          .filter((entry) => entry && typeof entry === 'object' && entry.time)
          .map((entry) => ({ ...entry, id: entry.id || `${entry.time}-${Math.random()}` }));

        setObservations((items) => {
          const byId = new Map();
          [...normalized, ...items].forEach((entry) => byId.set(entry.id, entry));
          return [...byId.values()]
            .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
            .slice(0, 100);
        });
      } catch {
        window.alert('Could not import that EIRM observation JSON file.');
      } finally {
        input.value = '';
      }
    };
    reader.readAsText(file);
  }

  function clearObservations() {
    if (window.confirm('Clear local EIRM observations from this browser?')) {
      setObservations([]);
    }
  }

  return (
    <main className="shell">
      <section className="hero compact-hero">
        <div className="hero-copy">
          <div className="brand-row">
            <LogoMark />
            <p className="eyebrow">Schumann Live React · MIT public dashboard</p>
          </div>
          <h1>EIRM</h1>
          <p className="subtitle">Earth-Ionosphere Resonance Monitor</p>
          <p>
            A claim-safe live viewer for Schumann spectrograms, reference harmonics, optional measured-mode JSON, and NOAA
            space-weather context.
          </p>
          <div className="actions">
            <span className={`pill ${state.status}`}>{busy ? 'refreshing' : state.status}</span>
            <button onClick={refresh} disabled={busy}>{busy ? 'Refreshing…' : 'Refresh feeds'}</button>
          </div>
          <div className="confidence-row" aria-label="data confidence badges">
            <ConfidenceBadge label="visual" />
            <ConfidenceBadge label={state.schumann.measured ? 'measured' : 'reference'} />
            <ConfidenceBadge label="NOAA" />
            <ConfidenceBadge label="ledger" />
          </div>
        </div>
        <aside className="hero-console" aria-label="feed status console">
          <div>
            <span>last refresh</span>
            <strong>{refreshAge}</strong>
          </div>
          <div>
            <span>local time</span>
            <strong>{formatClock(state.updatedAt)}</strong>
          </div>
          <div>
            <span>utc receipt</span>
            <strong>{formatClock(state.updatedAt, 'utc')}</strong>
          </div>
        </aside>
      </section>

      <section className="stats">
        <Stat label="SR1" value={fmt(sr1?.frequencyHz, 2, ' Hz')} detail={state.schumann.measured ? 'measured JSON provider' : 'reference harmonic'} confidence={state.schumann.measured ? 'measured' : 'reference'} />
        <Stat label="Kp index" value={fmt(state.space.kp.current, 1)} detail={`24h max ${fmt(state.space.kp.max24h, 1)} · ${kpStatus}`} tone={kpStatus} confidence="NOAA" />
        <Stat label="GOES X-ray" value={state.space.xray.classLabel} detail={fmt(state.space.xray.flux, 8, ' W/m²')} confidence="NOAA" />
        <Stat label="Solar wind" value={fmt(state.space.wind.speed, 0, ' km/s')} detail={`${fmt(state.space.wind.density, 1, ' p/cc')} density`} confidence="NOAA" />
      </section>

      <section className="grid two">
        <article className="panel spectrogram">
          <div className="panel-head">
            <div>
              <p className="eyebrow">visual receipt</p>
              <h2>Schumann spectrogram</h2>
            </div>
            <a href={activeSpectrogramUrl} target="_blank" rel="noreferrer">open source</a>
          </div>

          <div className="station-control">
            <label>
              <span>station / source</span>
              <select value={stationId} onChange={(event) => setStationId(event.target.value)}>
                {STATION_PRESETS.map((station) => (
                  <option value={station.id} key={station.id}>{station.name}</option>
                ))}
              </select>
            </label>
            <div className="station-meta">
              <ConfidenceBadge label={selectedStation.confidence} />
              <small>{selectedStation.location}</small>
            </div>
            {stationId === 'custom' ? (
              <label className="custom-source">
                <span>custom image URL</span>
                <input
                  value={customSpectrogramUrl}
                  onChange={(event) => setCustomSpectrogramUrl(event.target.value)}
                  placeholder="https://example.org/schumann-image.jpg"
                  inputMode="url"
                />
                {!customUrlValid ? <small className="input-warning">Enter a valid http or https image URL. Using the fallback visual feed until then.</small> : null}
              </label>
            ) : null}
          </div>

          <div className={`image-shell ${imageStatus}`}>
            <span className={`image-status ${imageStatus}`}>{imageStatus}</span>
            <img
              src={spectrogramUrl}
              alt="Live or near-live Schumann resonance spectrogram"
              onLoad={() => setImageStatus('ready')}
              onError={() => {
                setImageStatus('error');
                setImageErrors((count) => count + 1);
              }}
            />
          </div>
          <TimelineStrip entries={refreshHistory} />
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

      <ObservationLog
        note={observationNote}
        setNote={setObservationNote}
        observations={observations}
        onAdd={addObservation}
        onExport={exportObservationsCsv}
        onExportJson={exportObservationsJson}
        onImportJson={importObservationsJson}
        onClear={clearObservations}
      />

      <ObservationAnalytics observations={observations} />

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">NOAA context</p>
            <h2>Space-weather stats</h2>
          </div>
          <span className="receipt-tag">auto-refresh · 5 min</span>
        </div>
        <div className="grid three">
          <div className="chart"><h3>Planetary Kp</h3><MiniLine points={state.space.kp.points} /></div>
          <div className="chart"><h3>GOES X-ray flux</h3><MiniLine points={state.space.xray.points} /></div>
          <div className="chart"><h3>Solar wind speed</h3><MiniLine points={state.space.wind.points} /></div>
        </div>
      </section>

      <section className="grid two bottom-grid">
        <article className="panel ledger">
          <p className="eyebrow">source ledger</p>
          <h2>Claim boundary</h2>
          <p>{state.message}</p>
          <ul>
            <li>Schumann spectrogram: visual monitoring source, configurable by environment variable or station selector.</li>
            <li>Schumann frequencies: reference harmonics unless a permitted JSON provider is connected.</li>
            <li>NOAA feeds: used only as contextual space-weather data.</li>
            <li>Observation Log entries are local notes and are not proof of causation.</li>
            <li>Observation Analytics summarize saved local marks only and are not causal analysis.</li>
            <li>No health, consciousness, earthquake, or personal-event causation claims are made.</li>
          </ul>
          <small>Last refresh: {formatClock(state.updatedAt)} · {formatClock(state.updatedAt, 'utc')}</small>
        </article>

        <article className="panel sources">
          <p className="eyebrow">configured feeds</p>
          <h2>Source map</h2>
          <SourceRow label="Active visual" value={activeSpectrogramUrl} />
          <SourceRow label="Schumann JSON" value={DEFAULTS.schumannJson || 'not configured'} />
          <SourceRow label="Kp" value={DEFAULTS.kp} />
          <SourceRow label="X-ray" value={DEFAULTS.xray} />
          <SourceRow label="Solar wind" value={DEFAULTS.wind} />
        </article>
      </section>

      <OperatorPanel diagnostics={diagnostics} onCopy={copyDiagnostics} copyState={copyState} />
    </main>
  );
}

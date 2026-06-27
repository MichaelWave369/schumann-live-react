import { useMemo } from 'react';
import LocalWatchtower from './LocalWatchtower.jsx';

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function avg(values) {
  const usable = values.map(numberOrNull).filter((value) => value !== null);
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null;
}

function maxEntry(entries, key) {
  return entries.reduce((best, entry) => {
    const value = numberOrNull(entry[key]);
    if (value === null) return best;
    if (!best || value > best.value) return { entry, value };
    return best;
  }, null);
}

function formatNumber(value, digits = 1, suffix = '') {
  const number = numberOrNull(value);
  return number === null ? '—' : `${number.toFixed(digits)}${suffix}`;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function mostCommon(values) {
  const counts = new Map();
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
}

function MiniObservationTrend({ entries, field, label, suffix = '' }) {
  const points = entries
    .slice()
    .reverse()
    .map((entry) => numberOrNull(entry[field]))
    .filter((value) => value !== null)
    .slice(-16);

  if (points.length < 2) {
    return (
      <div className="observation-trend empty">
        <strong>{label}</strong>
        <span>needs 2+ marks</span>
      </div>
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const path = points.map((value, index) => {
    const x = (index / (points.length - 1)) * 100;
    const y = 36 - ((value - min) / span) * 30;
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');

  return (
    <div className="observation-trend">
      <div>
        <strong>{label}</strong>
        <span>{formatNumber(points.at(-1), field === 'xrayFlux' ? 8 : 1, suffix)}</span>
      </div>
      <svg viewBox="0 0 100 42" preserveAspectRatio="none" aria-hidden="true">
        <path d={path} />
      </svg>
    </div>
  );
}

export default function ObservationAnalytics({ observations }) {
  const analytics = useMemo(() => {
    const newest = observations[0] || null;
    const oldest = observations.at(-1) || null;
    const highestKp = maxEntry(observations, 'kp');
    const fastestWind = maxEntry(observations, 'solarWindKmS');
    const stationCount = new Set(observations.map((entry) => entry.stationName).filter(Boolean)).size;

    return {
      total: observations.length,
      newest,
      oldest,
      stationCount,
      averageKp: avg(observations.map((entry) => entry.kp)),
      averageWind: avg(observations.map((entry) => entry.solarWindKmS)),
      commonXrayClass: mostCommon(observations.map((entry) => entry.xrayClass)),
      highestKp,
      fastestWind
    };
  }, [observations]);

  const latestSnapshot = analytics.newest || {};

  return (
    <>
      <article className="panel observation-analytics">
        <div className="panel-head">
          <div>
            <p className="eyebrow">observation analytics</p>
            <h2>Local review summary</h2>
          </div>
          <span className="receipt-tag">claim-safe · browser only</span>
        </div>

        <div className="analytics-grid">
          <div><span>Total marks</span><strong>{analytics.total}</strong><small>stored locally</small></div>
          <div><span>Avg Kp</span><strong>{formatNumber(analytics.averageKp, 1)}</strong><small>logged marks only</small></div>
          <div><span>Avg wind</span><strong>{formatNumber(analytics.averageWind, 0, ' km/s')}</strong><small>logged marks only</small></div>
          <div><span>Common X-ray</span><strong>{analytics.commonXrayClass}</strong><small>logged marks only</small></div>
        </div>

        <div className="analytics-grid secondary">
          <div><span>First mark</span><strong>{formatDate(analytics.oldest?.time)}</strong></div>
          <div><span>Latest mark</span><strong>{formatDate(analytics.newest?.time)}</strong></div>
          <div><span>Stations used</span><strong>{analytics.stationCount || '—'}</strong></div>
          <div><span>Highest Kp</span><strong>{analytics.highestKp ? formatNumber(analytics.highestKp.value, 1) : '—'}</strong></div>
        </div>

        <div className="trend-grid">
          <MiniObservationTrend entries={observations} field="kp" label="Kp trend" />
          <MiniObservationTrend entries={observations} field="solarWindKmS" label="Wind trend" suffix=" km/s" />
          <MiniObservationTrend entries={observations} field="xrayFlux" label="X-ray flux trend" suffix=" W/m²" />
        </div>

        <p className="note">
          These summaries describe only the observations saved in this browser. They are review aids, not evidence that one signal caused another event.
        </p>
      </article>

      <LocalWatchtower
        data={{
          kp: latestSnapshot.kp,
          solarWindKmS: latestSnapshot.solarWindKmS,
          xrayClass: latestSnapshot.xrayClass,
          imageStatus: latestSnapshot.imageStatus || 'waiting',
          feedStatus: latestSnapshot.status || 'waiting'
        }}
      />
    </>
  );
}

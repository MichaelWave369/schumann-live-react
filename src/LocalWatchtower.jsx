import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'eirm.watchtower.rules';

const DEFAULT_RULES = {
  kpWatch: 4,
  kpAlert: 5,
  windWatch: 500,
  windAlert: 650,
  xrayWatch: 'C',
  xrayAlert: 'M',
  imageErrorAlert: true,
  feedPartialWatch: true
};

const XRAY_ORDER = { '—': 0, A: 1, B: 2, C: 3, M: 4, X: 5 };

function safeGetRules() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_RULES, ...JSON.parse(raw) } : DEFAULT_RULES;
  } catch {
    return DEFAULT_RULES;
  }
}

function safeSaveRules(rules) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  } catch {
    // Local storage may be blocked in hardened browser modes.
  }
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function xrayRank(classLabel) {
  const letter = String(classLabel || '—').trim().charAt(0).toUpperCase();
  return XRAY_ORDER[letter] ?? 0;
}

function thresholdState(value, watch, alert) {
  const current = numberOrNull(value);
  const watchValue = numberOrNull(watch);
  const alertValue = numberOrNull(alert);
  if (current === null) return 'waiting';
  if (alertValue !== null && current >= alertValue) return 'alert';
  if (watchValue !== null && current >= watchValue) return 'watch';
  return 'clear';
}

function strongest(states) {
  if (states.includes('alert')) return 'alert';
  if (states.includes('watch')) return 'watch';
  if (states.includes('waiting')) return 'waiting';
  return 'clear';
}

function formatValue(value, suffix = '') {
  const number = numberOrNull(value);
  return number === null ? '—' : `${number.toFixed(0)}${suffix}`;
}

function RuleInput({ label, value, onChange, suffix }) {
  return (
    <label className="watch-rule">
      <span>{label}</span>
      <div>
        <input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
        {suffix ? <small>{suffix}</small> : null}
      </div>
    </label>
  );
}

function WatchItem({ label, state, value, detail }) {
  return (
    <div className={`watch-item ${state}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

export default function LocalWatchtower({ data }) {
  const [rules, setRules] = useState(safeGetRules);

  useEffect(() => {
    safeSaveRules(rules);
  }, [rules]);

  const states = useMemo(() => {
    const kp = thresholdState(data.kp, rules.kpWatch, rules.kpAlert);
    const wind = thresholdState(data.solarWindKmS, rules.windWatch, rules.windAlert);
    const xray = xrayRank(data.xrayClass) >= xrayRank(rules.xrayAlert)
      ? 'alert'
      : xrayRank(data.xrayClass) >= xrayRank(rules.xrayWatch)
        ? 'watch'
        : xrayRank(data.xrayClass) === 0
          ? 'waiting'
          : 'clear';
    const visual = rules.imageErrorAlert && data.imageStatus === 'error' ? 'alert' : data.imageStatus === 'loading' ? 'waiting' : 'clear';
    const feed = data.feedStatus === 'offline' ? 'alert' : rules.feedPartialWatch && data.feedStatus === 'partial' ? 'watch' : data.feedStatus === 'loading' ? 'waiting' : 'clear';

    return { kp, wind, xray, visual, feed, overall: strongest([kp, wind, xray, visual, feed]) };
  }, [data, rules]);

  function update(key, value) {
    setRules((current) => ({ ...current, [key]: value }));
  }

  function resetRules() {
    setRules(DEFAULT_RULES);
  }

  return (
    <article className={`panel watchtower ${states.overall}`}>
      <div className="panel-head">
        <div>
          <p className="eyebrow">local watchtower</p>
          <h2>Threshold watcher</h2>
        </div>
        <span className={`watch-status ${states.overall}`}>{states.overall}</span>
      </div>

      <p className="note">
        Local threshold checks for dashboard awareness only. These alerts do not imply health, mood, earthquake, or personal-event causation.
      </p>

      <div className="watch-grid">
        <WatchItem label="Kp" state={states.kp} value={data.kp ?? '—'} detail={`watch ≥ ${rules.kpWatch} · alert ≥ ${rules.kpAlert}`} />
        <WatchItem label="Solar wind" state={states.wind} value={formatValue(data.solarWindKmS, ' km/s')} detail={`watch ≥ ${rules.windWatch} · alert ≥ ${rules.windAlert}`} />
        <WatchItem label="X-ray class" state={states.xray} value={data.xrayClass || '—'} detail={`watch ≥ ${rules.xrayWatch} · alert ≥ ${rules.xrayAlert}`} />
        <WatchItem label="Visual image" state={states.visual} value={data.imageStatus || '—'} detail="image load health" />
        <WatchItem label="Feeds" state={states.feed} value={data.feedStatus || '—'} detail="live / partial / offline" />
      </div>

      <details className="watch-settings">
        <summary>Adjust local rules</summary>
        <div className="watch-settings-grid">
          <RuleInput label="Kp watch" value={rules.kpWatch} onChange={(value) => update('kpWatch', value)} />
          <RuleInput label="Kp alert" value={rules.kpAlert} onChange={(value) => update('kpAlert', value)} />
          <RuleInput label="Wind watch" value={rules.windWatch} onChange={(value) => update('windWatch', value)} suffix="km/s" />
          <RuleInput label="Wind alert" value={rules.windAlert} onChange={(value) => update('windAlert', value)} suffix="km/s" />
          <label className="watch-rule">
            <span>X-ray watch</span>
            <select value={rules.xrayWatch} onChange={(event) => update('xrayWatch', event.target.value)}>
              {['A', 'B', 'C', 'M', 'X'].map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="watch-rule">
            <span>X-ray alert</span>
            <select value={rules.xrayAlert} onChange={(event) => update('xrayAlert', event.target.value)}>
              {['A', 'B', 'C', 'M', 'X'].map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
        <label className="check-rule">
          <input type="checkbox" checked={rules.imageErrorAlert} onChange={(event) => update('imageErrorAlert', event.target.checked)} />
          Alert when spectrogram image fails to load.
        </label>
        <label className="check-rule">
          <input type="checkbox" checked={rules.feedPartialWatch} onChange={(event) => update('feedPartialWatch', event.target.checked)} />
          Watch when public feeds are partially available.
        </label>
        <button className="small-button" onClick={resetRules}>Reset defaults</button>
      </details>
    </article>
  );
}

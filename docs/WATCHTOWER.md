# EIRM Local Watchtower

The Local Watchtower reviews the current dashboard snapshot against browser-local thresholds.

It checks:

- Kp watch and alert values.
- Solar-wind watch and alert values.
- GOES X-ray watch and alert class.
- Spectrogram image load state.
- Feed availability state.

The Watchtower runs in the browser only. It is not a server alert system, not a prediction engine, and not a causal proof layer.

## Current architecture

The Watchtower now receives live dashboard state from `App.jsx`:

- current Kp value
- current solar-wind speed
- current GOES X-ray class
- current spectrogram image status
- current feed status

Observation Analytics remains focused on saved local observation marks.

## Local rules

Rules are stored in local browser storage under:

```text
eirm.watchtower.rules
```

Users can adjust thresholds from the Watchtower panel and reset them to defaults.

## Claim boundary

Watchtower states mean only:

- `clear`: below local watch threshold
- `watch`: above local watch threshold
- `alert`: above local alert threshold or a configured load/feed failure condition
- `waiting`: not enough current data yet

These states are dashboard-awareness markers only.

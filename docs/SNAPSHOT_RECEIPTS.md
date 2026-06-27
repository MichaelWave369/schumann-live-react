# EIRM Snapshot Receipt IDs

Current Snapshot Reports include a browser-generated receipt ID.

The receipt ID is a SHA-256 hash of the current snapshot payload when browser crypto support is available. In hardened or limited browser environments, EIRM falls back to a simple local fingerprint marked with a `fallback-` prefix.

## What the receipt ID helps with

A receipt ID can help a user compare whether two exported or copied snapshot reports came from the same snapshot payload.

It is included in:

- copied Markdown reports
- exported JSON snapshot files
- the visible Current Snapshot Report panel

## What the receipt ID does not do

The receipt ID is not:

- blockchain anchoring
- external notarization
- server verification
- proof that source feeds were accurate
- proof of causation

It is a local integrity fingerprint only.

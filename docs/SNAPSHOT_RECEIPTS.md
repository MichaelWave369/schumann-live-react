# EIRM Snapshot Receipt IDs

Current Snapshot Reports include a browser-generated receipt ID.

The receipt ID is a SHA-256 hash of the current snapshot payload when browser crypto support is available. In hardened or limited browser environments, EIRM falls back to a simple local fingerprint marked with a `fallback-` prefix.

## What the receipt ID helps with

A receipt ID can help a user compare whether two exported or copied snapshot reports came from the same snapshot payload.

It is included in:

- copied Markdown reports
- exported JSON snapshot files
- the visible Current Snapshot Report panel

## Verifier

The Watchtower panel can verify an exported snapshot JSON file.

The browser reads the JSON, removes the saved `receiptId`, recomputes the local fingerprint for the remaining snapshot payload, and compares the computed value against the saved receipt.

Verifier states mean only:

- `matched`: the exported JSON payload matches its saved receipt ID
- `mismatch`: the JSON changed, the receipt changed, or the file came from a different hashing mode
- `error`: the file was not a usable EIRM snapshot JSON file

## What the receipt ID does not do

The receipt ID is not:

- blockchain anchoring
- external notarization
- server verification
- proof that source feeds were accurate
- proof of causation

It is a local integrity fingerprint only.

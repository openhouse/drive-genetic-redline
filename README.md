# drive-genetic-redline

`drive-genetic-redline` is a local-first TypeScript CLI for archiving Google Drive / Google Docs provenance evidence and rendering Microsoft Word `.docx` genetic redlines with real WordprocessingML tracked changes.

The package is designed for legislative-style provenance work: it crawls a shared Google Drive folder or shared drive, harvests available Google Docs evidence, derives an event ledger, and renders DOCX editions where accepting tracked changes reconstructs the target text.

## Status

This repository contains the MVP scaffold and core local primitives:

- ESM TypeScript CLI using `commander`.
- Installed-app OAuth token flow using `google-auth-library`.
- Google Drive folder/shared drive inventory crawling.
- Google Docs harvesting hooks for current exports, Docs API views, comments, Drive Activity, and Drive revisions.
- Plain-text snapshot normalization and revision diff event generation.
- Minimal OpenXML `.docx` writer with real tracked insertions and deletions.
- Local accept-all verifier for generated tracked-change DOCX XML.
- Vitest coverage for parsing, diffing, DOCX generation, and accept-all verification.

## Installation

```bash
pnpm install
pnpm build
```

Node.js 20 or newer is required.

## CLI commands

```bash
drive-redline auth
drive-redline inventory --folder-url <Google Drive folder URL> --out ./archive
drive-redline inventory --drive-id <shared-drive-id> --out ./archive
drive-redline harvest --folder-url <Google Drive folder URL> --out ./archive --comments --suggestions --revisions --activity
drive-redline harvest --drive-id <shared-drive-id> --out ./archive --comments --suggestions --revisions --activity
drive-redline render --in ./archive --mode cumulative
drive-redline render --in ./archive --mode stepwise
drive-redline verify --in ./archive
```

## OAuth setup

Create an OAuth client for an installed/local app in Google Cloud, enable the Google Drive API, Google Docs API, and Google Drive Activity API, then save the downloaded client JSON as:

```text
.auth/credentials.json
```

Run:

```bash
drive-redline auth
```

The CLI requests these read-only scopes:

- `https://www.googleapis.com/auth/drive.readonly`
- `https://www.googleapis.com/auth/drive.metadata.readonly`
- `https://www.googleapis.com/auth/drive.activity.readonly`
- `https://www.googleapis.com/auth/documents.readonly`

Tokens are stored under `.auth/`. Credentials, tokens, downloaded archives, generated DOCX files, and private Drive data are intentionally gitignored.

## Output model

Harvests are written under an archive tree similar to:

```text
archive/
  inventory/
    folders.jsonl
    files.jsonl
    crawl-manifest.json
  documents/
    <file-slug>--<file-id>/
      source/
      exports/
      revisions/
      derived/
        normalized-snapshots.jsonl
        word-events.jsonl
        confidence-report.md
      editions/
        cumulative-genetic-redline.docx
        cumulative-genetic-redline.provenance.json
        stepwise/
```

## Genetic edition semantics

The tool distinguishes three outputs:

1. **Cumulative redline DOCX**: a net diff from the earliest available snapshot to the current/target snapshot. Accepting all tracked changes yields the target text.
2. **Stepwise DOCXs**: one tracked-change DOCX per adjacent revision pair. Accepting all tracked changes yields the next revision's text.
3. **Canonical event ledger**: `derived/word-events.jsonl`, preserving derived edit events including intermediate churn that may not be visible in the cumulative net redline.

A single cumulative DOCX cannot faithfully encode every intermediate insert-then-delete event when that text is absent from both the baseline and target. The event ledger plus stepwise DOCXs are the authoritative record for that churn.

## API limitations and confidence

Google does not necessarily expose the complete fine-grained Google Docs UI version history through public APIs. Drive revisions for Google Docs may be merged, sparse, or unavailable for export. This package therefore describes results as **derived from available Google API revision evidence**, not as perfect keystroke history.

Confidence levels are recorded on derived events:

- `exact`: native API evidence directly identifies the span/event.
- `high`: strong structured evidence, such as current unresolved suggestion metadata.
- `medium`: revision-diff evidence attributed from later revision metadata.
- `low`: missing author metadata, multiple possible actors, or weak anchoring.
- `unknown`: provenance could not be meaningfully scored.

Drive Activity is used as supporting context only; it is not treated as perfect span-level authorship ground truth.

## DOCX tracked changes

Generated DOCX files include minimal WordprocessingML parts and enable revision tracking in `word/settings.xml`. Insertions are emitted as `<w:ins>`, deletions as `<w:del>` with `<w:delText>`, and unchanged text as normal runs. The verifier locally simulates accept-all behavior by unwrapping insertions, removing deletions, and extracting text.

## Non-goals for MVP

- Browser scraping Google Docs version history UI.
- Perfect keystroke-level reconstruction.
- Full formatting fidelity.
- Editing Google Docs or accepting/rejecting suggestions in Google.
- Uploading generated files back to Drive.

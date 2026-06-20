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

Node.js 24 is required; the supported engine range is `>=24 <25`.

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

## Robust harvest examples

Use Node.js 24 with pnpm 9.15.0; the project intentionally targets the current local Node 24 runtime in `.nvmrc` and `package.json`.

When a script records a `latest-run.txt` pointer or updates a `current` symlink, make the harvest command fail the script before writing those pointers. For example:

```bash
set -euo pipefail

export MMH_FOLDER_URL='https://drive.google.com/drive/folders/0B7mhOi-bfjJnfi1pUjloZTNYU2NRTkV3MlJIam01aTc5RndsQ3diNlV1enBBZkh4ZjB1dVE'
export MMH_ARCHIVE_ROOT='/Volumes/16TB_SSD/Work/Marmor/sources/drive/monthly-music-hackathon'
export RUN_ID="$(date +%Y%m%d-%H%M%S)"
export RUN="$MMH_ARCHIVE_ROOT/runs/$RUN_ID-pilot"
mkdir -p "$RUN/_system"

node dist/cli.js harvest \
  --folder-url "$MMH_FOLDER_URL" \
  --out "$RUN" \
  --only-id 1s49szbYT7k_RzzbUgKB0SCtXQ6KuSxEiO-BW8ESFTnE 1j4TJ3gSyaHyJntgIjR_FexbuEUPQJ-T415CDYt8-Fxw \
  --comments \
  --suggestions \
  --revisions \
  --activity

printf '%s\n' "$RUN_ID-pilot" > "$MMH_ARCHIVE_ROOT/latest-run.txt"
ln -sfn "$RUN" "$MMH_ARCHIVE_ROOT/current"
```

For a full run that skips known sensitive documents:

```bash
set -euo pipefail

export RUN_ID="$(date +%Y%m%d-%H%M%S)"
export RUN="$MMH_ARCHIVE_ROOT/runs/$RUN_ID"
mkdir -p "$RUN/_system"

node dist/cli.js harvest \
  --folder-url "$MMH_FOLDER_URL" \
  --out "$RUN" \
  --skip-id 1VDIoeupCMXI2Zi7PtIcU0HR8tD27gLMx6mUGD3psxRo 1YP_2ou3bsxk6_T-ZhyyHre6JXumlHw77A2ljjZSTTuI \
  --comments \
  --suggestions \
  --revisions \
  --activity

printf '%s\n' "$RUN_ID" > "$MMH_ARCHIVE_ROOT/latest-run.txt"
ln -sfn "$RUN" "$MMH_ARCHIVE_ROOT/current"
```

By default, `harvest` logs per-document failures to `_system/harvest-errors.jsonl` and continues with later Google Docs. Add `--fail-fast` when a pilot run should abort on the first document failure.

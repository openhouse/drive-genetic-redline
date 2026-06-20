#!/usr/bin/env node
import { Command } from 'commander';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInstalledAppAuth, loadOAuthClient } from './auth/oauth.js';
import { clients } from './drive/client.js';
import { crawlFolder, listSharedDrive } from './drive/crawl.js';
import { parseFolderUrl } from './drive/ids.js';
import { appendJsonl, writeJson } from './fs.js';
import { harvestGoogleDoc, type HarvestGoogleDocOptions } from './harvest/harvest.js';
import { renderArchive } from './render/render.js';
import { verifyArchive } from './verify/archive.js';
import type { SourceFile } from './types.js';

const DOC = 'application/vnd.google-apps.document';
const FOLDER = 'application/vnd.google-apps.folder';

type Apis = Awaited<ReturnType<typeof clients>>;

interface HarvestCommandOptions extends HarvestGoogleDocOptions {
  folderUrl?: string;
  driveId?: string;
  out: string;
  onlyId?: string[];
  skipId?: string[];
  failFast?: boolean;
}

function collectIds(value: string, previous: string[] = []): string[] {
  return [...previous, ...value.split(',').map((id) => id.trim()).filter(Boolean)];
}

function folderIdFromOptions(o: { folderUrl?: string; driveId?: string }): string {
  if (!o.folderUrl) throw new Error('Either --folder-url or --drive-id is required.');
  return parseFolderUrl(o.folderUrl).folderId;
}

function serializeError(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) return { name: error.name, message: error.message, stack: error.stack };
  return { name: 'Error', message: String(error) };
}

async function inventoryFiles(out: string, files: SourceFile[]): Promise<void> {
  await mkdir(path.join(out, 'inventory'), { recursive: true });
  for (const f of files) await appendJsonl(path.join(out, 'inventory', f.mimeType === FOLDER ? 'folders.jsonl' : 'files.jsonl'), f);
}

export async function runHarvest(apis: Apis, files: SourceFile[], o: HarvestCommandOptions): Promise<void> {
  await inventoryFiles(o.out, files);
  await mkdir(path.join(o.out, '_system'), { recursive: true });

  const onlyIds = new Set(o.onlyId ?? []);
  const skipIds = new Set(o.skipId ?? []);
  const harvestOptions: HarvestGoogleDocOptions = { comments: Boolean(o.comments), suggestions: Boolean(o.suggestions), revisions: Boolean(o.revisions), activity: Boolean(o.activity) };
  let googleDocsSeen = 0;
  let googleDocsHarvested = 0;
  let googleDocsSkipped = 0;
  let googleDocsFailed = 0;

  for (const f of files) {
    if (f.mimeType !== DOC) continue;
    googleDocsSeen += 1;
    const reason = onlyIds.size > 0 && !onlyIds.has(f.id) ? 'not-in-only-id' : skipIds.has(f.id) ? 'skip-id' : undefined;
    if (reason) {
      googleDocsSkipped += 1;
      await appendJsonl(path.join(o.out, '_system/skipped-files.jsonl'), { id: f.id, name: f.name, mimeType: f.mimeType, reason });
      continue;
    }

    try {
      await harvestGoogleDoc(apis, f, o.out, harvestOptions);
      googleDocsHarvested += 1;
    } catch (error) {
      googleDocsFailed += 1;
      await appendJsonl(path.join(o.out, '_system/harvest-errors.jsonl'), { id: f.id, name: f.name, mimeType: f.mimeType, stage: 'harvestGoogleDoc', error: serializeError(error) });
      if (o.failFast) throw error;
    }
  }

  await writeJson(path.join(o.out, 'inventory/crawl-manifest.json'), { createdAt: new Date().toISOString(), fileCount: files.length, folderUrl: o.folderUrl, driveId: o.driveId });
  await writeJson(path.join(o.out, '_system/harvest-summary.json'), { createdAt: new Date().toISOString(), fileCount: files.length, googleDocsSeen, googleDocsHarvested, googleDocsSkipped, googleDocsFailed, options: harvestOptions });
}

const program = new Command().name('drive-redline').description('Archive Google Docs provenance and render DOCX tracked-change genetic redlines.').version('0.1.0');
program.command('auth').description('Run installed-app OAuth and save tokens under .auth/.').action(runInstalledAppAuth);
program.command('inventory').option('--folder-url <url>').option('--drive-id <id>').requiredOption('--out <dir>').action(async (o) => { const apis = clients(await loadOAuthClient()); const files = o.driveId ? await listSharedDrive(apis.drive, o.driveId) : await crawlFolder(apis.drive, folderIdFromOptions(o)); await inventoryFiles(o.out, files); await writeJson(path.join(o.out, 'inventory/crawl-manifest.json'), { createdAt: new Date().toISOString(), folderUrl: o.folderUrl, driveId: o.driveId, fileCount: files.length }); });
program.command('harvest').option('--folder-url <url>').option('--drive-id <id>').requiredOption('--out <dir>').option('--comments').option('--suggestions').option('--revisions').option('--activity').option('--only-id <ids...>', 'harvest only these Google Doc file IDs', collectIds, []).option('--skip-id <ids...>', 'skip these Google Doc file IDs', collectIds, []).option('--fail-fast', 'abort harvest after the first document error').action(async (o: HarvestCommandOptions) => { const apis = clients(await loadOAuthClient()); const files = o.driveId ? await listSharedDrive(apis.drive, o.driveId) : await crawlFolder(apis.drive, folderIdFromOptions(o)); await runHarvest(apis, files, o); });
program.command('render').requiredOption('--in <dir>').option('--mode <mode>', 'cumulative|stepwise', 'cumulative').action(async (o) => renderArchive(o.in, o.mode));
program.command('verify').requiredOption('--in <dir>').action(async (o) => verifyArchive(o.in));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await program.parseAsync();
}

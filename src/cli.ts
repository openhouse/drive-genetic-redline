#!/usr/bin/env node
import { Command } from 'commander';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { runInstalledAppAuth, loadOAuthClient } from './auth/oauth.js';
import { clients } from './drive/client.js';
import { crawlFolder, listSharedDrive } from './drive/crawl.js';
import { parseFolderUrl } from './drive/ids.js';
import { appendJsonl, writeJson } from './fs.js';
import { harvestGoogleDoc } from './harvest/harvest.js';
import { renderArchive } from './render/render.js';
import { verifyArchive } from './verify/archive.js';

const program = new Command().name('drive-redline').description('Archive Google Docs provenance and render DOCX tracked-change genetic redlines.').version('0.1.0');
program.command('auth').description('Run installed-app OAuth and save tokens under .auth/.').action(runInstalledAppAuth);
program.command('inventory').option('--folder-url <url>').option('--drive-id <id>').requiredOption('--out <dir>').action(async (o) => { const apis = clients(await loadOAuthClient()); const files = o.driveId ? await listSharedDrive(apis.drive, o.driveId) : await crawlFolder(apis.drive, parseFolderUrl(o.folderUrl).folderId); await mkdir(path.join(o.out, 'inventory'), { recursive: true }); for (const f of files) await appendJsonl(path.join(o.out, 'inventory', f.mimeType === 'application/vnd.google-apps.folder' ? 'folders.jsonl' : 'files.jsonl'), f); await writeJson(path.join(o.out, 'inventory/crawl-manifest.json'), { createdAt: new Date().toISOString(), folderUrl: o.folderUrl, driveId: o.driveId, fileCount: files.length }); });
program.command('harvest').option('--folder-url <url>').option('--drive-id <id>').requiredOption('--out <dir>').option('--comments').option('--suggestions').option('--revisions').option('--activity').action(async (o) => { const apis = clients(await loadOAuthClient()); const files = o.driveId ? await listSharedDrive(apis.drive, o.driveId) : await crawlFolder(apis.drive, parseFolderUrl(o.folderUrl).folderId); await mkdir(path.join(o.out, 'inventory'), { recursive: true }); for (const f of files) { await appendJsonl(path.join(o.out, 'inventory/files.jsonl'), f); await harvestGoogleDoc(apis, f, o.out); } await writeJson(path.join(o.out, 'inventory/crawl-manifest.json'), { createdAt: new Date().toISOString(), fileCount: files.length }); });
program.command('render').requiredOption('--in <dir>').option('--mode <mode>', 'cumulative|stepwise', 'cumulative').action(async (o) => renderArchive(o.in, o.mode));
program.command('verify').requiredOption('--in <dir>').action(async (o) => verifyArchive(o.in));
program.parseAsync();

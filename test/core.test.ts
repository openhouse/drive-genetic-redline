import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { parseFolderUrl } from '../src/drive/ids.js';
import { snapshotFromText } from '../src/normalize.js';
import { diffSnapshots } from '../src/diff.js';
import { createTrackedDocx } from '../src/docx/writer.js';
import { segmentsFromTexts } from '../src/docx/segments.js';
import { acceptAllTrackedChanges } from '../src/docx/verify.js';

describe('core primitives', () => {
  it('parses folder URLs and resource keys', () => { expect(parseFolderUrl('https://drive.google.com/drive/folders/abc123?resourcekey=rk').folderId).toBe('abc123'); });
  it('emits revision diff events', () => { const a = snapshotFromText('f','r1','hello world'); const b = snapshotFromText('f','r2','hello brave world'); expect(diffSnapshots('doc', a, b)).toEqual(expect.arrayContaining([expect.objectContaining({ eventType: 'insert', text: 'brave ' })])); });
  it('creates a tracked DOCX whose accept-all text is target', async () => { const buf = await createTrackedDocx(segmentsFromTexts('hello world', 'hello brave world')); const zip = await JSZip.loadAsync(buf); const xml = await zip.file('word/document.xml')!.async('string'); expect(acceptAllTrackedChanges(xml)).toBe('hello brave world'); expect(await zip.file('word/settings.xml')!.async('string')).toContain('trackRevisions'); });
});

import { mkdtemp, readFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { harvestGoogleDoc, exportRevisionText } from '../src/harvest/harvest.js';
import { runHarvest } from '../src/cli.js';
import type { SourceFile } from '../src/types.js';

const DOC_MIME = 'application/vnd.google-apps.document';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const docFile = (id: string, name = id): SourceFile => ({ id, name, mimeType: DOC_MIME, parents: [], owners: [], path: [] });

async function tempDir(): Promise<string> { return mkdtemp(path.join(tmpdir(), 'drive-redline-')); }
async function exists(file: string): Promise<boolean> { try { await access(file); return true; } catch { return false; } }

function mockApis(overrides: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const drive = {
    context: { _options: overrides.auth ? { auth: overrides.auth } : {} },
    files: { export: async () => ({ data: Buffer.from('current') }) },
    comments: { list: async () => { calls.push('comments'); return { data: { comments: [] } }; } },
    revisions: {
      list: async () => { calls.push('revisions.list'); return { data: { revisions: overrides.revisions ?? [] } }; },
      get: async () => { calls.push('revisions.get'); if (overrides.revisionGetThrows) throw new Error('no media'); return { data: Buffer.from('fallback snapshot') }; },
    },
  };
  const docs = { documents: { get: async (args: { suggestionsViewMode?: string }) => { calls.push(args.suggestionsViewMode ? 'suggestions' : 'docs'); return { data: { documentId: 'doc' } }; } } };
  const activity = { activity: { query: async () => { calls.push('activity'); return { data: { activities: [] } }; } } };
  return { apis: { drive, docs, activity } as any, calls };
}

describe('harvest hardening', () => {
  it('creates empty derived ledgers without ENOENT when revisions have no exportable snapshots', async () => {
    const out = await tempDir();
    const { apis } = mockApis({ revisions: [{ id: '1', modifiedTime: '2020-01-01T00:00:00Z' }], revisionGetThrows: true });
    await expect(harvestGoogleDoc(apis, docFile('doc1', 'Doc 1'), out, { revisions: true })).resolves.toBeUndefined();
    const root = path.join(out, 'documents/doc-1--doc1/derived');
    await expect(readFile(path.join(root, 'normalized-snapshots.jsonl'), 'utf8')).resolves.toBe('');
    await expect(readFile(path.join(root, 'word-events.jsonl'), 'utf8')).resolves.toBe('');
    await expect(readFile(path.join(root, 'confidence-report.md'), 'utf8')).resolves.toContain('Confidence report');
  });

  it('harvest respects --only-id and records skipped docs', async () => {
    const out = await tempDir();
    const { apis } = mockApis();
    await runHarvest(apis, [docFile('a'), docFile('b')], { out, onlyId: ['b'] });
    expect(await exists(path.join(out, 'documents/a--a'))).toBe(false);
    expect(await exists(path.join(out, 'documents/b--b'))).toBe(true);
    expect(await readFile(path.join(out, '_system/skipped-files.jsonl'), 'utf8')).toContain('not-in-only-id');
  });

  it('harvest respects --skip-id', async () => {
    const out = await tempDir();
    const { apis } = mockApis();
    await runHarvest(apis, [docFile('a'), docFile('b')], { out, skipId: ['a'] });
    expect(await exists(path.join(out, 'documents/a--a'))).toBe(false);
    expect(await exists(path.join(out, 'documents/b--b'))).toBe(true);
    expect(await readFile(path.join(out, '_system/skipped-files.jsonl'), 'utf8')).toContain('skip-id');
  });

  it('logs a failing document and continues harvesting later documents', async () => {
    const out = await tempDir();
    let revisionListCalls = 0;
    const { apis } = mockApis();
    apis.drive.revisions.list = async () => { revisionListCalls += 1; if (revisionListCalls === 1) throw new Error('revision list failed'); return { data: { revisions: [] } }; };
    await runHarvest(apis, [docFile('bad'), docFile('good')], { out, revisions: true });
    expect(await readFile(path.join(out, '_system/harvest-errors.jsonl'), 'utf8')).toContain('revision list failed');
    expect(await exists(path.join(out, 'documents/good--good'))).toBe(true);
  });

  it('harvest flags control optional API paths', async () => {
    const out = await tempDir();
    const { apis, calls } = mockApis({ revisions: [] });
    await harvestGoogleDoc(apis, docFile('flags', 'Flags'), out, {});
    expect(calls).toEqual(['docs']);
    const enabled = mockApis({ revisions: [] });
    await harvestGoogleDoc(enabled.apis, docFile('flags2', 'Flags 2'), out, { comments: true, suggestions: true, revisions: true, activity: true });
    expect(enabled.calls).toEqual(expect.arrayContaining(['docs', 'suggestions', 'comments', 'activity', 'revisions.list']));
  });

  it('uses revision text/plain exportLinks before revisions media fallback', async () => {
    const out = await tempDir();
    const auth = { request: async () => ({ data: Buffer.from('export link snapshot') }) };
    const { apis, calls } = mockApis({ auth });
    const text = await exportRevisionText(apis.drive, 'file', { fileId: 'file', revisionId: 'rev/1', exportLinks: { 'text/plain': 'https://example.test/export' } }, out);
    expect(text).toBe('export link snapshot');
    expect(calls).not.toContain('revisions.get');
    await expect(readFile(path.join(out, 'revisions/rev-1/snapshot.txt'), 'utf8')).resolves.toBe('export link snapshot');
  });

  it('writes folders to folders.jsonl during harvest inventory', async () => {
    const out = await tempDir();
    const { apis } = mockApis();
    await runHarvest(apis, [{ id: 'folder', name: 'Folder', mimeType: FOLDER_MIME, parents: [], owners: [], path: [] }, docFile('doc')] as SourceFile[], { out });
    expect(await readFile(path.join(out, 'inventory/folders.jsonl'), 'utf8')).toContain('folder');
    expect(await readFile(path.join(out, 'inventory/files.jsonl'), 'utf8')).not.toContain(FOLDER_MIME);
  });
});

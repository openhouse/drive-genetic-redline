import { readFile } from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import { walk } from '../fs.js';
import { acceptAllTrackedChanges } from '../docx/verify.js';
import type { Snapshot } from '../types.js';

export async function verifyArchive(inDir: string): Promise<void> {
  let checked = 0;
  for await (const file of walk(path.join(inDir, 'documents'))) if (file.endsWith('cumulative-genetic-redline.docx')) { const root = path.resolve(path.dirname(file), '..'); const snapsFile = path.join(root, 'derived/normalized-snapshots.jsonl'); const snapshots = (await readFile(snapsFile, 'utf8')).trim().split('\n').map(l => JSON.parse(l) as Snapshot); const target = snapshots.at(-1)!; const zip = await JSZip.loadAsync(await readFile(file)); const xml = await zip.file('word/document.xml')!.async('string'); const accepted = acceptAllTrackedChanges(xml); if (accepted !== target.text) throw new Error(`${file} accept-all text did not match ${target.revisionId}`); checked++; }
  console.log(`Verified ${checked} cumulative redline DOCX file(s).`);
}

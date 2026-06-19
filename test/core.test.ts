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

import JSZip from 'jszip';
import { create } from 'xmlbuilder2';
import type { WordEvent } from '../types.js';

export type DocxSegment = { kind: 'same' | 'insert' | 'delete'; text: string; event?: WordEvent; id?: number };
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
function run(parent: any, tag: 'w:t' | 'w:delText', text: string) { const r = parent.ele('w:r'); const t = r.ele(tag); if (/^\s|\s$|\n/.test(text)) t.att('xml:space', 'preserve'); t.txt(text); }
function addSegment(p: any, s: DocxSegment) { if (!s.text) return; if (s.kind === 'same') run(p, 'w:t', s.text); else { const e = p.ele(s.kind === 'insert' ? 'w:ins' : 'w:del').att('w:id', String(s.id ?? 1)).att('w:author', s.event?.actorDisplayName ?? 'Unknown Google editor'); if (s.event?.timestamp) e.att('w:date', s.event.timestamp); run(e, s.kind === 'insert' ? 'w:t' : 'w:delText', s.text); } }
export async function createTrackedDocx(segments: DocxSegment[], title = 'Genetic redline'): Promise<Buffer> {
  const doc = create({ version: '1.0', encoding: 'UTF-8' }).ele('w:document', { 'xmlns:w': W }).ele('w:body');
  const p = doc.ele('w:p'); segments.forEach((s, i) => addSegment(p, { ...s, id: s.id ?? i + 1 })); doc.ele('w:sectPr');
  const documentXml = doc.up().up().end({ prettyPrint: false });
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>');
  zip.file('word/document.xml', documentXml);
  zip.file('word/settings.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="${W}"><w:trackRevisions w:val="true"/></w:settings>`);
  zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${title}</dc:title></cp:coreProperties>`);
  zip.file('docProps/app.xml', '<?xml version="1.0" encoding="UTF-8"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>drive-genetic-redline</Application></Properties>');
  return zip.generateAsync({ type: 'nodebuffer' });
}

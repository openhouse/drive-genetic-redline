import DiffMatchPatch from 'diff-match-patch';
import type { WordEvent } from '../types.js';
import type { DocxSegment } from './writer.js';
const dmp = new DiffMatchPatch();
export function segmentsFromTexts(fromText: string, toText: string, eventDefaults: Partial<WordEvent> = {}): DocxSegment[] {
  const diffs = dmp.diff_main(fromText, toText); dmp.diff_cleanupSemantic(diffs);
  return diffs.map(([op, text], i) => ({ kind: op === 0 ? 'same' : op === 1 ? 'insert' : 'delete', text, event: { eventId: `docx-${i}`, fileId: eventDefaults.fileId ?? 'unknown', docTitle: eventDefaults.docTitle ?? 'Document', fromRevisionId: eventDefaults.fromRevisionId ?? 'baseline', toRevisionId: eventDefaults.toRevisionId ?? 'target', eventType: op === 1 ? 'insert' : 'delete', actorDisplayName: eventDefaults.actorDisplayName ?? 'Unknown Google editor', timestamp: eventDefaults.timestamp, evidence: eventDefaults.evidence ?? { source: 'revision-diff', confidence: 'unknown' } } as WordEvent }));
}

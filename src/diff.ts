import DiffMatchPatch from 'diff-match-patch';
import type { RevisionRecord, Snapshot, WordEvent } from './types.js';
const dmp = new DiffMatchPatch();

export function diffSnapshots(docTitle: string, from: Snapshot, to: Snapshot, toRevision?: RevisionRecord): WordEvent[] {
  const diffs = dmp.diff_main(from.text, to.text); dmp.diff_cleanupSemantic(diffs);
  let offset = 0;
  return diffs.flatMap(([op, text], i) => {
    if (op === 0) { offset += text.length; return []; }
    const author = toRevision?.lastModifyingUser?.displayName ?? 'Unknown Google editor';
    const email = toRevision?.lastModifyingUser?.emailAddress;
    const event: WordEvent = { eventId: `${from.revisionId}-${to.revisionId}-${i}`, fileId: to.fileId, docTitle, fromRevisionId: from.revisionId, toRevisionId: to.revisionId, eventType: op === 1 ? 'insert' : 'delete', text, beforeContext: from.text.slice(Math.max(0, offset - 40), offset), afterContext: from.text.slice(offset, offset + 40), startOffset: offset, endOffset: op === -1 ? offset + text.length : offset, actorDisplayName: author, actorEmail: email, timestamp: toRevision?.modifiedTime, evidence: { source: 'revision-diff', confidence: author === 'Unknown Google editor' ? 'low' : 'medium', notes: ['Attributed to later revision metadata; public APIs may merge revision history.'] } };
    if (op === -1) offset += text.length;
    return [event];
  });
}

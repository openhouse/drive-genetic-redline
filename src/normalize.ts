import { createHash } from 'node:crypto';
import type { Snapshot, SnapshotBlock } from './types.js';

export function normalizeText(text: string): string { return text.replace(/\r\n?/g, '\n').replace(/[\t ]+\n/g, '\n').trimEnd(); }
export function blocksFromText(text: string): SnapshotBlock[] { return normalizeText(text).split(/\n{2,}|\n/).map((p, index) => ({ type: 'paragraph', text: p, index })); }
export function snapshotFromText(fileId: string, revisionId: string, text: string): Snapshot { const normalized = normalizeText(text); return { fileId, revisionId, text: normalized, blocks: blocksFromText(normalized), sha256: createHash('sha256').update(normalized).digest('hex') }; }

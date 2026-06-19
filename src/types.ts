import { z } from 'zod';

export const GoogleUserSchema = z.object({
  displayName: z.string().optional(),
  emailAddress: z.string().optional(),
  permissionId: z.string().optional(),
});
export type GoogleUser = z.infer<typeof GoogleUserSchema>;

export const SourceFileSchema = z.object({
  id: z.string(),
  name: z.string(),
  mimeType: z.string(),
  webViewLink: z.string().optional(),
  parents: z.array(z.string()).default([]),
  owners: z.array(GoogleUserSchema).default([]),
  lastModifyingUser: GoogleUserSchema.optional(),
  createdTime: z.string().optional(),
  modifiedTime: z.string().optional(),
  path: z.array(z.string()).default([]),
  resourceKey: z.string().optional(),
  shortcutDetails: z.unknown().optional(),
});
export type SourceFile = z.infer<typeof SourceFileSchema>;

export const RevisionRecordSchema = z.object({
  fileId: z.string(),
  revisionId: z.string(),
  modifiedTime: z.string().optional(),
  lastModifyingUser: GoogleUserSchema.optional(),
  exportLinks: z.record(z.string()).optional(),
  keepForever: z.boolean().optional(),
  originalFilename: z.string().optional(),
});
export type RevisionRecord = z.infer<typeof RevisionRecordSchema>;

export interface SnapshotBlock { type: 'paragraph'; text: string; index: number }
export interface Snapshot { fileId: string; revisionId: string; text: string; blocks: SnapshotBlock[]; sha256: string }
export type WordEventType = 'insert' | 'delete' | 'replace' | 'move' | 'format' | 'unknown';
export type EvidenceSource = 'native-suggestion' | 'revision-diff' | 'drive-activity' | 'comment-anchor';
export type Confidence = 'exact' | 'high' | 'medium' | 'low' | 'unknown';
export interface WordEvent {
  eventId: string; fileId: string; docTitle: string; fromRevisionId: string; toRevisionId: string;
  eventType: WordEventType; text: string; beforeContext?: string; afterContext?: string;
  blockPath?: string; paragraphIndex?: number; startOffset?: number; endOffset?: number;
  actorDisplayName: string; actorEmail?: string; timestamp?: string;
  evidence: { source: EvidenceSource; confidence: Confidence; notes?: string[] };
}
export interface DocxRevisionMap { docxRevisionId: number; eventId: string; author: string; date?: string; confidence: Confidence }

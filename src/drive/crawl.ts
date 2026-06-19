import type { drive_v3 } from 'googleapis';
import type { SourceFile } from '../types.js';

const fields = 'nextPageToken, files(id,name,mimeType,webViewLink,parents,owners,lastModifyingUser,createdTime,modifiedTime,resourceKey,shortcutDetails)';
export async function crawlFolder(drive: drive_v3.Drive, folderId: string, path: string[] = []): Promise<SourceFile[]> {
  const out: SourceFile[] = []; let pageToken: string | undefined;
  do { const res = await drive.files.list({ q: `'${folderId}' in parents and trashed=false`, supportsAllDrives: true, includeItemsFromAllDrives: true, fields, pageToken });
    for (const f of res.data.files ?? []) { const sf = { id: f.id!, name: f.name ?? 'Untitled', mimeType: f.mimeType ?? 'application/octet-stream', webViewLink: f.webViewLink ?? undefined, parents: f.parents ?? [], owners: f.owners as any ?? [], lastModifyingUser: f.lastModifyingUser as any, createdTime: f.createdTime ?? undefined, modifiedTime: f.modifiedTime ?? undefined, path: [...path, f.name ?? 'Untitled'], resourceKey: f.resourceKey ?? undefined, shortcutDetails: f.shortcutDetails as any } satisfies SourceFile; out.push(sf); if (sf.mimeType === 'application/vnd.google-apps.folder') out.push(...await crawlFolder(drive, sf.id, sf.path)); }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken); return out;
}
export async function listSharedDrive(drive: drive_v3.Drive, driveId: string): Promise<SourceFile[]> { const out: SourceFile[] = []; let pageToken: string | undefined; do { const res = await drive.files.list({ corpora: 'drive', driveId, supportsAllDrives: true, includeItemsFromAllDrives: true, fields, pageToken }); out.push(...(res.data.files ?? []).map(f => ({ id: f.id!, name: f.name ?? 'Untitled', mimeType: f.mimeType ?? 'application/octet-stream', webViewLink: f.webViewLink ?? undefined, parents: f.parents ?? [], owners: f.owners as any ?? [], lastModifyingUser: f.lastModifyingUser as any, createdTime: f.createdTime ?? undefined, modifiedTime: f.modifiedTime ?? undefined, path: [f.name ?? 'Untitled'], resourceKey: f.resourceKey ?? undefined, shortcutDetails: f.shortcutDetails as any }))); pageToken = res.data.nextPageToken ?? undefined; } while (pageToken); return out; }

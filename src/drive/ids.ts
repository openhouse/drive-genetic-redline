export function parseFolderUrl(input: string): { folderId: string; resourceKey?: string } {
  const url = new URL(input); const m = url.pathname.match(/\/drive\/folders\/([^/]+)/); const folderId = m?.[1] ?? url.searchParams.get('id'); if (!folderId) throw new Error(`Could not parse Google Drive folder ID from ${input}`); return { folderId, resourceKey: url.searchParams.get('resourcekey') ?? undefined };
}
export function slugify(name: string): string { return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'untitled'; }

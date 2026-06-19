import { mkdir, writeFile, appendFile, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

export async function ensureDir(dir: string): Promise<void> { await mkdir(dir, { recursive: true }); }
export async function writeJson(file: string, value: unknown): Promise<void> { await ensureDir(path.dirname(file)); await writeFile(file, JSON.stringify(value, null, 2)); }
export async function appendJsonl(file: string, value: unknown): Promise<void> { await ensureDir(path.dirname(file)); await appendFile(file, `${JSON.stringify(value)}\n`); }
export async function readText(file: string): Promise<string> { return readFile(file, 'utf8'); }
export async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir)) { const full = path.join(dir, entry); const s = await stat(full); if (s.isDirectory()) yield* walk(full); else yield full; }
}

import http from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { OAuth2Client } from 'google-auth-library';

export const GOOGLE_SCOPES = ['https://www.googleapis.com/auth/drive.readonly','https://www.googleapis.com/auth/drive.metadata.readonly','https://www.googleapis.com/auth/drive.activity.readonly','https://www.googleapis.com/auth/documents.readonly'];
const AUTH_DIR = '.auth';
export async function loadOAuthClient(): Promise<OAuth2Client> {
  const credentials = JSON.parse(await readFile(path.join(AUTH_DIR, 'credentials.json'), 'utf8'));
  const c = credentials.installed ?? credentials.web ?? credentials;
  const client = new OAuth2Client(c.client_id, c.client_secret, 'http://127.0.0.1:53682/oauth2callback');
  try { client.setCredentials(JSON.parse(await readFile(path.join(AUTH_DIR, 'token.json'), 'utf8'))); } catch {}
  return client;
}
export async function runInstalledAppAuth(): Promise<void> {
  await mkdir(AUTH_DIR, { recursive: true }); const client = await loadOAuthClient();
  const url = client.generateAuthUrl({ access_type: 'offline', scope: GOOGLE_SCOPES, prompt: 'consent' });
  console.log(`Open this URL to authorize drive-redline:\n${url}`);
  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => { const u = new URL(req.url ?? '/', 'http://127.0.0.1:53682'); if (u.pathname === '/oauth2callback') { res.end('Authorization complete. You can close this tab.'); server.close(); resolve(u.searchParams.get('code') ?? ''); } }).listen(53682).on('error', reject);
  });
  const { tokens } = await client.getToken(code); await writeFile(path.join(AUTH_DIR, 'token.json'), JSON.stringify(tokens, null, 2)); console.log('Saved token to .auth/token.json');
}

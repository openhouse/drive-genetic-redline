import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
export function clients(auth: OAuth2Client) { return { drive: google.drive({ version: 'v3', auth }), docs: google.docs({ version: 'v1', auth }), activity: google.driveactivity({ version: 'v2', auth }) }; }

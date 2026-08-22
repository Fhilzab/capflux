/**
 * GoogleSheetsImportService
 *
 * Lightweight Google Sheets integration for importing student data.
 * Uses Google Identity Services (loaded dynamically) + Sheets API v4 REST
 * via fetch — no large SDK dependency.
 *
 * Before using, set VITE_GOOGLE_CLIENT_ID in your environment.
 * If not configured, the service clearly reports the missing configuration
 * rather than silently failing.
 */

import type { ParseResult } from '../types';

export interface GoogleSheetsConfig {
  configured: boolean;
  clientId: string | null;
  error: string | null;
}

export interface GoogleSheetInfo {
  spreadsheetId: string;
  title: string;
  sheetNames: string[];
}

/** Whether the Google Sheets integration is configured. */
export function getGoogleSheetsConfig(): GoogleSheetsConfig {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) {
    return {
      configured: false,
      clientId: null,
      error:
        'Google Sheets integration is not configured. ' +
        'Please set VITE_GOOGLE_CLIENT_ID in your environment to enable Google Sheets import.',
    };
  }
  return { configured: true, clientId, error: null };
}

/**
 * Extract a Google Sheets spreadsheet ID from a URL or raw ID.
 * Handles formats like:
 *   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit#...
 *   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/
 *   SPREADSHEET_ID (raw)
 */
export function extractSpreadsheetId(input: string): string | null {
  if (!input || typeof input !== 'string') return null;

  const trimmed = input.trim();

  // Raw ID (alphanumeric + dashes, typically 44 chars)
  if (trimmed.match(/^[a-zA-Z0-9_-]{20,}$/) && !trimmed.includes('google.com') && !trimmed.includes('/')) {
    return trimmed;
  }

  // URL format
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (urlMatch) return urlMatch[1];

  return null;
}

let googleToken: string | null = null;
let googleTokenClient: any = null;

/**
 * Dynamically load the Google Identity Services script.
 * Returns a promise that resolves when the script is loaded.
 */
function loadGoogleScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Google Sheets integration requires a browser environment.'));
      return;
    }

    if ((window as any).google?.accounts?.oauth2) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if ((window as any).google?.accounts?.oauth2) {
        resolve();
      } else {
        reject(new Error('Google Identity Services script loaded but API not available.'));
      }
    };
    script.onerror = () => {
      reject(new Error('Failed to load Google Identity Services script.'));
    };
    document.head.appendChild(script);
  });
}

/**
 * Initialize the Google OAuth2 token client.
 * Must be called after loadGoogleScript().
 */
function initTokenClient(clientId: string): void {
  googleTokenClient = (window as any).google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    callback: (response: { access_token?: string; error?: string }) => {
      if (response.access_token) {
        googleToken = response.access_token;
      }
    },
  });
}

/**
 * Prompt the user for Google OAuth consent and obtain an access token.
 */
export async function authenticate(): Promise<{ token: string | null; error: string | null }> {
  const config = getGoogleSheetsConfig();
  if (!config.configured || !config.clientId) {
    return { token: null, error: config.error };
  }

  try {
    await loadGoogleScript();
    initTokenClient(config.clientId);

    return await new Promise((resolve) => {
      googleTokenClient.requestAccessToken({
        prompt: 'consent',
      });

      // Poll for token completion
      let attempts = 0;
      const maxAttempts = 20;
      const interval = setInterval(() => {
        attempts++;
        if (googleToken) {
          clearInterval(interval);
          resolve({ token: googleToken, error: null });
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          resolve({ token: null, error: 'Authentication timed out. Please try again.' });
        }
      }, 500);
    });
  } catch (err: any) {
    return { token: null, error: err.message || 'Failed to initialize Google authentication.' };
  }
}

/**
 * Fetch spreadsheet metadata to list available sheets.
 */
export async function getSheetInfo(spreadsheetId: string): Promise<{ info: GoogleSheetInfo | null; error: string | null }> {
  const config = getGoogleSheetsConfig();
  if (!config.configured) {
    return { info: null, error: config.error };
  }

  if (!googleToken) {
    const authResult = await authenticate();
    if (!authResult.token) {
      return { info: null, error: authResult.error };
    }
  }

  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?metadata`,
      {
        headers: {
          Authorization: `Bearer ${googleToken}`,
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Sheets API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const sheetNames = (data.sheets || []).map((s: any) => s.properties?.title).filter(Boolean);

    return {
      info: {
        spreadsheetId,
        title: data.properties?.title || '',
        sheetNames,
      },
      error: null,
    };
  } catch (err: any) {
    return { info: null, error: err.message || 'Failed to fetch spreadsheet metadata.' };
  }
}

/**
 * Fetch sheet data and convert to ParseResult format (compatible with
 * StudentImportService.parseFile output).
 */
export async function fetchSheetData(
  spreadsheetId: string,
  sheetName?: string,
): Promise<{ result: ParseResult | null; error: string | null }> {
  const config = getGoogleSheetsConfig();
  if (!config.configured) {
    return { result: null, error: config.error };
  }

  if (!googleToken) {
    const authResult = await authenticate();
    if (!authResult.token) {
      return { result: null, error: authResult.error };
    }
  }

  const range = sheetName ? `${sheetName}` : undefined;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range || 'A:Z'}`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${googleToken}`,
      },
    });

    if (!response.ok) {
      let errorDetail = '';
      try {
        const err = await response.json();
        errorDetail = err.error?.message || JSON.stringify(err);
      } catch {
        errorDetail = await response.text();
      }
      throw new Error(`Google Sheets API error: ${response.status} ${errorDetail}`);
    }

    const data = await response.json();
    const values: string[][] = data.values || [];

    if (values.length < 2) {
      throw new Error('The selected sheet appears to be empty or has no data rows.');
    }

    const headers = values[0].map((h) => String(h).trim());
    const dataRows = values.slice(1);

    const rows = dataRows.map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((header, idx) => {
        obj[header] = row[idx] != null ? String(row[idx]).trim() : '';
      });
      return obj;
    });

    return {
      result: {
        fileName: data.spreadsheetId ? `Google Sheet: ${data.spreadsheetId}` : 'Google Sheet',
        headers,
        rows,
      },
      error: null,
    };
  } catch (err: any) {
    return { result: null, error: err.message || 'Failed to fetch Google Sheets data.' };
  }
}

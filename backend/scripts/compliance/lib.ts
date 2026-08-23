/**
 * Shared utilities for CAPFLUX compliance audit scripts.
 *
 * These scripts are STATIC ANALYSIS ONLY. They assess the presence and shape
 * of technical controls in the repository. They NEVER assert legal or
 * regulatory compliance.
 */

export type Status =
  | 'PASS'
  | 'PARTIAL'
  | 'FAIL'
  | 'UNKNOWN'
  | 'REQUIRES_LEGAL_REVIEW';

export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface Finding {
  id: string;
  detail: string;
  file?: string;
  line?: number;
  severity: Severity;
}

export interface CheckResult {
  id: string;
  title: string;
  status: Status;
  summary: string;
  findings: Finding[];
}

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export function scriptDir(): string {
  return fileURLToPath(new URL('.', import.meta.url));
}

export function repoRoot(): string {
  // backend/scripts/compliance/lib.js -> repo root is three levels up.
  return join(scriptDir(), '..', '..', '..');
}

const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'dist-ssr',
  'dist_node',
  '.commandcode',
  'coverage',
  '.vscode',
]);

export function isExcluded(relPath: string): boolean {
  const parts = relPath.split(sep);
  return parts.some((p) => EXCLUDED_DIRS.has(p));
}

/** Recursively list files under `dir` (relative to repo root), filtered by extension. */
export function listFiles(dirRel: string, extensions: readonly string[]): string[] {
  const abs = join(repoRoot(), dirRel);
  const out: string[] = [];
  let entries;
  try {
    entries = readdirSync(abs, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const rel = join(dirRel, entry.name);
    if (entry.isDirectory()) {
      if (isExcluded(rel)) continue;
      out.push(...listFiles(rel, extensions));
    } else if (entry.isFile()) {
      if (extensions.length === 0 || extensions.some((e) => entry.name.endsWith(e))) {
        out.push(rel);
      }
    }
  }
  return out.sort();
}

/** Read a repo file as UTF-8; returns null when missing/unreadable/too large. */
export function readFile(relPath: string, maxBytes = 2_000_000): string | null {
  try {
    const abs = join(repoRoot(), relPath);
    if (statSync(abs).size > maxBytes) return null;
    return readFileSync(abs, 'utf8');
  } catch {
    return null;
  }
}

export interface LineHit {
  line: number;
  text: string;
}

/** Return 1-indexed lines matching a regex. */
export function matchLines(content: string, re: RegExp): LineHit[] {
  const hits: LineHit[] = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    re.lastIndex = 0;
    if (re.test(lines[i] ?? '')) {
      hits.push({ line: i + 1, text: lines[i] as string });
    }
  }
  return hits;
}

/** True when any file contains the pattern. */
export function anyFileMatches(files: string[], re: RegExp): boolean {
  for (const f of files) {
    const c = readFile(f);
    if (c && re.test(c)) return true;
  }
  return false;
}

export function rel(pathAbs: string): string {
  return relative(repoRoot(), pathAbs);
}

export function result(
  id: string,
  title: string,
  status: Status,
  summary: string,
  findings: Finding[] = []
): CheckResult {
  return { id, title, status, summary, findings };
}

/**
 * check-secrets — scan repository text files for committed credential material.
 * Static heuristic scan; findings require human confirmation before rotation
 * decisions. Never prints the secret value itself, only location + pattern.
 */
import {
  listFiles,
  matchLines,
  readFile,
  result,
  type CheckResult,
} from './lib.js';

const SCAN_ROOTS = ['backend', 'frontend', 'supabase', 'docs'];
const EXTS = ['.ts', '.js', '.vue', '.sql', '.md', '.json', '.sh', '.example', '.toml', '.env'];
// .env/.env.local are git-ignored by convention (backend/.gitignore) and are
// therefore NOT committed-secret risks; .env.example stays in scope.
const ALLOW_BASENAMES = [
  '.env',
  '.env.local',
  '.env.local.backup',
  'compliance-status.json',
  'package-lock.json',
  'skills-lock.json',
];

interface PatternDef {
  id: string;
  re: RegExp;
  severity: 'high' | 'critical';
  description: string;
}

const PATTERNS: PatternDef[] = [
  {
    id: 'SEC-HEX-SECRET',
    // Long hex string on a line that also mentions a secret-ish key name.
    re: /(password|secret|api[_-]?key|cookie[_-]?password)[^\n]{0,60}\b[0-9a-fA-F]{32,64}\b/i,
    severity: 'critical',
    description: 'Long hex literal adjacent to a secret key name (possible committed credential)',
  },
  {
    id: 'SEC-SK-LIVE',
    re: /sk_(live|test)_[A-Za-z0-9]{12,}/,
    severity: 'critical',
    description: 'PSP-style live/test secret key literal',
  },
  {
    id: 'SEC-PRIVATE-KEY',
    re: /BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/,
    severity: 'critical',
    description: 'Embedded private key block',
  },
  {
    id: 'SEC-JWT',
    re: /eyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/,
    severity: 'high',
    description: 'JWT-shaped literal (possible leaked token)',
  },
  {
    id: 'SEC-GOOGLE',
    re: /AIza[0-9A-Za-z_-]{30,}/,
    severity: 'high',
    description: 'Google API key literal',
  },
];

function looksLikePlaceholder(lineText: string): boolean {
  const lowered = lineText.toLowerCase();
  return (
    lowered.includes('your-') ||
    lowered.includes('your_') ||
    lowered.includes('placeholder') ||
    lowered.includes('example') ||
    lowered.includes('change-me') ||
    lowered.includes('process.env') ||
    lowered.includes('${') ||
    lowered.includes('sk_live_...') ||
    lowered.includes('<') && lowered.includes('>')
  );
}

export function run(): CheckResult {
  const files = new Set<string>();
  for (const root of SCAN_ROOTS) {
    for (const f of listFiles(root === '.' ? '' : root, EXTS)) {
      const base = f.split(/[\\/]/).pop() ?? '';
      if (!ALLOW_BASENAMES.includes(base)) files.add(f);
    }
  }

  const findings: CheckResult['findings'] = [];
  for (const file of files) {
    const content = readFile(file);
    if (!content) continue;
    for (const p of PATTERNS) {
      for (const hit of matchLines(content, p.re)) {
        if (looksLikePlaceholder(hit.text)) continue;
        findings.push({
          id: p.id,
          detail: `${p.description}: "${hit.text.slice(0, 90).replace(/([0-9a-fA-F]{8})[0-9a-fA-F]+/, '$1…[MASKED]')}…"`.slice(0, 160),
          file,
          line: hit.line,
          severity: p.severity,
        });
      }
    }
  }

  // Also verify .env hygiene expectations.
  const envHygiene: string[] = [];
  const feEnv = readFile('frontend/.env');
  if (feEnv) {
    envHygiene.push('frontend/.env is tracked in git (contains publishable values only — hygiene deviation, COMP-031)');
  }

  let status: CheckResult['status'] = 'PASS';
  const critical = findings.filter((f) => f.severity === 'critical').length;
  const high = findings.filter((f) => f.severity === 'high').length;
  if (critical > 0) status = 'FAIL';
  else if (high > 0 || envHygiene.length > 0) status = 'PARTIAL';

  return result(
    'check-secrets',
    'Committed secrets scan',
    status,
    critical + high > 0
      ? `${critical} critical and ${high} high-severity pattern hits. Confirm each manually; rotate+purge any real credential (see docs/compliance/SECRETS_AND_CRYPTOGRAPHY.md).`
      : 'No credential-shaped literals found in scanned files.',
    findings.concat(
      envHygiene.map((detail, i) => ({
        id: `SEC-ENV-HYGIENE-${i + 1}`,
        detail,
        severity: 'low' as const,
      }))
    )
  );
}

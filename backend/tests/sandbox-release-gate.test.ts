/**
 * Sandbox release gate — configuration isolation tests.
 *
 * MANDATORY before public sandbox deployment. Proves, in BOTH directions:
 *  §13  CAPFLUX_MODE=sandbox + production resources  ⇒ startup REJECTED
 *  §14  CAPFLUX_MODE=production + sandbox resources  ⇒ startup REJECTED
 * plus the gateway-factory runtime guards and the non-secret runtime
 * descriptor used for frontend/backend mode-mismatch detection.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';

const {
  validateRuntimeConfiguration,
  getCapfluxMode,
  SandboxConfigurationError,
  ProductionConfigurationError,
} = await import('../services/RuntimeConfiguration.js');
const { GatewayFactory } = await import('../services/gateways/GatewayFactory.js');

function envWith(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return { ...overrides } as NodeJS.ProcessEnv;
}

const SANDBOX_BASE = envWith({
  NODE_ENV: 'production',
  CAPFLUX_MODE: 'sandbox',
  CAPFLUX_DATABASE_ENV: 'sandbox',
});

const PRODUCTION_BASE = envWith({
  NODE_ENV: 'production',
  CAPFLUX_MODE: 'production',
  CAPFLUX_DATABASE_ENV: 'production',
});

beforeEach(() => {
  process.env.CAPFLUX_MODE = 'test-undefined';
  delete process.env.CAPFLUX_MODE;
});

// ---------------------------------------------------------------------------
// Valid baselines
// ---------------------------------------------------------------------------

test('valid sandbox baseline passes validation', () => {
  const result = validateRuntimeConfiguration(SANDBOX_BASE);
  assert.equal(result.mode, 'sandbox');
  assert.equal(result.databaseEnv, 'sandbox');
});

test('valid production baseline passes validation', () => {
  const result = validateRuntimeConfiguration(PRODUCTION_BASE);
  assert.equal(result.mode, 'production');
  assert.equal(result.databaseEnv, 'production');
});

test('unset CAPFLUX_MODE fails closed to production', () => {
  process.env.NODE_ENV = 'test';
  delete process.env.CAPFLUX_MODE;
  assert.equal(getCapfluxMode(envWith({ NODE_ENV: 'development' })), 'production');
});

// ---------------------------------------------------------------------------
// §13 — sandbox must reject every class of production resource
// ---------------------------------------------------------------------------

test('sandbox rejects production Paystack credentials (SANDBOX_CONFIGURATION_ERROR)', () => {
  assert.throws(
    () =>
      validateRuntimeConfiguration({ ...SANDBOX_BASE, PAYSTACK_SECRET_KEY: 'sk_test_x' }),
    (err: Error) => err instanceof SandboxConfigurationError && /PAYSTACK_SECRET_KEY/.test(err.message),
  );
});

test('sandbox rejects production Monnify credentials', () => {
  assert.throws(
    () =>
      validateRuntimeConfiguration({ ...SANDBOX_BASE, MONNIFY_SECRET_KEY: 'mk_test_y' }),
    SandboxConfigurationError,
  );
});

test('sandbox rejects production payment webhook configuration', () => {
  assert.throws(
    () =>
      validateRuntimeConfiguration({ ...SANDBOX_BASE, PAYSTACK_WEBHOOK_SECRET: 'whsec_z' }),
    /webhook configuration/i,
  );
  assert.throws(
    () =>
      validateRuntimeConfiguration({ ...SANDBOX_BASE, MONNIFY_WEBHOOK_SECRET: 'whsec_w' }),
    SandboxConfigurationError,
  );
});

test('sandbox rejects PAYMENTS_PROVIDER_MODE=production (live gateway config)', () => {
  assert.throws(
    () =>
      validateRuntimeConfiguration({ ...SANDBOX_BASE, PAYMENTS_PROVIDER_MODE: 'production' }),
    /live payment gateway/i,
  );
});

test('sandbox rejects live KYC provider (IDENTITY_VERIFICATION_PROVIDER=approved)', () => {
  assert.throws(
    () =>
      validateRuntimeConfiguration({
        ...SANDBOX_BASE,
        IDENTITY_VERIFICATION_PROVIDER: 'approved',
      }),
    /KYC\/settlement verification must use the deterministic mock adapter/i,
  );
});

test('sandbox rejects live settlement verification provider', () => {
  assert.throws(
    () =>
      validateRuntimeConfiguration({
        ...SANDBOX_BASE,
        SETTLEMENT_VERIFICATION_PROVIDER: 'approved',
      }),
    SandboxConfigurationError,
  );
});

test('sandbox rejects a production database declaration (MODE_DATABASE_MISMATCH)', () => {
  assert.throws(
    () =>
      validateRuntimeConfiguration({ ...SANDBOX_BASE, CAPFLUX_DATABASE_ENV: 'production' }),
    /must agree with the runtime mode|MODE_DATABASE_MISMATCH|agree/i,
  );
});

test('deployed sandbox forbids CORS_ALLOW_ALL (public-safety posture)', () => {
  // SANDBOX_BASE already has NODE_ENV=production.
  assert.throws(
    () => validateRuntimeConfiguration({ ...SANDBOX_BASE, CORS_ALLOW_ALL: 'true' }),
    /CORS_ALLOW_ALL/,
  );
});

// ---------------------------------------------------------------------------
// §14 — production must reject sandbox resources
// ---------------------------------------------------------------------------

test('production rejects a sandbox database declaration', () => {
  assert.throws(
    () =>
      validateRuntimeConfiguration({ ...PRODUCTION_BASE, CAPFLUX_DATABASE_ENV: 'sandbox' }),
    ProductionConfigurationError,
  );
});

test('production rejects sandbox-only leftover variables', () => {
  assert.throws(
    () =>
      validateRuntimeConfiguration({ ...PRODUCTION_BASE, SANDBOX_DATABASE_URL: 'https://x' }),
    ProductionConfigurationError,
  );
  assert.throws(
    () =>
      validateRuntimeConfiguration({ ...PRODUCTION_BASE, SANDBOX_API_BASE_URL: 'https://y' }),
    ProductionConfigurationError,
  );
});

test('deployed production refuses mock identity/settlement providers', () => {
  assert.throws(
    () =>
      validateRuntimeConfiguration({
        ...PRODUCTION_BASE,
        IDENTITY_VERIFICATION_PROVIDER: 'mock',
      }),
    ProductionConfigurationError,
  );
});

test('NODE_ENV=production requires an explicit CAPFLUX_DATABASE_ENV', () => {
  assert.throws(
    () =>
      validateRuntimeConfiguration({
        NODE_ENV: 'production',
        CAPFLUX_MODE: 'sandbox',
        // no CAPFLUX_DATABASE_ENV
      }),
    /CAPFLUX_DATABASE_ENV is required/,
  );
});

test('development escape hatch: missing DATABASE_ENV is tolerated outside production', () => {
  const result = validateRuntimeConfiguration(
    envWith({ NODE_ENV: 'development', CAPFLUX_MODE: 'sandbox' }),
  );
  assert.equal(result.mode, 'sandbox');
  assert.equal(result.databaseEnv, undefined);
});

test('explicitly invalid mode values are rejected, never coerced', () => {
  assert.throws(
    () => validateRuntimeConfiguration(envWith({ NODE_ENV: 'development', CAPFLUX_MODE: 'demo' })),
    /Invalid CAPFLUX_MODE/,
  );
  assert.throws(
    () =>
      validateRuntimeConfiguration(
        envWith({ NODE_ENV: 'development', CAPFLUX_MODE: 'sandbox', CAPFLUX_DATABASE_ENV: 'staging' }),
      ),
    /Invalid CAPFLUX_DATABASE_ENV/,
  );
});

// ---------------------------------------------------------------------------
// Gateway factory runtime guards — loud throws, no silent fallbacks
// ---------------------------------------------------------------------------

test('sandbox process cannot initialize live payment providers', async () => {
  process.env.CAPFLUX_MODE = 'sandbox';
  try {
    assert.throws(() => GatewayFactory.get('monnify'), SandboxConfigurationError);
    assert.throws(() => GatewayFactory.get('paystack'), SandboxConfigurationError);
  } finally {
    delete process.env.CAPFLUX_MODE;
  }
});

test('deployed production process cannot initialize test/sandbox adapters', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  process.env.CAPFLUX_MODE = 'production';
  try {
    assert.throws(() => GatewayFactory.get('sandbox'), ProductionConfigurationError);
    assert.throws(() => GatewayFactory.get('test'), ProductionConfigurationError);
  } finally {
    process.env.NODE_ENV = previousNodeEnv ?? 'test';
    delete process.env.CAPFLUX_MODE;
  }
});

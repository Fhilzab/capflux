/**
 * ProviderStatusService — CAPFLUX canonical provider readiness.
 *
 * Distinguishes between:
 *   PROVIDER_NOT_CONFIGURED       — missing credentials or disabled
 *   PROVIDER_SANDBOX              — test/sandbox credentials active
 *   PROVIDER_PRODUCTION_READY     — production credentials present, not yet active
 *   PROVIDER_PRODUCTION_ACTIVE    — production live
 *   PROVIDER_DISABLED             — explicitly disabled (emergency kill-switch)
 *
 * Capability verification tiers per operation:
 *   CODE_VERIFIED                 — method exists, contract tested, no API call
 *   SANDBOX_API_VERIFIED          — real sandbox API call succeeded
 *   PRODUCTION_API_UNVERIFIED     — production credentials absent / not attempted
 *   PRODUCTION_READY              — production credentials + explicit activation
 *   SANDBOX_CAPABILITY_UNAVAILABLE — sandbox API doesn't support this
 *
 * NEVER exposes secrets or credential values. Safe for frontend consumption.
 */
import { GatewayFactory } from './gateways/GatewayFactory.js';

const PROVIDER_MODES = ['disabled', 'sandbox', 'production'];
const PROVIDER_NAMES = ['monnify', 'paystack'];

class ProviderStatusService {
  /**
   * Determine the current payments mode from environment.
   * @returns {string} 'disabled' | 'sandbox' | 'production'
   */
  getPaymentsMode() {
    const mode = (process.env.PAYMENTS_PROVIDER_MODE || 'sandbox').toLowerCase();
    if (!PROVIDER_MODES.includes(mode)) {
      console.warn(`[provider] Unknown PAYMENTS_PROVIDER_MODE "${mode}" — falling back to "sandbox"`);
      return 'sandbox';
    }
    return mode;
  }

  /**
   * Validate that the payments mode is safe at startup.
   * Throws if production is misconfigured.
   */
  validateStartupMode() {
    const mode = this.getPaymentsMode();
    const isProduction = process.env.NODE_ENV === 'production';

    if (mode === 'production' && !isProduction) {
      console.warn('[provider] PAYMENTS_PROVIDER_MODE=production but NODE_ENV is not production — this is unsafe');
    }

    if (mode === 'production' && !process.env.PAYSTACK_SECRET_KEY && !process.env.MONNIFY_SECRET_KEY) {
      throw new Error('PAYMENTS_PROVIDER_MODE=production requires at least one provider production credential');
    }

    if (mode === 'sandbox') {
      console.log('[provider] Payments provider mode: sandbox');
    }

    return mode;
  }

  /**
   * Check if a specific provider has sandbox credentials configured.
   * @param {string} providerName
   * @returns {boolean}
   * @private
   */
  _hasCredentials(providerName) {
    const prefix = providerName.toUpperCase();
    const env = (process.env[`${prefix}_ENV`] || 'sandbox').toLowerCase();
    if (env === 'sandbox') {
      return !!(process.env[`${prefix}_SECRET_KEY`]);
    }
    return !!(process.env[`${prefix}_API_KEY`] && process.env[`${prefix}_SECRET_KEY`]);
  }

  /**
   * Determine the credential environment for a provider.
   * @param {string} providerName
   * @returns {string} 'sandbox' | 'production' | 'not_configured'
   * @private
   */
  _credentialEnv(providerName) {
    const prefix = providerName.toUpperCase();
    const hasProdKey = !!(process.env[`${prefix}_SECRET_KEY`] && (process.env[`${prefix}_ENV`] || '').toLowerCase() === 'production');
    const hasSandboxKey = !!(process.env[`${prefix}_SECRET_KEY`]);
    if (hasProdKey) return 'production';
    if (hasSandboxKey) return 'sandbox';
    return 'not_configured';
  }

  /**
   * Get the status for a single provider.
   * @param {string} providerName
   * @returns {Object} safe status payload (no secrets)
   */
  getProviderStatus(providerName) {
    const gateway = GatewayFactory.get(providerName);
    const configured = this._hasCredentials(providerName);
    const credentialEnv = this._credentialEnv(providerName);
    const paymentsMode = this.getPaymentsMode();

    let status;
    if (paymentsMode === 'disabled') {
      status = 'PROVIDER_DISABLED';
    } else if (!configured) {
      status = 'PROVIDER_NOT_CONFIGURED';
    } else if (credentialEnv === 'production') {
      status = paymentsMode === 'production' ? 'PROVIDER_PRODUCTION_ACTIVE' : 'PROVIDER_PRODUCTION_READY';
    } else {
      status = 'PROVIDER_SANDBOX';
    }

    // Capabilities always CODE_VERIFIED if gateway is registered;
    // individual methods may upgrade to SANDBOX_API_VERIFIED after real calls.
    const baseCapability = gateway ? 'CODE_VERIFIED' : 'PROVIDER_CAPABILITY_UNAVAILABLE';

    return {
      provider: providerName,
      environment: credentialEnv,
      configured,
      status,
      providerRegistered: !!gateway,
      capabilities: {
        dvaCreation: baseCapability,
        dvaLookup: baseCapability,
        dvaDeactivation: baseCapability,
        transactionVerification: baseCapability,
        webhookVerification: baseCapability,
        transactionListing: baseCapability,
        settlementVerification: baseCapability,
        settlementExecution: baseCapability,
      },
      productionReady: status === 'PROVIDER_PRODUCTION_ACTIVE',
    };
  }

  /**
   * Get status for all registered providers.
   * Safe for `/api/providers/status` — never exposes secrets.
   * @returns {Object}
   */
  getAllStatus() {
    const result = {
      paymentsMode: this.getPaymentsMode(),
      providers: {},
    };
    for (const name of PROVIDER_NAMES) {
      result.providers[name] = this.getProviderStatus(name);
    }
    return result;
  }
}

export { ProviderStatusService, PROVIDER_MODES, PROVIDER_NAMES };
export default new ProviderStatusService();

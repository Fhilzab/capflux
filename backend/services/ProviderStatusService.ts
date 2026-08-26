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

export const PROVIDER_MODES = ['disabled', 'sandbox', 'production'];
export const PROVIDER_NAMES = ['monnify', 'paystack', 'sandbox'];

export type PaymentsMode = 'disabled' | 'sandbox' | 'production';

export type ProviderState =
  | 'PROVIDER_DISABLED'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'PROVIDER_SANDBOX'
  | 'PROVIDER_PRODUCTION_READY'
  | 'PROVIDER_PRODUCTION_ACTIVE';

export type CapabilityTier =
  | 'CODE_VERIFIED'
  | 'SANDBOX_API_VERIFIED'
  | 'PRODUCTION_API_UNVERIFIED'
  | 'PRODUCTION_READY'
  | 'SANDBOX_CAPABILITY_UNAVAILABLE'
  | 'PROVIDER_CAPABILITY_UNAVAILABLE';

export interface ProviderCapabilityMatrix {
  dvaCreation: CapabilityTier;
  dvaLookup: CapabilityTier;
  dvaDeactivation: CapabilityTier;
  transactionVerification: CapabilityTier;
  webhookVerification: CapabilityTier;
  transactionListing: CapabilityTier;
  settlementVerification: CapabilityTier;
  settlementExecution: CapabilityTier;
}

export interface ProviderStatusPayload {
  provider: string;
  environment: 'sandbox' | 'production' | 'not_configured';
  configured: boolean;
  status: ProviderState;
  providerRegistered: boolean;
  capabilities: ProviderCapabilityMatrix;
  productionReady: boolean;
}

export interface AllProvidersStatus {
  paymentsMode: PaymentsMode;
  providers: Record<string, ProviderStatusPayload>;
}

class ProviderStatusService {
  /**
   * Determine the current payments mode from environment.
   */
  getPaymentsMode(): PaymentsMode {
    const mode = (process.env.PAYMENTS_PROVIDER_MODE || 'sandbox').toLowerCase();
    if (!PROVIDER_MODES.includes(mode)) {
      console.warn(`[provider] Unknown PAYMENTS_PROVIDER_MODE "${mode}" — falling back to "sandbox"`);
      return 'sandbox';
    }
    return mode as PaymentsMode;
  }

  /**
   * Validate that the payments mode is safe at startup.
   * Throws if production is misconfigured.
   */
  validateStartupMode(): PaymentsMode {
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
   */
  _hasCredentials(providerName: string): boolean {
    const prefix = providerName.toUpperCase();
    const env = (process.env[`${prefix}_ENV`] || 'sandbox').toLowerCase();
    if (env === 'sandbox') {
      return !!(process.env[`${prefix}_SECRET_KEY`]);
    }
    return !!(process.env[`${prefix}_API_KEY`] && process.env[`${prefix}_SECRET_KEY`]);
  }

  /**
   * Determine the credential environment for a provider.
   */
  _credentialEnv(providerName: string): 'sandbox' | 'production' | 'not_configured' {
    const prefix = providerName.toUpperCase();
    const hasProdKey = !!(process.env[`${prefix}_SECRET_KEY`] && (process.env[`${prefix}_ENV`] || '').toLowerCase() === 'production');
    const hasSandboxKey = !!(process.env[`${prefix}_SECRET_KEY`]);
    if (hasProdKey) return 'production';
    if (hasSandboxKey) return 'sandbox';
    return 'not_configured';
  }

  /**
   * Get the status for a single provider.
   * Safe status payload (no secrets).
   */
  getProviderStatus(providerName: string): ProviderStatusPayload {
    const gateway = GatewayFactory.get(providerName);
    const configured = this._hasCredentials(providerName);
    const credentialEnv = this._credentialEnv(providerName);
    const paymentsMode = this.getPaymentsMode();

    let status: ProviderState;
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
    const baseCapability: CapabilityTier = gateway ? 'CODE_VERIFIED' : 'PROVIDER_CAPABILITY_UNAVAILABLE';

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
   */
  getAllStatus(): AllProvidersStatus {
    const result: AllProvidersStatus = {
      paymentsMode: this.getPaymentsMode(),
      providers: {},
    };
    for (const name of PROVIDER_NAMES) {
      result.providers[name] = this.getProviderStatus(name);
    }
    return result;
  }
}

export { ProviderStatusService };
export default new ProviderStatusService();

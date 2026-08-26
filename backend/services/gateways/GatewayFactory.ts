/**
 * GatewayFactory - Factory for creating payment gateway instances
 *
 * This factory pattern allows adding new payment providers (Paystack, Flutterwave,
 * Remita) without modifying the billing engine or webhook handler.
 */

import { MonnifyGateway } from './MonnifyGateway.js';
import { PaystackGateway } from './PaystackGateway.js';
import { TestGateway } from './TestGateway.js';
import { SandboxGateway } from './SandboxGateway.js';
import { errorMessage } from '../../types/http.js';
import {
  getCapfluxMode,
  SandboxConfigurationError,
  ProductionConfigurationError,
  LIVE_PAYMENT_PROVIDERS,
} from '../RuntimeConfiguration.js';

/** Any adapter resolvable through the factory (structural union). */
export type PaymentGateway = MonnifyGateway | PaystackGateway | TestGateway | SandboxGateway;

// Provider registry
const _providers = new Map<string, PaymentGateway>(); // lazy-init — call get() to resolve.
const _registry = new Map<string, { factory: () => PaymentGateway }>([
  ['monnify', { factory: () => new MonnifyGateway() }],
  ['paystack', { factory: () => new PaystackGateway() }],
  ['test', { factory: () => { if (process.env.NODE_ENV === 'production') throw new Error('TestGateway is not available in production.'); return new TestGateway(); } }],
  ['sandbox', { factory: () => { if (process.env.NODE_ENV === 'production') throw new Error('SandboxGateway is not available in production.'); return new SandboxGateway(); } }],
]);

/**
 * Mode isolation guard — THROWS (loudly, no silent fallback):
 *  - a sandbox process can never initialize a live payment provider;
 *  - a deployed production process can never initialize test/sandbox adapters.
 * Called BEFORE the lenient try/catch so configuration errors are never
 * swallowed into `null`.
 */
function assertProviderAllowedForMode(name: string): void {
  const mode = getCapfluxMode();
  if (
    mode === 'sandbox' &&
    (LIVE_PAYMENT_PROVIDERS as readonly string[]).includes(name.toLowerCase())
  ) {
    throw new SandboxConfigurationError(
      `Attempt to initialize live payment provider "${name}" while CAPFLUX_MODE=sandbox. ` +
        'Sandbox payments must terminate at the deterministic SandboxGateway.',
    );
  }
  if (process.env.NODE_ENV === 'production' && (name === 'test' || name === 'sandbox')) {
    throw new ProductionConfigurationError(
      `Attempt to initialize the "${name}" adapter in a deployed production process.`,
    );
  }
}

function _getOrInit(name: string): PaymentGateway | null {
  assertProviderAllowedForMode(name);
  if (!_providers.has(name)) {
    const entry = _registry.get(name);
    if (!entry) return null;
    try {
      _providers.set(name, entry.factory());
    } catch (err) {
      console.warn(`[GatewayFactory] cannot initialize ${name}: ${errorMessage(err)}`);
      return null;
    }
  }
  return _providers.get(name) ?? null;
}

export class GatewayFactory {
  /**
   * Register a new payment gateway provider.
   *
   * Migration fix (approved): the original JavaScript referenced an
   * undeclared `providers` variable here, so any call threw
   * "ReferenceError: providers is not defined". No caller existed; the
   * obvious intent (register into the lazy provider cache) is preserved.
   */
  static register(provider: string, gateway: PaymentGateway): void {
    _providers.set(provider, gateway);
  }

  /**
   * Get a gateway instance by provider name.
   */
  static get(provider: string): PaymentGateway | null {
    return _getOrInit(provider);
  }

  /**
   * Get all registered providers.
   */
  static getAllProviders(): string[] {
    return Array.from(_registry.keys());
  }

  /**
   * Create a gateway instance based on school configuration.
   */
  static async createForSchool(providerName: string, _config?: unknown): Promise<PaymentGateway | null> {
    const gateway = this.get(providerName);
    if (!gateway) {
      console.warn(`Unknown payment provider: ${providerName}`);
      return null;
    }
    return gateway;
  }
}

// Export convenience functions
export const getGateway = (provider: string): PaymentGateway | null => GatewayFactory.get(provider);
export const registerGateway = (provider: string, gateway: PaymentGateway): void => GatewayFactory.register(provider, gateway);

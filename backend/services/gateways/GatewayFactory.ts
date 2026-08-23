/**
 * GatewayFactory - Factory for creating payment gateway instances
 *
 * This factory pattern allows adding new payment providers (Paystack, Flutterwave,
 * Remita) without modifying the billing engine or webhook handler.
 */

import { MonnifyGateway } from './MonnifyGateway.js';
import { PaystackGateway } from './PaystackGateway.js';
import { TestGateway } from './TestGateway.js';
import { errorMessage } from '../../types/http.js';

/** Any adapter resolvable through the factory (structural union). */
export type PaymentGateway = MonnifyGateway | PaystackGateway | TestGateway;

// Provider registry
const _providers = new Map<string, PaymentGateway>(); // lazy-init — call get() to resolve.
const _registry = new Map<string, { factory: () => PaymentGateway }>([
  ['monnify', { factory: () => new MonnifyGateway() }],
  ['paystack', { factory: () => new PaystackGateway() }],
  ['test', { factory: () => { if (process.env.NODE_ENV === 'production') throw new Error('TestGateway is not available in production.'); return new TestGateway(); } }],
]);

function _getOrInit(name: string): PaymentGateway | null {
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

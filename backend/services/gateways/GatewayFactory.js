/**
 * GatewayFactory - Factory for creating payment gateway instances
 * 
 * This factory pattern allows adding new payment providers (Paystack, Flutterwave,
 * Remita) without modifying the billing engine or webhook handler.
 */

import { MonnifyGateway } from './MonnifyGateway.js';
import { PaystackGateway } from './PaystackGateway.js';
import { TestGateway } from './TestGateway.js';

// Provider registry
const _providers = new Map(); // lazy-init — call providerFor() to resolve.
const _registry = new Map([
  ['monnify', { factory: () => new MonnifyGateway() }],
  ['paystack', { factory: () => new PaystackGateway() }],
  ['test', { factory: () => { if (process.env.NODE_ENV === 'production') throw new Error('TestGateway is not available in production.'); return new TestGateway(); } }],
]);

function _getOrInit(name) {
  if (!_providers.has(name)) {
    const entry = _registry.get(name);
    if (!entry) return null;
    try {
      _providers.set(name, entry.factory());
    } catch (err) {
      console.warn(`[GatewayFactory] cannot initialize ${name}: ${err.message}`);
      return null;
    }
  }
  return _providers.get(name);
}

// Future providers:
// providers.set('flutterwave', new FlutterwaveGateway());
// providers.set('remita', new RemitaGateway());

export class GatewayFactory {
  /**
   * Register a new payment gateway provider
   */
  static register(provider, gateway) {
    providers.set(provider, gateway);
  }

  /**
   * Get a gateway instance by provider name
   */
  static get(provider) {
    return _getOrInit(provider);
  }

  /**
   * Get all registered providers
   */
  static getAllProviders() {
    return Array.from(_registry.keys());
  }

  /**
   * Create a gateway instance based on school configuration
   */
  static async createForSchool(providerName, config) {
    const gateway = this.get(providerName);
    if (!gateway) {
      console.warn(`Unknown payment provider: ${providerName}`);
      return null;
    }
    return gateway;
  }
}

// Export convenience functions
export const getGateway = (provider) => GatewayFactory.get(provider);
export const registerGateway = (provider, gateway) => GatewayFactory.register(provider, gateway);

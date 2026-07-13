/**
 * GatewayFactory - Factory for creating payment gateway instances
 * 
 * This factory pattern allows adding new payment providers (Flutterwave, Remita)
 * without modifying the billing engine or webhook handler.
 */

import { MonnifyGateway } from './MonnifyGateway.js';

// Provider registry
const providers = new Map();

// Register default providers
providers.set('monnify', new MonnifyGateway());

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
    return providers.get(provider) || null;
  }

  /**
   * Get all registered providers
   */
  static getAllProviders() {
    return Array.from(providers.keys());
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

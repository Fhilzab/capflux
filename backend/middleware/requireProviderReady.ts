/**
 * requireProviderReady — middleware that blocks payment operations when the
 * provider environment is not configured for live processing.
 *
 * Routes that create or mutate payment accounts, process payments, or settle
 * funds should use this middleware after requireAuth.
 *
 * In sandbox mode: operations are allowed (with sandbox provider).
 * In production mode: operations are allowed (with production provider).
 * In disabled mode: all payment operations are blocked.
 *
 * This middleware never exposes provider configuration details to the client.
 */
import type { NextFunction, Request, Response } from 'express';

interface RequireProviderReadyOptions {
  provider?: string;
}

class RequireProviderReady {
  disabledMessage = 'Payment processing is not available at this time.';
  notConfiguredMessage = 'Payment processing is not yet configured.';

  /**
   * Express middleware factory.
   */
  middleware(opts: RequireProviderReadyOptions = {}): (req: Request, res: Response, next: NextFunction) => void | Response {
    const { provider } = opts;

    return (req, res, next) => {
      const mode = (process.env.PAYMENTS_PROVIDER_MODE || 'sandbox').toLowerCase();

      // Disabled: block everything.
      if (mode === 'disabled') {
        return res.status(503).json({ error: this.disabledMessage });
      }

      // Production mode: enforce production-safe guards.
      if (mode === 'production') {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[requireProviderReady] PAYMENTS_PROVIDER_MODE=production but NODE_ENV is not production — blocking for safety');
          return res.status(503).json({ error: this.disabledMessage });
        }

        // Check that the required provider has production credentials.
        if (provider) {
          const prefix = provider.toUpperCase();
          const hasProductionCreds = process.env[`${prefix}_ENV`] === 'production' && process.env[`${prefix}_SECRET_KEY`];
          if (!hasProductionCreds) {
            console.warn(`[requireProviderReady] provider ${provider} production credentials missing`);
            return res.status(503).json({ error: this.notConfiguredMessage });
          }
        }
      }

      // Sandbox or production (valid): proceed.
      return next();
    };
  }

  /**
   * Check if mock/test gateways are allowed.
   * Only permitted when NODE_ENV !== 'production'.
   */
  static mockGatewayAllowed(): boolean {
    return process.env.NODE_ENV !== 'production';
  }
}

export { RequireProviderReady };
export default new RequireProviderReady();

/**
 * Provider Status Routes — safe configuration/capability info.
 *
 * GET /api/providers/status — all providers (no secrets)
 * GET /api/providers/:provider/status — single provider
 *
 * NEVER returns secrets, credential values, or raw provider configuration.
 */
import { Router, Request, Response } from 'express';
import ProviderStatusService from '../services/ProviderStatusService.js';
import { describeRuntimeMode } from '../services/RuntimeConfiguration.js';

const router = Router();

// GET /api/providers/runtime-info — non-secret runtime mode descriptor.
// Lets a production frontend detect CAPFLUX_ENVIRONMENT_MISMATCH against a
// mis-pointed sandbox backend (and vice versa). Returns NO secrets.
router.get('/runtime-info', (_req: Request, res: Response) => {
  try {
    const paymentsMode = (
      ProviderStatusService as unknown as { getPaymentsMode?: () => string }
    ).getPaymentsMode?.() ?? 'unknown';
    return res.json({
      success: true,
      data: { ...describeRuntimeMode(), paymentsMode },
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Failed to retrieve runtime info' });
  }
});

// GET /api/providers/status
router.get('/status', (_req: Request, res: Response) => {
  try {
    const status = ProviderStatusService.getAllStatus();
    return res.json({ success: true, data: status });
  } catch (_error) {
    return res.status(500).json({ error: 'Failed to retrieve provider status' });
  }
});

// GET /api/providers/:provider/status
router.get('/:provider/status', (req: Request, res: Response) => {
  const { provider } = req.params;
  const validProviders = ['monnify', 'paystack', 'sandbox'];
  if (!provider || !validProviders.includes(provider)) {
    return res.status(404).json({ error: `Unknown provider: ${provider}` });
  }

  try {
    const status = ProviderStatusService.getProviderStatus(provider as string);
    return res.json({ success: true, data: status });
  } catch (_error) {
    return res.status(500).json({ error: 'Failed to retrieve provider status' });
  }
});

export default router;

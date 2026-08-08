/**
 * Provider Status Routes — safe configuration/capability info.
 *
 * GET /api/providers/status — all providers (no secrets)
 * GET /api/providers/:provider/status — single provider
 *
 * NEVER returns secrets, credential values, or raw provider configuration.
 */
import express from 'express';
import ProviderStatusService from '../services/ProviderStatusService.js';

const router = express.Router();

// GET /api/providers/status
router.get('/status', (req, res) => {
  try {
    const status = ProviderStatusService.getAllStatus();
    return res.json({ success: true, data: status });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to retrieve provider status' });
  }
});

// GET /api/providers/:provider/status
router.get('/:provider/status', (req, res) => {
  const { provider } = req.params;
  const validProviders = ['monnify', 'paystack'];
  if (!validProviders.includes(provider)) {
    return res.status(404).json({ error: `Unknown provider: ${provider}` });
  }

  try {
    const status = ProviderStatusService.getProviderStatus(provider);
    return res.json({ success: true, data: status });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to retrieve provider status' });
  }
});

export default router;

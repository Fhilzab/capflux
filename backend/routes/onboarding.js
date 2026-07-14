const express = require('express');

const router = express.Router();

// Bank account verification (uses provider APIs internally - never exposed)
// In production, this would call Monnify/Flutterwave/Paystack bank verification
router.post('/verify-account', async (req, res) => {
  const { bank, accountNumber } = req.body;

  if (!bank || !accountNumber) {
    return res.status(400).json({ error: 'Bank and account number required' });
  }

  // Mock verification - in production, call provider API
  // This endpoint abstracts the payment provider choice from the frontend
  const mockAccounts = {
    '0123456789': 'Ade Johnson Educational Services',
    '0987654321': 'Capstone International School',
  };

  // Simulate verification delay
  await new Promise(resolve => setTimeout(resolve, 500));

  if (accountNumber.length >= 10) {
    return res.json({
      verified: true,
      accountName: mockAccounts[accountNumber] || 'Verified Account Name',
    });
  }

  return res.json({ verified: false, error: 'Account not found' });
});

// Get onboarding state for a school
router.get('/schools/:schoolId/state', async (req, res) => {
  const { schoolId } = req.params;

  // In production, query the onboarding_progress table
  // This is intentional abstraction - frontend doesn't know about providers
  res.json({
    schoolId,
    stage: 1,
    completedSteps: [],
    businessVerified: false,
    settlementVerified: false,
    paymentServiceReady: true, // Always true - managed internally
  });
});

module.exports = router;
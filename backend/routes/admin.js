const express = require('express');
const { AuthorizationService } = require('../services/AuthorizationService');

const router = express.Router();
const authz = new AuthorizationService();

// Middleware: Ensure user is authenticated
const requireAuth = async (req, res, next) => {
  const userId = req.headers['x-user-id'];
  const schoolId = req.headers['x-school-id'];
  
  if (!userId || !schoolId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  req.userId = userId;
  req.schoolId = schoolId;
  next();
};

// Middleware: Ensure user is owner
const requireOwner = async (req, res, next) => {
  try {
    await authz.verifyOwner(req.userId, req.schoolId);
    next();
  } catch (error) {
    return res.status(403).json({ error: error.message });
  }
};

// Get all admins for a school (Owner only)
router.get('/schools/:schoolId/admins', requireAuth, requireOwner, async (req, res) => {
  try {
    const admins = await authz.getAdmins(req.params.schoolId);
    res.json({ admins });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get owner for a school (Owner or Admin)
router.get('/schools/:schoolId/owner', requireAuth, async (req, res) => {
  try {
    await authz.isAdminOrOwner(req.userId, req.params.schoolId);
    const owner = await authz.getOwner(req.params.schoolId);
    res.json({ owner });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Invite admin (Owner only)
router.post('/schools/:schoolId/admins/invite', requireAuth, requireOwner, async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  
  try {
    const result = await authz.inviteAdmin(req.params.schoolId, email, req.userId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Suspend admin (Owner only)
router.post('/schools/:schoolId/admins/:adminId/suspend', requireAuth, requireOwner, async (req, res) => {
  try {
    await authz.suspendAdmin(req.params.schoolId, req.params.adminId, req.userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reactivate admin (Owner only)
router.post('/schools/:schoolId/admins/:adminId/reactivate', requireAuth, requireOwner, async (req, res) => {
  try {
    await authz.reactivateAdmin(req.params.schoolId, req.params.adminId, req.userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove admin (Owner only)
router.delete('/schools/:schoolId/admins/:adminId', requireAuth, requireOwner, async (req, res) => {
  try {
    await authz.removeAdmin(req.params.schoolId, req.params.adminId, req.userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Transfer ownership (Owner only)
router.post('/schools/:schoolId/transfer-ownership', requireAuth, requireOwner, async (req, res) => {
  const { newOwnerId } = req.body;
  
  if (!newOwnerId) {
    return res.status(400).json({ error: 'New owner ID is required' });
  }
  
  try {
    await authz.transferOwnership(req.params.schoolId, req.userId, newOwnerId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
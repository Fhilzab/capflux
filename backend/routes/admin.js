import express from 'express';
import requireAuth from '../middleware/requireAuth.js';
import { supabase } from '../supabaseClient.js';

const router = express.Router();
// Admin management routes (Owner/Admin authorization)
router.use(requireAuth);

/**
 * Resolve the caller's school membership from the authenticated session.
 * School scope is derived from membership — never from client headers.
 */
async function getCallerSchool(userId) {
  const { data, error } = await supabase
    .from('school_members')
    .select('school_id, role_id, roles!inner(system_role)')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (error || !data) return null;
  return {
    schoolId: data.school_id,
    role: data.roles?.system_role || null,
  };
}

// Middleware: Ensure the caller is an OWNER of the target school.
const requireOwner = async (req, res, next) => {
  try {
    const caller = await getCallerSchool(req.user.id);
    if (!caller) {
      return res.status(403).json({ error: 'No active school membership.' });
    }
    const schoolId = req.params.schoolId || caller.schoolId;

    // Caller must belong to the target school as OWNER.
    if (caller.schoolId !== schoolId || caller.role !== 'OWNER') {
      return res.status(403).json({ error: 'Only the school owner can perform this action.' });
    }
    req.schoolId = schoolId;
    next();
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Middleware: Ensure the caller is OWNER or ADMIN of the target school.
const requireAdminOrOwner = async (req, res, next) => {
  try {
    const caller = await getCallerSchool(req.user.id);
    if (!caller) {
      return res.status(403).json({ error: 'No active school membership.' });
    }
    const schoolId = req.params.schoolId || caller.schoolId;
    if (caller.schoolId !== schoolId) {
      return res.status(403).json({ error: 'Not a member of this school.' });
    }
    if (caller.role !== 'OWNER' && caller.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Owner or admin access required.' });
    }
    req.schoolId = schoolId;
    next();
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Get all admins for a school (Owner only)
router.get('/schools/:schoolId/admins', requireOwner, async (req, res) => {
  try {
    const { data: members, error } = await supabase
      .from('school_members')
      .select('id, user_id, school_id, role_id, joined_at, is_active, users!inner(email)')
      .eq('school_id', req.params.schoolId)
      .eq('is_active', true);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ admins: members });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get owner for a school (Owner or Admin)
router.get('/schools/:schoolId/owner', requireAdminOrOwner, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('school_members')
      .select('user_id, joined_at, users!inner(email)')
      .eq('school_id', req.params.schoolId)
      .eq('roles.system_role', 'OWNER')
      .eq('is_active', true)
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ owner: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Invite admin (Owner only)
router.post('/schools/:schoolId/admins/invite', requireOwner, async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // Look up the target user by email; then assign an ADMIN school membership.
    const { data: targetUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (userError || !targetUser) {
      return res.status(404).json({ error: 'No CAPFLUX user with that email. They must sign up first.' });
    }

    const { data: adminRole, error: roleError } = await supabase
      .from('roles')
      .select('id')
      .eq('system_role', 'ADMIN')
      .eq('is_system_role', true)
      .single();

    if (roleError || !adminRole) {
      return res.status(500).json({ error: 'ADMIN system role not found.' });
    }

    const { data, error } = await supabase
      .from('school_members')
      .insert({
        user_id: targetUser.id,
        school_id: req.params.schoolId,
        role_id: adminRole.id,
        invited_by: req.user.id,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'User is already a member of this school.' });
      }
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Suspend admin (Owner only)
router.post('/schools/:schoolId/admins/:adminId/suspend', requireOwner, async (req, res) => {
  try {
    const { error } = await supabase
      .from('school_members')
      .update({ is_active: false, left_at: new Date().toISOString() })
      .eq('id', req.params.adminId)
      .eq('school_id', req.params.schoolId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reactivate admin (Owner only)
router.post('/schools/:schoolId/admins/:adminId/reactivate', requireOwner, async (req, res) => {
  try {
    const { error } = await supabase
      .from('school_members')
      .update({ is_active: true, left_at: null })
      .eq('id', req.params.adminId)
      .eq('school_id', req.params.schoolId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove admin (Owner only)
router.delete('/schools/:schoolId/admins/:adminId', requireOwner, async (req, res) => {
  try {
    const { error } = await supabase
      .from('school_members')
      .update({ is_active: false, left_at: new Date().toISOString() })
      .eq('id', req.params.adminId)
      .eq('school_id', req.params.schoolId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Transfer ownership (Owner only)
router.post('/schools/:schoolId/transfer-ownership', requireOwner, async (req, res) => {
  const { newOwnerId } = req.body;
  if (!newOwnerId) {
    return res.status(400).json({ error: 'New owner ID is required' });
  }

  try {
    // Verify the new owner is an active ADMIN member of the school.
    const { data: targetMember, error: targetError } = await supabase
      .from('school_members')
      .select('id, roles!inner(system_role)')
      .eq('user_id', newOwnerId)
      .eq('school_id', req.params.schoolId)
      .eq('is_active', true)
      .single();

    if (targetError || !targetMember) {
      return res.status(404).json({ error: 'Target user is not an active member of this school.' });
    }
    if (targetMember.roles?.system_role !== 'ADMIN') {
      return res.status(400).json({ error: 'New owner must be an ADMIN.' });
    }

    const { data: ownerRole, error: roleError } = await supabase
      .from('roles')
      .select('id')
      .eq('system_role', 'OWNER')
      .eq('is_system_role', true)
      .single();
    const { data: adminRole, error: adminRoleError } = await supabase
      .from('roles')
      .select('id')
      .eq('system_role', 'ADMIN')
      .eq('is_system_role', true)
      .single();
    if (roleError || adminRoleError || !ownerRole || !adminRole) {
      return res.status(500).json({ error: 'System roles not found.' });
    }

    // Demote current owner to ADMIN, promote new owner to OWNER.
    const { data: callerMember } = await supabase
      .from('school_members')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('school_id', req.params.schoolId)
      .eq('is_active', true)
      .single();

    if (callerMember) {
      await supabase.from('school_members').update({ role_id: adminRole.id }).eq('id', callerMember.id);
    }
    await supabase.from('school_members').update({ role_id: ownerRole.id }).eq('id', targetMember.id);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

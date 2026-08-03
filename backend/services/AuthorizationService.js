const { createClient } = require('@supabase/supabase-js');

class AuthorizationService {
  constructor(supabaseClient = null) {
    this.supabase = supabaseClient || createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  // Get user role and profile
  async getProfile(userId) {
    if (!this.supabase) {
      // Fallback for local development
      return { 
        role: 'OWNER', 
        admin_status: 'ACTIVE',
        school_id: 'demo-school',
        id: userId
      };
    }

    const { data, error } = await this.supabase
      .from('profiles')
      .select('id, school_id, role, admin_status, email, full_name')
      .eq('id', userId)
      .single();

    if (error) {
      throw new Error('Failed to fetch profile: ' + error.message);
    }

    return data;
  }

  // Check if user has specified role
  async checkRole(userId, schoolId, allowedRoles) {
    const profile = await this.getProfile(userId);
    
    if (profile.school_id !== schoolId) {
      return false;
    }

    if (profile.admin_status !== 'ACTIVE') {
      return false;
    }

    return allowedRoles.includes(profile.role);
  }

  // Check if user is owner
  async isOwner(userId, schoolId) {
    return this.checkRole(userId, schoolId, ['OWNER']);
  }

  // Check if user is admin
  async isAdminOrOwner(userId, schoolId) {
    return this.checkRole(userId, schoolId, ['OWNER', 'ADMIN']);
  }

  // Invite admin to school
  async inviteAdmin(schoolId, email, invitedBy) {
    // Verify inviter has permission to manage school
    await this.assertPermission(invitedBy, schoolId, 'school.manage');

    // Check if email already exists in this school
    const { data: existingUser } = await this.supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .eq('school_id', schoolId)
      .single();

    if (existingUser) {
      throw new Error('User with this email already exists in this school');
    }

    // Send invitation via Supabase
    const { data, error } = await this.supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.APP_URL}/login?invited=true`,
      data: {
        school_id: schoolId,
        role: 'ADMIN',
        invited_by: invitedBy
      }
    });

    if (error) {
      throw new Error('Failed to send invitation: ' + error.message);
    }

    // Log audit event
    await this.logAudit(schoolId, invitedBy, 'ADMIN_INVITED', 'profile', data.user.id, { email });

    return data;
  }

  // Suspend admin
  async suspendAdmin(schoolId, adminId, performedBy) {
    await this.assertPermission(performedBy, schoolId, 'school.manage');

    // Cannot suspend yourself
    if (performedBy === adminId) {
      throw new Error('Cannot suspend yourself');
    }

    const { error } = await this.supabase.rpc('suspend_admin', {
      p_school_id: schoolId,
      p_admin_id: adminId
    });

    if (error) {
      throw new Error('Failed to suspend admin: ' + error.message);
    }

    // Log audit event
    await this.logAudit(schoolId, performedBy, 'ADMIN_SUSPENDED', 'profile', adminId);
  }

  // Reactivate admin
  async reactivateAdmin(schoolId, adminId, performedBy) {
    await this.assertPermission(performedBy, schoolId, 'school.manage');

    const { error } = await this.supabase.rpc('reactivate_admin', {
      p_school_id: schoolId,
      p_admin_id: adminId
    });

    if (error) {
      throw new Error('Failed to reactivate admin: ' + error.message);
    }

    // Log audit event
    await this.logAudit(schoolId, performedBy, 'ADMIN_REACTIVATED', 'profile', adminId);
  }

  // Remove admin
  async removeAdmin(schoolId, adminId, performedBy) {
    await this.assertPermission(performedBy, schoolId, 'school.manage');

    // Cannot remove yourself
    if (performedBy === adminId) {
      throw new Error('Cannot remove yourself');
    }

    const { error } = await this.supabase.rpc('remove_admin', {
      p_school_id: schoolId,
      p_admin_id: adminId
    });

    if (error) {
      throw new Error('Failed to remove admin: ' + error.message);
    }

    // Log audit event
    await this.logAudit(schoolId, performedBy, 'ADMIN_DELETED', 'profile', adminId);
  }

  // Transfer ownership
  async transferOwnership(schoolId, currentOwnerId, newOwnerId) {
    // Verify current owner has permission
    await this.assertPermission(currentOwnerId, schoolId, 'school.manage');

    // Verify new owner is an active admin
    const newOwnerProfile = await this.getProfile(newOwnerId);
    if (newOwnerProfile.role !== 'ADMIN' || newOwnerProfile.admin_status !== 'ACTIVE') {
      throw new Error('New owner must be an active admin');
    }

    // Perform transfer
    const { error } = await this.supabase.rpc('transfer_ownership', {
      p_school_id: schoolId,
      p_current_owner_id: currentOwnerId,
      p_new_owner_id: newOwnerId
    });

    if (error) {
      throw new Error('Failed to transfer ownership: ' + error.message);
    }

    return { success: true };
  }

  // Get all admins for a school
  async getAdmins(schoolId) {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('id, email, full_name, admin_status, created_at, updated_at')
      .eq('school_id', schoolId)
      .eq('role', 'ADMIN')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error('Failed to fetch admins: ' + error.message);
    }

    return data || [];
  }

  // Get owner for a school
  async getOwner(schoolId) {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('school_id', schoolId)
      .eq('role', 'OWNER')
      .single();

    if (error && error.code !== 'PGRST116') { // No rows found
      throw new Error('Failed to fetch owner: ' + error.message);
    }

    return data;
  }

  // Verify user is owner
  async verifyOwner(userId, schoolId) {
    const profile = await this.getProfile(userId);
    if (profile.role !== 'OWNER' || profile.school_id !== schoolId) {
      throw new Error('Unauthorized: Only owners can perform this action');
    }
  }

  // Check permission code at backend level (uses roles/permissions tables)
  async checkPermission(userId, schoolId, permissionCode) {
    // Owners and Admins are resolved via role in profile for now
    const profile = await this.getProfile(userId);
    if (!profile) return false;

    // Platform-level SUPER_ADMIN bypass (from profiles.system_role if present)
    if (profile.system_role === 'SUPER_ADMIN') return true;

    // If schoolId mismatch, deny
    if (profile.school_id !== schoolId) return false;

    // Query role_permissions join
    const { data, error } = await this.supabase
      .from('profiles')
      .select(`
        role:roles!inner (
          role_permissions!inner (
            permissions!inner (code)
          )
        )
      `)
      .eq('id', userId)
      .single();

    if (error) {
      console.warn('permission check failed', error.message);
      return false;
    }

    const codes = new Set<string>();
    const role = data?.role;
    role?.role_permissions?.forEach((rp) => codes.add(rp.permissions.code));
    return codes.has(permissionCode);
  }

  async assertPermission(userId, schoolId, permissionCode) {
    const allowed = await this.checkPermission(userId, schoolId, permissionCode);
    if (!allowed) throw new Error('INSUFFICIENT_PERMISSIONS');
  }

  // Log audit event
  async logAudit(schoolId, actorId, action, entity, entityId, metadata = {}) {
    const { error } = await this.supabase
      .from('audit_logs')
      .insert({
        school_id: schoolId,
        actor_id: actorId,
        action,
        entity,
        entity_id: entityId,
        metadata
      });

    if (error) {
      console.warn('Failed to log audit event:', error.message);
    }
  }
}

module.exports = { AuthorizationService };
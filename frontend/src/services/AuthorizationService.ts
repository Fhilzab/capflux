import { supabase, hasSupabaseConfig } from './api/supabase';

export interface Profile {
  id: string;
  email: string;
  full_name?: string;
  role: 'OWNER' | 'ADMIN';
  admin_status: 'ACTIVE' | 'SUSPENDED';
  school_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface AdminUser {
  id: string;
  email: string;
  full_name?: string;
  admin_status: 'ACTIVE' | 'SUSPENDED';
  created_at?: string;
  updated_at?: string;
}

export class AuthorizationService {
  // Get current user's profile with role
  async getProfile(): Promise<Profile | null> {
    if (!hasSupabaseConfig) {
      // Local dev fallback
      return {
        id: 'local-user',
        email: 'admin@capstone.local',
        role: 'OWNER',
        admin_status: 'ACTIVE',
        school_id: 'demo-school',
      };
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const response = await (supabase
      .from('profiles') as any)
      .select('id, email, full_name, role, admin_status, school_id, created_at, updated_at')
      .eq('id', user.id)
      .single();

    if (response.error) {
      console.error('Failed to fetch profile:', response.error);
      return null;
    }

    return response.data;
  }

  // Check if user has specific role
  async checkRole(userId: string, schoolId: string, allowedRoles: string[]): Promise<boolean> {
    if (!hasSupabaseConfig) {
      return true; // Allow all in local dev
    }

    const response = await (supabase
      .from('profiles') as any)
      .select('role, admin_status')
      .eq('id', userId)
      .eq('school_id', schoolId)
      .single();

    if (response.error || !response.data) return false;

    return response.data.admin_status === 'ACTIVE' && allowedRoles.includes(response.data.role);
  }

  // Check if user is owner
  async isOwner(userId: string, schoolId: string): Promise<boolean> {
    return this.checkRole(userId, schoolId, ['OWNER']);
  }

  // Check if user is admin or owner
  async isAdminOrOwner(userId: string, schoolId: string): Promise<boolean> {
    return this.checkRole(userId, schoolId, ['OWNER', 'ADMIN']);
  }

  // Get all admins for a school (Owner only)
  async getAdmins(schoolId: string): Promise<AdminUser[]> {
    if (!hasSupabaseConfig) {
      // Mock data for local dev
      return [
        { id: 'admin-1', email: 'bursar@capstone.local', admin_status: 'ACTIVE' },
        { id: 'admin-2', email: 'accountant@capstone.local', admin_status: 'SUSPENDED' },
      ];
    }

    const response = await (supabase
      .from('profiles') as any)
      .select('id, email, full_name, admin_status, created_at, updated_at')
      .eq('school_id', schoolId)
      .eq('role', 'ADMIN')
      .order('created_at', { ascending: false });

    if (response.error) {
      throw new Error('Failed to fetch admins: ' + response.error.message);
    }

    return response.data || [];
  }

  // Invite admin (Owner only)
  async inviteAdmin(schoolId: string, email: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    const response = await fetch('/api/admin/schools/' + schoolId + '/admins/invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': user?.id || '',
        'x-school-id': schoolId,
      },
      body: JSON.stringify({ email }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to invite admin');
    }
  }

  // Suspend admin (Owner only)
  async suspendAdmin(schoolId: string, adminId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    const response = await fetch('/api/admin/schools/' + schoolId + '/admins/' + adminId + '/suspend', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': user?.id || '',
        'x-school-id': schoolId,
      },
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to suspend admin');
    }
  }

  // Reactivate admin (Owner only)
  async reactivateAdmin(schoolId: string, adminId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    const response = await fetch('/api/admin/schools/' + schoolId + '/admins/' + adminId + '/reactivate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': user?.id || '',
        'x-school-id': schoolId,
      },
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to reactivate admin');
    }
  }

  // Remove admin (Owner only)
  async removeAdmin(schoolId: string, adminId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    const response = await fetch('/api/admin/schools/' + schoolId + '/admins/' + adminId, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': user?.id || '',
        'x-school-id': schoolId,
      },
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to remove admin');
    }
  }

  // Transfer ownership (Owner only)
  async transferOwnership(schoolId: string, newOwnerId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    const response = await fetch('/api/admin/schools/' + schoolId + '/transfer-ownership', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': user?.id || '',
        'x-school-id': schoolId,
      },
      body: JSON.stringify({ newOwnerId }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to transfer ownership');
    }
  }
}
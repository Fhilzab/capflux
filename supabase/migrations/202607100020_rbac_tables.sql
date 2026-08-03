-- RBAC Tables for CAPFLUX
-- This migration creates the authorization foundation for the platform

-- ========================================
-- ROLES
-- ========================================
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    system_role TEXT, -- SUPER_ADMIN, OWNER, ADMIN, BURSAR, PARENT
    is_system_role BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.roles IS 'Platform and organization roles';
COMMENT ON COLUMN public.roles.system_role IS 'One of: SUPER_ADMIN, OWNER, ADMIN, BURSAR, PARENT';
COMMENT ON COLUMN public.roles.is_system_role IS 'True for platform-defined roles that cannot be modified';

CREATE INDEX idx_roles_organization ON public.roles(organization_id);
CREATE INDEX idx_roles_system ON public.roles(system_role) WHERE is_system_role = true;

-- ========================================
-- PERMISSIONS
-- ========================================
CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL, -- e.g., 'billing.create', 'students.view'
    description TEXT,
    resource TEXT NOT NULL, -- e.g., 'billing', 'students', 'payments'
    action TEXT NOT NULL,    -- e.g., 'create', 'view', 'edit', 'delete'
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.permissions IS 'Available permissions in the system';
COMMENT ON COLUMN public.permissions.code IS 'Unique permission identifier in format resource.action';
COMMENT ON COLUMN public.permissions.resource IS 'The resource being protected (billing, students, payments, etc.)';
COMMENT ON COLUMN public.permissions.action IS 'The action allowed (create, view, edit, delete, etc.)';

CREATE INDEX idx_permissions_resource ON public.permissions(resource);
CREATE INDEX idx_permissions_code ON public.permissions(code);

-- ========================================
-- ROLE_PERMISSIONS
-- ========================================
CREATE TABLE IF NOT EXISTS public.role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(role_id, permission_id)
);

COMMENT ON TABLE public.role_permissions IS 'Many-to-many relationship between roles and permissions';

CREATE INDEX idx_role_permissions_role ON public.role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission ON public.role_permissions(permission_id);

-- ========================================
-- SCHOOL_MEMBERS (extends organization_members)
-- ========================================
CREATE TABLE IF NOT EXISTS public.school_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
    invited_by UUID REFERENCES auth.users(id),
    joined_at TIMESTAMPTZ DEFAULT now(),
    left_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(user_id, school_id, role_id)
);

COMMENT ON TABLE public.school_members IS 'User memberships within schools with assigned roles';
COMMENT ON COLUMN public.school_members.is_active IS 'Soft delete flag; false when user leaves or is removed';

CREATE INDEX idx_school_members_school ON public.school_members(school_id);
CREATE INDEX idx_school_members_user ON public.school_members(user_id);
CREATE INDEX idx_school_members_role ON public.school_members(role_id);
CREATE INDEX idx_school_members_active ON public.school_members(is_active) WHERE is_active = true;

-- ========================================
-- ROW LEVEL SECURITY (RLS)
-- ========================================

-- Enable RLS on RBAC tables
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_members ENABLE ROW LEVEL SECURITY;

-- ROLES: Readable by authenticated users; writable by SUPER_ADMIN and authorized users
CREATE POLICY "Users can view roles in their organization" ON public.roles
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND
        (
            organization_id IS NULL -- system roles
            OR
            organization_id IN (
                SELECT organization_id FROM public.organization_members
                WHERE user_id = auth.uid() AND is_active = true
            )
        )
    );

CREATE POLICY "SUPER_ADMIN can manage roles" ON public.roles
    FOR ALL USING (
        auth.uid() IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM public.school_members sm
            JOIN public.roles r ON sm.role_id = r.id
            WHERE sm.user_id = auth.uid()
            AND sm.is_active = true
            AND r.system_role = 'SUPER_ADMIN'
        )
    );

-- PERMISSIONS: Readable by all authenticated users
CREATE POLICY "Authenticated users can view permissions" ON public.permissions
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- ROLE_PERMISSIONS: Follow role policies
CREATE POLICY "Users can view role permissions in their org" ON public.role_permissions
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND
        role_id IN (
            SELECT id FROM public.roles
            WHERE organization_id IS NULL
            OR organization_id IN (
                SELECT organization_id FROM public.organization_members
                WHERE user_id = auth.uid() AND is_active = true
            )
        )
    );

CREATE POLICY "SUPER_ADMIN can manage role permissions" ON public.role_permissions
    FOR ALL USING (
        auth.uid() IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM public.school_members sm
            JOIN public.roles r ON sm.role_id = r.id
            WHERE sm.user_id = auth.uid()
            AND sm.is_active = true
            AND r.system_role = 'SUPER_ADMIN'
        )
    );

-- SCHOOL_MEMBERS: Users can view their own memberships
CREATE POLICY "Users can view their own school memberships" ON public.school_members
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND
        user_id = auth.uid()
    );

CREATE POLICY "School admins can view school members" ON public.school_members
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM public.school_members sm2
            JOIN public.roles r2 ON sm2.role_id = r2.id
            WHERE sm2.user_id = auth.uid()
            AND sm2.school_id = school_members.school_id
            AND sm2.is_active = true
            AND r2.system_role IN ('OWNER', 'ADMIN', 'BURSAR')
        )
    );

CREATE POLICY "SUPER_ADMIN can view all members" ON public.school_members
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM public.school_members sm3
            JOIN public.roles r3 ON sm3.role_id = r3.id
            WHERE sm3.user_id = auth.uid()
            AND sm3.is_active = true
            AND r3.system_role = 'SUPER_ADMIN'
        )
    );

CREATE POLICY "Authorized users can manage memberships" ON public.school_members
    FOR ALL USING (
        auth.uid() IS NOT NULL AND
        (
            EXISTS (
                SELECT 1 FROM public.school_members sm4
                JOIN public.roles r4 ON sm4.role_id = r4.id
                WHERE sm4.user_id = auth.uid()
                AND sm4.school_id = school_members.school_id
                AND sm4.is_active = true
                AND r4.system_role IN ('OWNER', 'ADMIN')
            )
            OR
            EXISTS (
                SELECT 1 FROM public.school_members sm5
                JOIN public.roles r5 ON sm5.role_id = r5.id
                WHERE sm5.user_id = auth.uid()
                AND sm5.is_active = true
                AND r5.system_role = 'SUPER_ADMIN'
            )
        )
    );

-- ========================================
-- SEED DATA: System Permissions
-- ========================================
INSERT INTO public.permissions (code, description, resource, action) VALUES
    ('students.view', 'View student records', 'students', 'view'),
    ('students.create', 'Create new students', 'students', 'create'),
    ('students.update', 'Edit student records', 'students', 'update'),
    ('students.delete', 'Delete students', 'students', 'delete'),
    ('billing.view', 'View billing profiles', 'billing', 'view'),
    ('billing.create', 'Create billing profiles', 'billing', 'create'),
    ('billing.edit', 'Edit billing profiles', 'billing', 'edit'),
    ('billing.lock', 'Lock billing periods', 'billing', 'lock'),
    ('payments.view', 'View payments', 'payments', 'view'),
    ('payments.receive', 'Record payments', 'payments', 'receive'),
    ('payments.refund', 'Issue refunds', 'payments', 'refund'),
    ('payments.reconcile', 'Reconcile payments', 'payments', 'reconcile'),
    ('ledger.view', 'View ledger entries', 'ledger', 'view'),
    ('reports.view', 'View financial reports', 'reports', 'view'),
    ('reports.export', 'Export reports', 'reports', 'export'),
    ('audit.view', 'View audit logs', 'audit', 'view'),
    ('notifications.send', 'Send notifications', 'notifications', 'send'),
    ('notifications.view', 'View notifications', 'notifications', 'view'),
    ('users.manage', 'Manage users', 'users', 'manage'),
    ('roles.manage', 'Manage roles and permissions', 'roles', 'manage'),
    ('schools.manage', 'Manage school configuration', 'schools', 'manage'),
    ('organizations.manage', 'Manage organizations', 'organizations', 'manage'),
    ('platformlevy.view', 'View platform levy', 'platformlevy', 'view'),
    ('platformlevy.manage', 'Configure platform levy', 'platformlevy', 'manage'),
    ('settings.manage', 'Manage system settings', 'settings', 'manage')
ON CONFLICT (code) DO NOTHING;

-- ========================================
-- SEED DATA: System Roles
-- ========================================
-- SUPER_ADMIN role
INSERT INTO public.roles (name, description, system_role, is_system_role)
VALUES ('Super Administrator', 'Platform-wide administrator with full access', 'SUPER_ADMIN', true)
ON CONFLICT DO NOTHING;

-- OWNER role
INSERT INTO public.roles (name, description, system_role, is_system_role)
VALUES ('Owner', 'School owner with full administrative access', 'OWNER', true)
ON CONFLICT DO NOTHING;

-- ADMIN role
INSERT INTO public.roles (name, description, system_role, is_system_role)
VALUES ('Administrator', 'School administrator', 'ADMIN', true)
ON CONFLICT DO NOTHING;

-- BURSAR role
INSERT INTO public.roles (name, description, system_role, is_system_role)
VALUES ('Bursar', 'Financial operator', 'BURSAR', true)
ON CONFLICT DO NOTHING;

-- PARENT role
INSERT INTO public.roles (name, description, system_role, is_system_role)
VALUES ('Parent', 'Parent/guardian portal user', 'PARENT', true)
ON CONFLICT DO NOTHING;

-- ========================================
-- SEED DATA: Role-Permission Mappings
-- ========================================
DO $$
DECLARE
    super_admin_role_id UUID;
    owner_role_id UUID;
    admin_role_id UUID;
    bursar_role_id UUID;
    parent_role_id UUID;
BEGIN
    -- Get role IDs
    SELECT id INTO super_admin_role_id FROM public.roles WHERE system_role = 'SUPER_ADMIN' LIMIT 1;
    SELECT id INTO owner_role_id FROM public.roles WHERE system_role = 'OWNER' LIMIT 1;
    SELECT id INTO admin_role_id FROM public.roles WHERE system_role = 'ADMIN' LIMIT 1;
    SELECT id INTO bursar_role_id FROM public.roles WHERE system_role = 'BURSAR' LIMIT 1;
    SELECT id INTO parent_role_id FROM public.roles WHERE system_role = 'PARENT' LIMIT 1;

    -- SUPER_ADMIN gets all permissions
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT super_admin_role_id, id FROM public.permissions
    ON CONFLICT DO NOTHING;

    -- OWNER gets: students.view, billing.view, billing.create, billing.edit, payments.view, payments.receive, 
    -- ledger.view, reports.view, reports.export, audit.view, users.manage, roles.manage, schools.manage,
    -- platformlevy.view, notifications.send, notifications.view, settings.manage
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT owner_role_id, id FROM public.permissions
    WHERE code IN (
        'students.view', 'students.create', 'students.update', 'students.delete',
        'billing.view', 'billing.create', 'billing.edit', 'billing.lock',
        'payments.view', 'payments.receive',
        'ledger.view',
        'reports.view', 'reports.export',
        'audit.view',
        'users.manage',
        'roles.manage',
        'schools.manage',
        'platformlevy.view',
        'notifications.send', 'notifications.view',
        'settings.manage'
    )
    ON CONFLICT DO NOTHING;

    -- ADMIN gets: students.view/create/update, billing.view/create/edit, payments.view/receive,
    -- ledger.view, reports.view/export, audit.view, users.manage, notifications.send/view
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT admin_role_id, id FROM public.permissions
    WHERE code IN (
        'students.view', 'students.create', 'students.update',
        'billing.view', 'billing.create', 'billing.edit',
        'payments.view', 'payments.receive',
        'ledger.view',
        'reports.view', 'reports.export',
        'audit.view',
        'users.manage',
        'notifications.send', 'notifications.view',
        'settings.manage'
    )
    ON CONFLICT DO NOTHING;

    -- BURSAR gets: billing.view/create/edit, payments.view/receive/refund/reconcile,
    -- ledger.view, reports.view/export, audit.view, notifications.send/view
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT bursar_role_id, id FROM public.permissions
    WHERE code IN (
        'billing.view', 'billing.create', 'billing.edit', 'billing.lock',
        'payments.view', 'payments.receive', 'payments.refund', 'payments.reconcile',
        'ledger.view',
        'reports.view', 'reports.export',
        'audit.view',
        'notifications.send', 'notifications.view'
    )
    ON CONFLICT DO NOTHING;

    -- PARENT gets: students.view, payments.view, notifications.view
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT parent_role_id, id FROM public.permissions
    WHERE code IN (
        'students.view',
        'payments.view',
        'notifications.view'
    )
    ON CONFLICT DO NOTHING;
END $$;

-- ========================================
-- FUNCTIONS
-- ========================================

-- Function to check if current user is SUPER_ADMIN
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.school_members sm
        JOIN public.roles r ON sm.role_id = r.id
        WHERE sm.user_id = auth.uid()
        AND sm.is_active = true
        AND r.system_role = 'SUPER_ADMIN'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.is_super_admin() IS 'Returns true if current authenticated user is a SUPER_ADMIN';

-- Function to check if current user has platform levy management permission
CREATE OR REPLACE FUNCTION public.can_manage_platform_levy()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.school_members sm
        JOIN public.roles r ON sm.role_id = r.id
        JOIN public.role_permissions rp ON rp.role_id = r.id
        JOIN public.permissions p ON p.id = rp.permission_id
        WHERE sm.user_id = auth.uid()
        AND sm.is_active = true
        AND p.code = 'platformlevy.manage'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.can_manage_platform_levy() IS 'Returns true if current user can manage platform levy';

-- ========================================
-- TRIGGERS
-- ========================================

-- Update updated_at timestamp on role modifications
CREATE OR REPLACE FUNCTION public.update_rbac_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER roles_updated_at
    BEFORE UPDATE ON public.roles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_rbac_updated_at();

-- ========================================
-- ENABLE REAL-TIME
-- ========================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.roles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.role_permissions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.school_members;
-- ==========================================================
-- CAPFLUX — Migration: 202608230001_guardian_relationships.sql
-- Purpose: Guardian Relationships phase —
--   1. student_guardians.updated_at (audit + conflict resolution)
--   2. Widen guardian_relationship enum (SPONSOR/SIBLING/RELATIVE/
--      GRANDPARENT/UNCLE/AUNT/BROTHER/SISTER) to match the values the
--      import normalizer and StudentForm already produce — prevents a
--      class of silent sync failures where an outbox replay of a link
--      row carrying one of those values would be rejected by Postgres.
--   NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction block;
--   this file therefore does not use BEGIN/COMMIT (same as Supabase's own
--   enum-widening migrations).
--   3. set_student_primary_guardian(p_school_id, p_student_id, p_guardian_id)
--      SECURITY DEFINER RPC — the ONLY server path that flips is_primary /
--      students.guardian_id. Demote→promote→mirror inside one atomic
--      function, so two offline devices racing "make X primary" can never
--      leave two primaries or a divergent students.guardian_id. The partial
--      unique index remains as the final backstop.
--   4. verify_guardian_consistency(p_school_id) reporting RPC +
--      repair_guardian_consistency(p_school_id) — detects / repairs
--      divergence between students.guardian_id and the primary join row.
-- Additive only: no column removals, no historical data rewrites.
-- students.guardian_id is KEPT as the billing/notification pointer.
-- ==========================================================

-- ==========================================================
-- 1. student_guardians.updated_at
-- ==========================================================

ALTER TABLE public.student_guardians
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

COMMENT ON COLUMN public.student_guardians.relationship IS 'Relationship of this guardian to this student (per-link, guardian_relationship enum).';

-- ==========================================================
-- 2. Widen guardian_relationship enum
-- ==========================================================

ALTER TYPE public.guardian_relationship ADD VALUE IF NOT EXISTS 'SPONSOR';
ALTER TYPE public.guardian_relationship ADD VALUE IF NOT EXISTS 'SIBLING';
ALTER TYPE public.guardian_relationship ADD VALUE IF NOT EXISTS 'RELATIVE';
ALTER TYPE public.guardian_relationship ADD VALUE IF NOT EXISTS 'GRANDPARENT';
ALTER TYPE public.guardian_relationship ADD VALUE IF NOT EXISTS 'UNCLE';
ALTER TYPE public.guardian_relationship ADD VALUE IF NOT EXISTS 'AUNT';
ALTER TYPE public.guardian_relationship ADD VALUE IF NOT EXISTS 'BROTHER';
ALTER TYPE public.guardian_relationship ADD VALUE IF NOT EXISTS 'SISTER';

-- ==========================================================
-- 3. Atomic primary-guardian swap (server-authoritative)
-- Demotes the current primary link, promotes the target link and mirrors
-- students.guardian_id — all in one implicit transaction. Concurrent
-- callers serialize on the row locks taken by the UPDATEs, so two devices
-- replaying conflicting promotions converge to a single primary.
-- Tenant check mirrors the RLS policy predicate exactly.
-- ==========================================================

CREATE OR REPLACE FUNCTION public.set_student_primary_guardian(
    p_school_id UUID,
    p_student_id UUID,
    p_guardian_id UUID
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_link public.student_guardians;
BEGIN
    -- Definer functions bypass RLS, so tenancy is enforced here: the
    -- caller's JWT school claim must match the target school.
    IF current_school_id() IS NULL OR current_school_id() <> p_school_id THEN
        RAISE EXCEPTION 'TENANT_MISMATCH';
    END IF;

    -- The relationship must exist and belong to this school/tenant.
    SELECT * INTO v_link FROM public.student_guardians
    WHERE student_id = p_student_id
      AND guardian_id = p_guardian_id
      AND school_id = p_school_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'GUARDIAN_LINK_NOT_FOUND';
    END IF;

    -- Already primary: idempotent success; just ensure the legacy pointer
    -- is consistent (repair-only write).
    IF v_link.is_primary THEN
        UPDATE public.students
        SET guardian_id = p_guardian_id, updated_at = now()
        WHERE id = p_student_id AND school_id = p_school_id;
        RETURN jsonb_build_object(
            'success', true,
            'already_primary', true,
            'student_id', p_student_id,
            'guardian_id', p_guardian_id
        );
    END IF;

    -- 1. Demote every other primary link for this student.
    UPDATE public.student_guardians
    SET is_primary = false, updated_at = now()
    WHERE student_id = p_student_id AND is_primary;

    -- 2. Promote the target link.
    UPDATE public.student_guardians
    SET is_primary = true, updated_at = now()
    WHERE id = v_link.id;

    -- 3. Mirror into the billing/notification compatibility pointer.
    UPDATE public.students
    SET guardian_id = p_guardian_id, updated_at = now()
    WHERE id = p_student_id AND school_id = p_school_id;

    RETURN jsonb_build_object(
        'success', true,
        'already_primary', false,
        'student_id', p_student_id,
        'guardian_id', p_guardian_id
    );
END;
$$;

-- ==========================================================
-- 4. Consistency verification / repair
-- Invariant: for every student with a primary join row, the mirrored
-- pointer matches; for every student whose pointer is set, a matching
-- primary join row exists. Reporting is read-only; repair is explicit.
-- ==========================================================

CREATE OR REPLACE FUNCTION public.verify_guardian_consistency(p_school_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_missing_join INTEGER;
    v_divergent INTEGER;
    v_multi_primary INTEGER;
    v_total_links INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_missing_join
    FROM public.students s
    WHERE s.school_id = p_school_id
      AND s.guardian_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM public.student_guardians sg
          WHERE sg.student_id = s.id
            AND sg.guardian_id = s.guardian_id
            AND sg.is_primary
      );

    SELECT COUNT(*) INTO v_divergent
    FROM public.students s
    JOIN public.student_guardians sg
      ON sg.student_id = s.id AND sg.is_primary
    WHERE s.school_id = p_school_id
      AND s.guardian_id IS DISTINCT FROM sg.guardian_id;

    SELECT COUNT(*) INTO v_multi_primary
    FROM (
        SELECT student_id
        FROM public.student_guardians
        WHERE school_id = p_school_id AND is_primary
        GROUP BY student_id
        HAVING COUNT(*) > 1
    ) m;

    SELECT COUNT(*) INTO v_total_links
    FROM public.student_guardians
    WHERE school_id = p_school_id;

    RETURN jsonb_build_object(
        'school_id', p_school_id,
        'students_missing_primary_join', v_missing_join,
        'students_pointer_divergent', v_divergent,
        'students_multiple_primaries', v_multi_primary,
        'total_links', v_total_links,
        'consistent',
            v_missing_join = 0 AND v_divergent = 0 AND v_multi_primary = 0
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.repair_guardian_consistency(p_school_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_repaired INTEGER := 0;
    r RECORD;
BEGIN
    -- Same tenant enforcement as set_student_primary_guardian: definer
    -- functions must self-check because they bypass RLS.
    IF current_school_id() IS NULL OR current_school_id() <> p_school_id THEN
        RAISE EXCEPTION 'TENANT_MISMATCH';
    END IF;

    -- A) Pointer set but no matching primary join row → backfill the join.
    FOR r IN
        SELECT s.id AS student_id, s.guardian_id
        FROM public.students s
        WHERE s.school_id = p_school_id
          AND s.guardian_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM public.student_guardians sg
              WHERE sg.student_id = s.id
                AND sg.guardian_id = s.guardian_id
                AND sg.is_primary
          )
    LOOP
        INSERT INTO public.student_guardians
            (id, school_id, student_id, guardian_id, relationship, is_primary)
        VALUES
            (gen_random_uuid(), p_school_id, r.student_id, r.guardian_id, 'GUARDIAN', true)
        ON CONFLICT (student_id, guardian_id)
        DO UPDATE SET is_primary = true, updated_at = now();
        v_repaired := v_repaired + 1;
    END LOOP;

    -- B) Primary join row disagrees with the pointer → mirror wins
    --    (students.guardian_id is what billing reads today).
    FOR r IN
        SELECT s.id AS student_id, s.guardian_id, sg.id AS link_id
        FROM public.students s
        JOIN public.student_guardians sg
          ON sg.student_id = s.id AND sg.is_primary
        WHERE s.school_id = p_school_id
          AND s.guardian_id IS NOT NULL
          AND s.guardian_id <> sg.guardian_id
    LOOP
        UPDATE public.student_guardians
        SET is_primary = false, updated_at = now()
        WHERE id = r.link_id;

        UPDATE public.student_guardians
        SET is_primary = true, updated_at = now()
        WHERE student_id = r.student_id
          AND guardian_id = r.guardian_id;

        v_repaired := v_repaired + 1;
    END LOOP;

    RETURN jsonb_build_object('school_id', p_school_id, 'repaired', v_repaired);
END;
$$;



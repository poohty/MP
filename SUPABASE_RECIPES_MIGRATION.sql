-- ===================================================================
-- MIGRATION: Harden recipes primary key to be per-user (composite PK)
-- ===================================================================
-- Safely migrates an existing recipes table that currently has a PK on (id)
-- to a composite primary key on (owner_user_id, id).
--
-- Keeps existing columns and data.
-- ===================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'recipes'
      AND tc.constraint_type = 'PRIMARY KEY'
  ) THEN
    EXECUTE (
      SELECT format('ALTER TABLE public.recipes DROP CONSTRAINT %I', tc.constraint_name)
      FROM information_schema.table_constraints tc
      WHERE tc.table_schema = 'public'
        AND tc.table_name = 'recipes'
        AND tc.constraint_type = 'PRIMARY KEY'
      LIMIT 1
    );
  END IF;

  ALTER TABLE public.recipes
    ADD CONSTRAINT recipes_pkey PRIMARY KEY (owner_user_id, id);
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

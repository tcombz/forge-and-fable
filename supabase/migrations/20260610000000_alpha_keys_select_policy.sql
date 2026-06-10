-- =============================================================================
-- Fix: Add SELECT policy for used_alpha_keys
-- 2026-06-10
--
-- The signup flow checks whether an alpha key has already been claimed before
-- allowing registration. Without a SELECT policy, the client-side query always
-- returns null, so keys can be reused indefinitely.
--
-- This adds a permissive SELECT policy so any authenticated (or anon) user can
-- query for a specific key. The table only contains already-used keys, so
-- exposing the set of claimed keys is acceptable — it reveals nothing about
-- unclaimed keys in the app-side ALPHA_KEYS_LIST constant.
-- =============================================================================

ALTER TABLE used_alpha_keys ENABLE ROW LEVEL SECURITY;

-- Drop any conflicting policy first (idempotent)
DROP POLICY IF EXISTS "alpha_keys_select_claimed" ON used_alpha_keys;

-- Allow reading claimed key rows so the signup duplicate-check works
CREATE POLICY "alpha_keys_select_claimed" ON used_alpha_keys
  FOR SELECT
  USING (true);

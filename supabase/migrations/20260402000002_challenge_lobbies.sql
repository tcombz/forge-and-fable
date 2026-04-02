-- =============================================================================
-- Forge & Fable — Challenge Lobbies
-- 2026-04-02
-- Paste into Supabase Dashboard → SQL Editor
-- Enables shareable challenge URLs: yoursite.com/#/challenge/{lobby-id}
-- =============================================================================

CREATE TABLE IF NOT EXISTS challenge_lobbies (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  host_name   text        NOT NULL DEFAULT '',
  host_avatar text        NOT NULL DEFAULT '',
  deck        jsonb,
  status      text        NOT NULL DEFAULT 'waiting',
  -- 'waiting' | 'joined' | 'cancelled' | 'expired'
  match_id    uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '5 minutes'
);

CREATE INDEX IF NOT EXISTS idx_challenge_lobbies_host
  ON challenge_lobbies (host_id);

CREATE INDEX IF NOT EXISTS idx_challenge_lobbies_status
  ON challenge_lobbies (status)
  WHERE status = 'waiting';

ALTER TABLE challenge_lobbies ENABLE ROW LEVEL SECURITY;

-- Host can fully manage their own lobby
DROP POLICY IF EXISTS "lobby_host_all"    ON challenge_lobbies;
DROP POLICY IF EXISTS "lobby_read_all"    ON challenge_lobbies;
DROP POLICY IF EXISTS "lobby_challenger"  ON challenge_lobbies;

CREATE POLICY "lobby_host_all" ON challenge_lobbies
  FOR ALL TO authenticated
  USING    (host_id::text = auth.uid()::text)
  WITH CHECK (host_id::text = auth.uid()::text);

-- Any authenticated user can read any lobby (needed to join via URL)
CREATE POLICY "lobby_read_all" ON challenge_lobbies
  FOR SELECT TO authenticated
  USING (true);

-- Challenger can update a waiting, non-expired lobby they don't own
CREATE POLICY "lobby_challenger" ON challenge_lobbies
  FOR UPDATE TO authenticated
  USING (
    status = 'waiting'
    AND host_id::text != auth.uid()::text
    AND expires_at > now()
  )
  WITH CHECK (true);

-- =============================================================================
-- DONE
-- =============================================================================

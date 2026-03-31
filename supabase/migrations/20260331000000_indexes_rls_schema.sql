-- =============================================================================
-- Forge & Fable — Database Schema Migration
-- 2026-03-31
-- Run once against your Supabase project via the SQL editor or CLI:
--   supabase db push  (if using local dev)
--   or paste into Supabase Dashboard → SQL Editor
--
-- What this file does:
--   1. Documents the full schema (tables, columns, types)
--   2. Ensures all required indexes exist
--   3. Enables Row Level Security on every table
--   4. Creates the correct RLS policies
--   5. Drops obsolete development columns
--   6. Creates helper RPCs if missing
-- =============================================================================


-- =============================================================================
-- SCHEMA REFERENCE
-- =============================================================================
--
-- TABLE: profiles
--   id              uuid          PK  references auth.users(id)
--   name            text          NOT NULL — display name (unique enforced by app)
--   alpha_key       text          — the invite key used at signup
--   shards          int           DEFAULT 0 — in-game currency
--   last_shard_reset timestamptz  — tracks weekly shard reset (every Friday)
--   battles_played  int           DEFAULT 0
--   battles_won     int           DEFAULT 0
--   cards_forged    int           DEFAULT 0
--   collection      jsonb         — { [card_id]: count } map
--   decks           jsonb         — array of { name, cards[] } deck objects
--   match_history   jsonb         — last 50 match summaries
--   daily_quests    jsonb         — quest state for the current day
--   joined          text          — human-readable join date (toLocaleDateString)
--   avatar_url      text          — public URL to avatar image
--   selected_arts   jsonb         — { [card_id]: alt_art_set_id } map
--   alt_owned       jsonb         — { [card_id]: [set_id, ...] } owned alt arts
--   free_pack_used  text          — date string of last free pack claim
--   last_patch_seen text          — patch label for "new patch" notification
--   ranked_rating   int           DEFAULT 1000 — MMR
--   ranked_wins     int           DEFAULT 0
--   ranked_losses   int           DEFAULT 0
--   is_fables_tester bool         DEFAULT false — legacy dev-tester flag (kept for back-compat)
--
-- TABLE: matches
--   id              uuid          PK DEFAULT gen_random_uuid()
--   player1_id      uuid          references auth.users(id)
--   player2_id      uuid          references auth.users(id)
--   status          text          'active' | 'finished'
--   game_state      jsonb         — full serialised game state (see game_state shape below)
--   p1_disconnect_at timestamptz  — stamped when p1 closes browser; cleared on rejoin
--   p2_disconnect_at timestamptz  — stamped when p2 closes browser; cleared on rejoin
--   created_at      timestamptz   DEFAULT now()
--
--   game_state shape (partial — key top-level keys):
--     turn, phase ('p1'|'p2'|'opening'|'gameover'), winner ('p1'|'p2'|null)
--     p1HP, p2HP, p1Energy, p2Energy, p1Max, p2Max
--     p1Board[], p2Board[], p1Hand[], p2Hand[], p1Deck[], p2Deck[]
--     p1LightningMeter, p2LightningMeter, p1ZeusInPlay, p2ZeusInPlay
--     p1Name, p2Name, p1Avatar, p2Avatar
--     p1Env, p2Env (active environment card per player)
--     log[] (last 20 messages)
--     seq (broadcast sequence number for dedup)
--
-- TABLE: matchmaking
--   id              uuid          PK DEFAULT gen_random_uuid()
--   user_id         uuid          references auth.users(id)
--   display_name    text
--   status          text          'waiting' | 'matched'
--   match_id        uuid          — populated when paired
--   opponent_id     uuid          — populated when paired
--   opponent_name   text          — populated when paired
--   created_at      timestamptz   DEFAULT now()
--
-- TABLE: friendships
--   id              uuid          PK DEFAULT gen_random_uuid()
--   requester       uuid          references auth.users(id)
--   accepter        uuid          references auth.users(id)
--   status          text          'pending' | 'accepted'
--   created_at      timestamptz   DEFAULT now()
--   UNIQUE(requester, accepter)
--
-- TABLE: used_alpha_keys
--   key             text          PK — uppercase invite key
--   used_by_name    text
--   used_at         timestamptz   DEFAULT now()
--
-- TABLE: community_feedback
--   id              uuid          PK DEFAULT gen_random_uuid()
--   user_id         uuid          references auth.users(id)
--   user_name       text
--   category        text          'bug' | 'feature' | 'balance' | 'other'
--   message         text          NOT NULL
--   upvotes         int           DEFAULT 0
--   created_at      timestamptz   DEFAULT now()
--
-- TABLE: community_cards
--   id              uuid          PK DEFAULT gen_random_uuid()
--   user_id         uuid          references auth.users(id)
--   user_name       text
--   name            text
--   faction         text
--   type            text          'creature' | 'spell' | 'environment' | 'champion'
--   cost            int
--   atk             int
--   hp              int
--   ability         text
--   keywords        text[]
--   rarity          text
--   original_idea   text
--   votes           int           DEFAULT 0
--   created_at      timestamptz   DEFAULT now()
--
-- =============================================================================


-- =============================================================================
-- 1. INDEXES
-- =============================================================================

-- profiles: ranked_rating for leaderboard ORDER BY queries
CREATE INDEX IF NOT EXISTS idx_profiles_ranked_rating
  ON profiles (ranked_rating DESC);

-- profiles: name for friend-search ILIKE queries
CREATE INDEX IF NOT EXISTS idx_profiles_name_lower
  ON profiles (lower(name) text_pattern_ops);

-- matches: player lookups — both sides of a match
CREATE INDEX IF NOT EXISTS idx_matches_player1_id
  ON matches (player1_id);

CREATE INDEX IF NOT EXISTS idx_matches_player2_id
  ON matches (player2_id);

-- matches: status filter (only 'active' matches are polled)
CREATE INDEX IF NOT EXISTS idx_matches_status
  ON matches (status)
  WHERE status = 'active';

-- matches: created_at for leaderboard time-range queries
CREATE INDEX IF NOT EXISTS idx_matches_created_at
  ON matches (created_at DESC);

-- matches: compound index for the rejoin query
--   (.eq("status","active").or("player1_id.eq.X,player2_id.eq.Y"))
CREATE INDEX IF NOT EXISTS idx_matches_status_players
  ON matches (status, player1_id, player2_id);

-- matchmaking: user_id for queue purge and row lookup
CREATE INDEX IF NOT EXISTS idx_matchmaking_user_id
  ON matchmaking (user_id);

-- matchmaking: status for finding 'waiting' rows in pair_players()
CREATE INDEX IF NOT EXISTS idx_matchmaking_status
  ON matchmaking (status);

-- friendships: bidirectional lookup (.or("requester.eq.X,accepter.eq.X"))
CREATE INDEX IF NOT EXISTS idx_friendships_requester
  ON friendships (requester);

CREATE INDEX IF NOT EXISTS idx_friendships_accepter
  ON friendships (accepter);

-- community_feedback: sort order for wall
CREATE INDEX IF NOT EXISTS idx_community_feedback_upvotes
  ON community_feedback (upvotes DESC);

CREATE INDEX IF NOT EXISTS idx_community_feedback_created_at
  ON community_feedback (created_at DESC);

-- community_cards: sort order for wall
CREATE INDEX IF NOT EXISTS idx_community_cards_votes
  ON community_cards (votes DESC);


-- =============================================================================
-- 2. ROW LEVEL SECURITY
-- =============================================================================
-- Strategy:
--   profiles       — SELECT all (public leaderboard), INSERT/UPDATE/DELETE own row only
--   matches        — SELECT if you are player1 or player2; INSERT if authenticated;
--                    UPDATE if you are player1 or player2; DELETE if you are a player
--   matchmaking    — Full CRUD on own row only
--   friendships    — SELECT/INSERT/UPDATE/DELETE only rows where you are requester or accepter
--   used_alpha_keys — INSERT only (no SELECT — server-side key validation stays private)
--   community_feedback — SELECT all; INSERT/UPDATE authenticated only
--   community_cards    — SELECT all; INSERT authenticated; UPDATE authenticated (votes)
-- =============================================================================

-- ── profiles ──────────────────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all"       ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own"        ON profiles;
DROP POLICY IF EXISTS "profiles_update_own"        ON profiles;
DROP POLICY IF EXISTS "profiles_delete_own"        ON profiles;

-- Anyone authenticated can read any profile (leaderboard, friend search)
CREATE POLICY "profiles_select_all" ON profiles
  FOR SELECT TO authenticated
  USING (true);

-- Only the owning user can insert their profile row
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- Only the owning user can update their profile
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Only the owning user can delete their profile (account deletion)
CREATE POLICY "profiles_delete_own" ON profiles
  FOR DELETE TO authenticated
  USING (id = auth.uid());


-- ── matches ───────────────────────────────────────────────────────────────────
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "matches_select_players"  ON matches;
DROP POLICY IF EXISTS "matches_insert_auth"     ON matches;
DROP POLICY IF EXISTS "matches_update_players"  ON matches;
DROP POLICY IF EXISTS "matches_delete_players"  ON matches;

-- Players can only read their own matches
CREATE POLICY "matches_select_players" ON matches
  FOR SELECT TO authenticated
  USING (player1_id = auth.uid() OR player2_id = auth.uid());

-- Any authenticated user can create a match (challenge accepted flow)
CREATE POLICY "matches_insert_auth" ON matches
  FOR INSERT TO authenticated
  WITH CHECK (player1_id = auth.uid() OR player2_id = auth.uid());

-- Only players in the match can update the game state
CREATE POLICY "matches_update_players" ON matches
  FOR UPDATE TO authenticated
  USING (player1_id = auth.uid() OR player2_id = auth.uid());

-- Players can delete/cleanup their own finished matches
CREATE POLICY "matches_delete_players" ON matches
  FOR DELETE TO authenticated
  USING (player1_id = auth.uid() OR player2_id = auth.uid());


-- ── matchmaking ───────────────────────────────────────────────────────────────
ALTER TABLE matchmaking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "matchmaking_select_own"  ON matchmaking;
DROP POLICY IF EXISTS "matchmaking_insert_own"  ON matchmaking;
DROP POLICY IF EXISTS "matchmaking_update_own"  ON matchmaking;
DROP POLICY IF EXISTS "matchmaking_delete_own"  ON matchmaking;

-- The pair_players() RPC uses service role key so bypasses RLS.
-- Client-side access is own-row only.
CREATE POLICY "matchmaking_select_own" ON matchmaking
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "matchmaking_insert_own" ON matchmaking
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "matchmaking_update_own" ON matchmaking
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "matchmaking_delete_own" ON matchmaking
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());


-- ── friendships ───────────────────────────────────────────────────────────────
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "friendships_select_participant"  ON friendships;
DROP POLICY IF EXISTS "friendships_insert_requester"    ON friendships;
DROP POLICY IF EXISTS "friendships_update_accepter"     ON friendships;
DROP POLICY IF EXISTS "friendships_delete_participant"  ON friendships;

-- See any friendship you are part of (both pending and accepted)
CREATE POLICY "friendships_select_participant" ON friendships
  FOR SELECT TO authenticated
  USING (requester = auth.uid() OR accepter = auth.uid());

-- You can only create a friendship request where you are the requester
CREATE POLICY "friendships_insert_requester" ON friendships
  FOR INSERT TO authenticated
  WITH CHECK (requester = auth.uid());

-- Both parties can update (accepter accepts; requester could cancel pending)
CREATE POLICY "friendships_update_accepter" ON friendships
  FOR UPDATE TO authenticated
  USING (requester = auth.uid() OR accepter = auth.uid());

-- Either party can remove the friendship
CREATE POLICY "friendships_delete_participant" ON friendships
  FOR DELETE TO authenticated
  USING (requester = auth.uid() OR accepter = auth.uid());


-- ── used_alpha_keys ───────────────────────────────────────────────────────────
ALTER TABLE used_alpha_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alpha_keys_select_none"   ON used_alpha_keys;
DROP POLICY IF EXISTS "alpha_keys_insert_auth"   ON used_alpha_keys;

-- No client SELECT — key availability is checked via service-role upsert
-- (prevents enumeration of which keys exist)
CREATE POLICY "alpha_keys_insert_auth" ON used_alpha_keys
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Intentionally no SELECT policy for non-service role clients


-- ── community_feedback ────────────────────────────────────────────────────────
ALTER TABLE community_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feedback_select_all"    ON community_feedback;
DROP POLICY IF EXISTS "feedback_insert_auth"   ON community_feedback;
DROP POLICY IF EXISTS "feedback_update_upvote" ON community_feedback;

CREATE POLICY "feedback_select_all" ON community_feedback
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "feedback_insert_auth" ON community_feedback
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Allow updating only the upvotes column (enforced at app level; RLS allows row)
CREATE POLICY "feedback_update_upvote" ON community_feedback
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);


-- ── community_cards ───────────────────────────────────────────────────────────
ALTER TABLE community_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cards_select_all"    ON community_cards;
DROP POLICY IF EXISTS "cards_insert_auth"   ON community_cards;
DROP POLICY IF EXISTS "cards_update_votes"  ON community_cards;

CREATE POLICY "cards_select_all" ON community_cards
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "cards_insert_auth" ON community_cards
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Any authenticated user can increment votes (app prevents double-voting)
CREATE POLICY "cards_update_votes" ON community_cards
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);


-- =============================================================================
-- 3. DROP OBSOLETE / DEV-ONLY COLUMNS
-- =============================================================================

-- is_fables_tester was a dev-era column used to gate Fables set access.
-- All accounts now receive all cards at signup via getStarterCollection().
-- The flag is still read in isFablesTester() but only as a fallback;
-- the real check is now username-based (FABLES_NAMES set in app code).
-- We keep the column to avoid breaking the toAppUser mapping but mark intent:
COMMENT ON COLUMN profiles.is_fables_tester IS
  'Legacy dev-only flag. All players now receive full card sets at signup. Safe to drop in a future migration once isFablesTester() is fully removed from app code.';

-- matches.status='finished' rows older than 30 days are safe to prune.
-- Run this periodically (or as a scheduled Supabase function):
-- DELETE FROM matches WHERE status = 'finished' AND created_at < now() - interval '30 days';


-- =============================================================================
-- 4. HELPER RPCs (create if not already present)
-- =============================================================================

-- increment_votes: safe atomic vote increment for community_cards
CREATE OR REPLACE FUNCTION increment_votes(card_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE community_cards
  SET votes = votes + 1
  WHERE id = card_id;
$$;

-- Leaderboard view: top 100 players by ranked_rating
-- Used by LeaderboardTab — more efficient than full table scan
CREATE OR REPLACE VIEW leaderboard AS
  SELECT
    id,
    name,
    avatar_url,
    ranked_rating,
    ranked_wins,
    ranked_losses,
    battles_played,
    battles_won
  FROM profiles
  WHERE ranked_rating IS NOT NULL
  ORDER BY ranked_rating DESC
  LIMIT 100;

-- Grant read access to authenticated users
GRANT SELECT ON leaderboard TO authenticated;


-- =============================================================================
-- 5. REALTIME PUBLICATION
-- =============================================================================
-- Ensure matches and matchmaking are in the realtime publication so
-- postgres_changes subscriptions receive updates.

DO $$
BEGIN
  -- matches
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'matches'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE matches;
  END IF;

  -- matchmaking
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'matchmaking'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE matchmaking;
  END IF;
END $$;


-- =============================================================================
-- DONE
-- =============================================================================
-- Verify with:
--   SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
--   SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename;
--   SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public';

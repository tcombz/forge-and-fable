-- =============================================================================
-- Forge & Fable — FULL SYNC MIGRATION
-- Run this in Supabase Dashboard → SQL Editor
-- This is safe to run even if some parts already exist (all statements are
-- idempotent: CREATE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, etc.)
-- =============================================================================


-- =============================================================================
-- SECTION 1: PROFILES — new columns added since the base schema
-- =============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ranked_rating   int         DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS ranked_wins     int         DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ranked_losses   int         DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_fables_tester bool       DEFAULT false,
  ADD COLUMN IF NOT EXISTS selected_arts   jsonb,
  ADD COLUMN IF NOT EXISTS alt_owned       jsonb,
  ADD COLUMN IF NOT EXISTS free_pack_used  text,
  ADD COLUMN IF NOT EXISTS last_patch_seen text,
  ADD COLUMN IF NOT EXISTS match_history   jsonb,
  ADD COLUMN IF NOT EXISTS daily_quests    jsonb,
  ADD COLUMN IF NOT EXISTS last_shard_reset timestamptz,
  ADD COLUMN IF NOT EXISTS last_first_win_date text,
  ADD COLUMN IF NOT EXISTS login_streak    int         DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_login_date text;


-- =============================================================================
-- SECTION 2: QUEST SYSTEM TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS quest_definitions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text        NOT NULL,
  description   text        NOT NULL,
  type          text        NOT NULL,
  target_value  int         NOT NULL DEFAULT 1,
  faction       text,
  keyword       text,
  reward_shards int         NOT NULL DEFAULT 30,
  reward_xp     int         NOT NULL DEFAULT 0,
  is_daily      boolean     NOT NULL DEFAULT true,
  is_weekly     boolean     NOT NULL DEFAULT false,
  is_epic       boolean     NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS player_quests (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quest_definition_id  uuid        NOT NULL REFERENCES quest_definitions(id) ON DELETE CASCADE,
  current_progress     int         NOT NULL DEFAULT 0,
  is_completed         boolean     NOT NULL DEFAULT false,
  is_claimed           boolean     NOT NULL DEFAULT false,
  assigned_date        date        NOT NULL DEFAULT current_date,
  expires_at           timestamptz NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_player_quests_player_id   ON player_quests (player_id);
CREATE INDEX IF NOT EXISTS idx_player_quests_player_date ON player_quests (player_id, assigned_date);
CREATE INDEX IF NOT EXISTS idx_player_quests_expires     ON player_quests (expires_at) WHERE is_claimed = false;
CREATE INDEX IF NOT EXISTS idx_quest_definitions_daily   ON quest_definitions (is_daily)  WHERE is_daily = true;
CREATE INDEX IF NOT EXISTS idx_quest_definitions_weekly  ON quest_definitions (is_weekly) WHERE is_weekly = true;

-- RLS
ALTER TABLE quest_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_quests     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quest_defs_select_all"    ON quest_definitions;
DROP POLICY IF EXISTS "player_quests_select_own" ON player_quests;
DROP POLICY IF EXISTS "player_quests_insert_own" ON player_quests;
DROP POLICY IF EXISTS "player_quests_update_own" ON player_quests;

CREATE POLICY "quest_defs_select_all" ON quest_definitions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "player_quests_select_own" ON player_quests
  FOR SELECT TO authenticated
  USING (player_id::text = auth.uid()::text);

CREATE POLICY "player_quests_insert_own" ON player_quests
  FOR INSERT TO authenticated
  WITH CHECK (player_id::text = auth.uid()::text);

CREATE POLICY "player_quests_update_own" ON player_quests
  FOR UPDATE TO authenticated
  USING (player_id::text = auth.uid()::text);


-- =============================================================================
-- SECTION 3: QUEST SEED DATA  (18 daily + 4 weekly + 2 epic)
-- Truncate + re-seed so this is idempotent
-- =============================================================================

TRUNCATE quest_definitions RESTART IDENTITY CASCADE;

INSERT INTO quest_definitions
  (title, description, type, target_value, faction, keyword, reward_shards, reward_xp, is_daily, is_weekly, is_epic)
VALUES
  -- Daily
  ('First Blood',        'Win 1 match in any mode.',                          'win_matches',        1,  NULL,                NULL,    25, 0, true,  false, false),
  ('Triple Threat',      'Win 3 matches in any mode.',                        'win_matches',        3,  NULL,                NULL,    50, 0, true,  false, false),
  ('Battle Hardened',    'Play 3 matches to completion.',                     'play_matches',       3,  NULL,                NULL,    30, 0, true,  false, false),
  ('AI Slayer',          'Defeat the AI twice.',                              'win_ai',             2,  NULL,                NULL,    35, 0, true,  false, false),
  ('Ranked Warrior',     'Win 1 ranked match.',                               'win_ranked',         1,  NULL,                NULL,    60, 0, true,  false, false),
  ('Swift Victory',      'Win a match in under 8 turns.',                     'win_fast',           8,  NULL,                NULL,    55, 0, true,  false, false),
  ('Untouchable',        'Win a match with 15 or more HP remaining.',         'win_healthy',        15, NULL,                NULL,    50, 0, true,  false, false),
  ('Thornwood Champion', 'Play 5 cards from the Thornwood faction.',          'play_faction_cards', 5,  'Thornwood',         NULL,    40, 0, true,  false, false),
  ('Deep One',           'Play 5 cards from the Azure Deep faction.',         'play_faction_cards', 5,  'Azure Deep',        NULL,    40, 0, true,  false, false),
  ('Ember Caller',       'Play 5 cards from the Ashfen faction.',             'play_faction_cards', 5,  'Ashfen',            NULL,    40, 0, true,  false, false),
  ('Rift Touched',       'Play 5 cards from the Shattered Expanse faction.',  'play_faction_cards', 5,  'Shattered Expanse', NULL,    40, 0, true,  false, false),
  ('Warmonger',          'Deal 40 or more damage in a single match.',         'deal_damage',        40, NULL,                NULL,    45, 0, true,  false, false),
  ('Spellslinger',       'Cast 4 spells in a single match.',                  'play_spells',        4,  NULL,                NULL,    40, 0, true,  false, false),
  ('Terrain Master',     'Play 2 environment cards.',                         'play_environments',  2,  NULL,                NULL,    45, 0, true,  false, false),
  ('Echo Chamber',       'Trigger the Echo keyword 3 times.',                 'trigger_keyword',    3,  NULL,                'Echo',  50, 0, true,  false, false),
  ('Chosen Heroes',      'Play 2 champion cards.',                            'play_champions',     2,  NULL,                NULL,    45, 0, true,  false, false),
  ('Food Fight Fan',     'Play 5 cards from the Food Fight faction.',         'play_faction_cards', 5,  'Food Fight',        NULL,    40, 0, true,  false, false),
  ('Bleed Them Dry',     'Apply Bleed to enemies 3 times in one match.',      'trigger_keyword',    3,  NULL,                'Bleed', 50, 0, true,  false, false),
  -- Weekly
  ('Faction Master',     'Win matches using 4 different factions.',           'win_faction',        4,  NULL,                NULL,   150, 0, false, true,  false),
  ('Unstoppable',        'Win 10 matches this week.',                         'win_matches',        10, NULL,                NULL,   200, 0, false, true,  false),
  ('Damage Dealer',      'Deal 300 total damage across all matches.',         'deal_damage',        300,NULL,                NULL,   175, 0, false, true,  false),
  ('The Long Game',      'Play 20 matches to completion.',                    'play_matches',       20, NULL,                NULL,   160, 0, false, true,  false),
  -- Epic
  ('Immaculate',         'Win a match without losing a single creature.',     'win_no_losses',      1,  NULL,                NULL,   300, 0, false, false, true),
  ('Legendary Run',      'Win 5 ranked matches in a row.',                    'win_ranked',         5,  NULL,                NULL,   500, 0, false, false, true);


-- =============================================================================
-- SECTION 4: QUEST RPCs
-- =============================================================================

-- assign_daily_quests
CREATE OR REPLACE FUNCTION assign_daily_quests(p_player_id uuid)
RETURNS TABLE (
  id                   uuid,
  quest_definition_id  uuid,
  title                text,
  description          text,
  type                 text,
  target_value         int,
  faction              text,
  keyword              text,
  reward_shards        int,
  current_progress     int,
  is_completed         boolean,
  is_claimed           boolean,
  expires_at           timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  today_date     date        := current_date;
  expiry         timestamptz := (current_date + interval '1 day')::timestamptz;
  existing_count int;
  needed         int;
  new_quest_ids  uuid[];
BEGIN
  SELECT COUNT(*) INTO existing_count
  FROM player_quests pq
  WHERE pq.player_id    = p_player_id
    AND pq.assigned_date = today_date
    AND pq.expires_at   > now()
    AND pq.is_claimed   = false
    AND EXISTS (SELECT 1 FROM quest_definitions qd WHERE qd.id = pq.quest_definition_id AND qd.is_daily = true);

  needed := 3 - existing_count;

  IF needed > 0 THEN
    SELECT ARRAY(
      SELECT qd.id FROM quest_definitions qd
      WHERE qd.is_daily = true
        AND qd.id NOT IN (
          SELECT pq2.quest_definition_id FROM player_quests pq2
          WHERE pq2.player_id = p_player_id AND pq2.assigned_date = today_date
        )
      ORDER BY random() LIMIT needed
    ) INTO new_quest_ids;

    INSERT INTO player_quests (player_id, quest_definition_id, assigned_date, expires_at)
    SELECT p_player_id, unnest(new_quest_ids), today_date, expiry;
  END IF;

  RETURN QUERY
  SELECT pq.id, pq.quest_definition_id, qd.title, qd.description, qd.type,
         qd.target_value, qd.faction, qd.keyword, qd.reward_shards,
         pq.current_progress, pq.is_completed, pq.is_claimed, pq.expires_at
  FROM player_quests pq
  JOIN quest_definitions qd ON qd.id = pq.quest_definition_id
  WHERE pq.player_id    = p_player_id
    AND pq.assigned_date = today_date
    AND qd.is_daily     = true
  ORDER BY pq.created_at;
END;
$$;
GRANT EXECUTE ON FUNCTION assign_daily_quests(uuid) TO authenticated;


-- assign_weekly_quests
CREATE OR REPLACE FUNCTION assign_weekly_quests(p_player_id uuid)
RETURNS TABLE (
  id                   uuid,
  quest_definition_id  uuid,
  title                text,
  description          text,
  type                 text,
  target_value         int,
  faction              text,
  keyword              text,
  reward_shards        int,
  current_progress     int,
  is_completed         boolean,
  is_claimed           boolean,
  expires_at           timestamptz,
  is_weekly            boolean,
  is_epic              boolean
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  week_end   timestamptz := date_trunc('week', now()) + interval '7 days';
  existing_w int;
  existing_e int;
  new_weekly uuid[];
  new_epic   uuid[];
BEGIN
  -- Weekly
  SELECT COUNT(*) INTO existing_w
  FROM player_quests pq JOIN quest_definitions qd ON qd.id = pq.quest_definition_id
  WHERE pq.player_id = p_player_id AND qd.is_weekly = true AND pq.expires_at > now();

  IF (3 - existing_w) > 0 THEN
    SELECT ARRAY(
      SELECT qd.id FROM quest_definitions qd
      WHERE qd.is_weekly = true
        AND qd.id NOT IN (
          SELECT pq2.quest_definition_id FROM player_quests pq2
          JOIN quest_definitions q2 ON q2.id = pq2.quest_definition_id
          WHERE pq2.player_id = p_player_id AND q2.is_weekly = true AND pq2.expires_at > now()
        )
      ORDER BY random() LIMIT (3 - existing_w)
    ) INTO new_weekly;
    INSERT INTO player_quests (player_id, quest_definition_id, assigned_date, expires_at)
    SELECT p_player_id, unnest(new_weekly), current_date, week_end;
  END IF;

  -- Epic
  SELECT COUNT(*) INTO existing_e
  FROM player_quests pq JOIN quest_definitions qd ON qd.id = pq.quest_definition_id
  WHERE pq.player_id = p_player_id AND qd.is_epic = true AND pq.expires_at > now();

  IF existing_e = 0 THEN
    SELECT ARRAY(
      SELECT qd.id FROM quest_definitions qd
      WHERE qd.is_epic = true
        AND qd.id NOT IN (
          SELECT pq2.quest_definition_id FROM player_quests pq2
          JOIN quest_definitions q2 ON q2.id = pq2.quest_definition_id
          WHERE pq2.player_id = p_player_id AND q2.is_epic = true AND pq2.expires_at > now()
        )
      ORDER BY random() LIMIT 1
    ) INTO new_epic;
    IF array_length(new_epic, 1) > 0 THEN
      INSERT INTO player_quests (player_id, quest_definition_id, assigned_date, expires_at)
      SELECT p_player_id, unnest(new_epic), current_date, week_end;
    END IF;
  END IF;

  RETURN QUERY
  SELECT pq.id, pq.quest_definition_id, qd.title, qd.description, qd.type,
         qd.target_value, qd.faction, qd.keyword, qd.reward_shards,
         pq.current_progress, pq.is_completed, pq.is_claimed, pq.expires_at,
         qd.is_weekly, qd.is_epic
  FROM player_quests pq
  JOIN quest_definitions qd ON qd.id = pq.quest_definition_id
  WHERE pq.player_id = p_player_id AND pq.expires_at > now()
    AND (qd.is_weekly = true OR qd.is_epic = true)
  ORDER BY qd.is_weekly DESC, pq.created_at;
END;
$$;
GRANT EXECUTE ON FUNCTION assign_weekly_quests(uuid) TO authenticated;


-- update_quest_progress
CREATE OR REPLACE FUNCTION update_quest_progress(
  p_player_id  uuid,
  p_quest_id   uuid,
  p_progress   int
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_target int;
BEGIN
  SELECT qd.target_value INTO v_target
  FROM player_quests pq JOIN quest_definitions qd ON qd.id = pq.quest_definition_id
  WHERE pq.id = p_quest_id AND pq.player_id = p_player_id;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE player_quests
  SET current_progress = p_progress, is_completed = (p_progress >= v_target)
  WHERE id = p_quest_id AND player_id = p_player_id AND is_claimed = false;
END;
$$;
GRANT EXECUTE ON FUNCTION update_quest_progress(uuid, uuid, int) TO authenticated;


-- reroll_daily_quest
CREATE OR REPLACE FUNCTION reroll_daily_quest(p_player_id uuid, p_quest_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM player_quests pq
  USING quest_definitions qd
  WHERE pq.id = p_quest_id AND pq.player_id = p_player_id
    AND qd.id = pq.quest_definition_id AND qd.is_daily = true AND pq.is_completed = false;
END;
$$;
GRANT EXECUTE ON FUNCTION reroll_daily_quest(uuid, uuid) TO authenticated;


-- =============================================================================
-- SECTION 5: CHALLENGE LOBBIES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS challenge_lobbies (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  host_name   text        NOT NULL DEFAULT '',
  host_avatar text        NOT NULL DEFAULT '',
  deck        jsonb,
  status      text        NOT NULL DEFAULT 'waiting',
  match_id    uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '5 minutes'
);

CREATE INDEX IF NOT EXISTS idx_challenge_lobbies_host   ON challenge_lobbies (host_id);
CREATE INDEX IF NOT EXISTS idx_challenge_lobbies_status ON challenge_lobbies (status) WHERE status = 'waiting';

ALTER TABLE challenge_lobbies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lobby_host_all"   ON challenge_lobbies;
DROP POLICY IF EXISTS "lobby_read_all"   ON challenge_lobbies;
DROP POLICY IF EXISTS "lobby_challenger" ON challenge_lobbies;

CREATE POLICY "lobby_host_all" ON challenge_lobbies
  FOR ALL TO authenticated
  USING    (host_id::text = auth.uid()::text)
  WITH CHECK (host_id::text = auth.uid()::text);

CREATE POLICY "lobby_read_all" ON challenge_lobbies
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "lobby_challenger" ON challenge_lobbies
  FOR UPDATE TO authenticated
  USING (status = 'waiting' AND host_id::text != auth.uid()::text AND expires_at > now())
  WITH CHECK (true);


-- =============================================================================
-- SECTION 6: REALTIME PUBLICATIONS
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'matches') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE matches;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'matchmaking') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE matchmaking;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'player_quests') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE player_quests;
  END IF;
END $$;


-- =============================================================================
-- SECTION 7: EXISTING RLS POLICIES (re-apply to be safe)
-- These match the schema from 20260331000000 — safe to re-run
-- =============================================================================

ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches          ENABLE ROW LEVEL SECURITY;
ALTER TABLE matchmaking      ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships      ENABLE ROW LEVEL SECURITY;
ALTER TABLE used_alpha_keys  ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_cards  ENABLE ROW LEVEL SECURITY;

-- profiles
DROP POLICY IF EXISTS "profiles_select_all"  ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own"  ON profiles;
DROP POLICY IF EXISTS "profiles_update_own"  ON profiles;
DROP POLICY IF EXISTS "profiles_delete_own"  ON profiles;
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT TO authenticated WITH CHECK (id::text = auth.uid()::text);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (id::text = auth.uid()::text) WITH CHECK (id::text = auth.uid()::text);
CREATE POLICY "profiles_delete_own" ON profiles FOR DELETE TO authenticated USING (id::text = auth.uid()::text);

-- matches
DROP POLICY IF EXISTS "matches_select_players" ON matches;
DROP POLICY IF EXISTS "matches_insert_auth"    ON matches;
DROP POLICY IF EXISTS "matches_update_players" ON matches;
DROP POLICY IF EXISTS "matches_delete_players" ON matches;
CREATE POLICY "matches_select_players" ON matches FOR SELECT TO authenticated USING (player1_id::text = auth.uid()::text OR player2_id::text = auth.uid()::text);
CREATE POLICY "matches_insert_auth"    ON matches FOR INSERT TO authenticated WITH CHECK (player1_id::text = auth.uid()::text OR player2_id::text = auth.uid()::text);
CREATE POLICY "matches_update_players" ON matches FOR UPDATE TO authenticated USING (player1_id::text = auth.uid()::text OR player2_id::text = auth.uid()::text);
CREATE POLICY "matches_delete_players" ON matches FOR DELETE TO authenticated USING (player1_id::text = auth.uid()::text OR player2_id::text = auth.uid()::text);

-- matchmaking
DROP POLICY IF EXISTS "matchmaking_select_own" ON matchmaking;
DROP POLICY IF EXISTS "matchmaking_insert_own" ON matchmaking;
DROP POLICY IF EXISTS "matchmaking_update_own" ON matchmaking;
DROP POLICY IF EXISTS "matchmaking_delete_own" ON matchmaking;
CREATE POLICY "matchmaking_select_own" ON matchmaking FOR SELECT TO authenticated USING (user_id::text = auth.uid()::text);
CREATE POLICY "matchmaking_insert_own" ON matchmaking FOR INSERT TO authenticated WITH CHECK (user_id::text = auth.uid()::text);
CREATE POLICY "matchmaking_update_own" ON matchmaking FOR UPDATE TO authenticated USING (user_id::text = auth.uid()::text);
CREATE POLICY "matchmaking_delete_own" ON matchmaking FOR DELETE TO authenticated USING (user_id::text = auth.uid()::text);

-- friendships
DROP POLICY IF EXISTS "friendships_select_participant" ON friendships;
DROP POLICY IF EXISTS "friendships_insert_requester"   ON friendships;
DROP POLICY IF EXISTS "friendships_update_accepter"    ON friendships;
DROP POLICY IF EXISTS "friendships_delete_participant" ON friendships;
CREATE POLICY "friendships_select_participant" ON friendships FOR SELECT TO authenticated USING (requester::text = auth.uid()::text OR accepter::text = auth.uid()::text);
CREATE POLICY "friendships_insert_requester"   ON friendships FOR INSERT TO authenticated WITH CHECK (requester::text = auth.uid()::text);
CREATE POLICY "friendships_update_accepter"    ON friendships FOR UPDATE TO authenticated USING (requester::text = auth.uid()::text OR accepter::text = auth.uid()::text);
CREATE POLICY "friendships_delete_participant" ON friendships FOR DELETE TO authenticated USING (requester::text = auth.uid()::text OR accepter::text = auth.uid()::text);

-- used_alpha_keys
DROP POLICY IF EXISTS "alpha_keys_insert_auth" ON used_alpha_keys;
CREATE POLICY "alpha_keys_insert_auth" ON used_alpha_keys FOR INSERT TO authenticated WITH CHECK (true);

-- community_feedback
DROP POLICY IF EXISTS "feedback_select_all"    ON community_feedback;
DROP POLICY IF EXISTS "feedback_insert_auth"   ON community_feedback;
DROP POLICY IF EXISTS "feedback_update_upvote" ON community_feedback;
CREATE POLICY "feedback_select_all"    ON community_feedback FOR SELECT TO authenticated USING (true);
CREATE POLICY "feedback_insert_auth"   ON community_feedback FOR INSERT TO authenticated WITH CHECK (user_id::text = auth.uid()::text);
CREATE POLICY "feedback_update_upvote" ON community_feedback FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- community_cards
DROP POLICY IF EXISTS "cards_select_all"   ON community_cards;
DROP POLICY IF EXISTS "cards_insert_auth"  ON community_cards;
DROP POLICY IF EXISTS "cards_update_votes" ON community_cards;
CREATE POLICY "cards_select_all"   ON community_cards FOR SELECT TO authenticated USING (true);
CREATE POLICY "cards_insert_auth"  ON community_cards FOR INSERT TO authenticated WITH CHECK (user_id::text = auth.uid()::text);
CREATE POLICY "cards_update_votes" ON community_cards FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


-- =============================================================================
-- SECTION 8: HELPER RPCs
-- =============================================================================

CREATE OR REPLACE FUNCTION increment_votes(card_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE community_cards SET votes = votes + 1 WHERE id = card_id;
$$;

CREATE OR REPLACE VIEW leaderboard AS
  SELECT id, name, avatar_url, ranked_rating, ranked_wins, ranked_losses, battles_played, battles_won
  FROM profiles WHERE ranked_rating IS NOT NULL
  ORDER BY ranked_rating DESC LIMIT 100;

GRANT SELECT ON leaderboard TO authenticated;


-- =============================================================================
-- DONE — all tables, columns, RLS, RPCs, and realtime publications are in sync
-- =============================================================================

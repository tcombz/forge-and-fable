-- =============================================================================
-- Forge & Fable — Quest System Migration
-- 2026-04-02
-- Paste into Supabase Dashboard → SQL Editor and run.
-- =============================================================================


-- =============================================================================
-- 1. TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS quest_definitions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text        NOT NULL,
  description   text        NOT NULL,
  type          text        NOT NULL,  -- see type list below
  target_value  int         NOT NULL DEFAULT 1,
  faction       text,                  -- non-null for faction-specific quests
  keyword       text,                  -- non-null for keyword-specific quests
  reward_shards int         NOT NULL DEFAULT 30,
  reward_xp     int         NOT NULL DEFAULT 0,
  is_daily      boolean     NOT NULL DEFAULT true,
  is_weekly     boolean     NOT NULL DEFAULT false,
  is_epic       boolean     NOT NULL DEFAULT false
);

-- quest type reference:
--   win_matches          — win X matches (any mode)
--   win_ranked           — win X ranked matches
--   win_casual           — win X casual/AI matches
--   win_ai               — beat the AI X times
--   play_matches         — play (complete) X matches
--   win_fast             — win a match in under X turns
--   win_healthy          — win with X or more HP remaining
--   win_faction          — win a match using a deck with X+ cards from faction
--   play_faction_cards   — play X cards from a specific faction in one match
--   deal_damage          — deal X total damage in a single match
--   play_environments    — play X environment cards (any match)
--   play_spells          — play X spells in a single match
--   trigger_keyword      — trigger X instances of a specific keyword
--   play_champions       — play X champion cards (any match)
--   win_no_losses        — win a match without any of your creatures dying

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


-- =============================================================================
-- 2. INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_player_quests_player_id
  ON player_quests (player_id);

CREATE INDEX IF NOT EXISTS idx_player_quests_player_date
  ON player_quests (player_id, assigned_date);

CREATE INDEX IF NOT EXISTS idx_player_quests_expires
  ON player_quests (expires_at)
  WHERE is_claimed = false;

CREATE INDEX IF NOT EXISTS idx_quest_definitions_daily
  ON quest_definitions (is_daily)
  WHERE is_daily = true;

CREATE INDEX IF NOT EXISTS idx_quest_definitions_weekly
  ON quest_definitions (is_weekly)
  WHERE is_weekly = true;


-- =============================================================================
-- 3. ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE quest_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_quests     ENABLE ROW LEVEL SECURITY;

-- quest_definitions: anyone authenticated can read (client needs the full list)
DROP POLICY IF EXISTS "quest_defs_select_all" ON quest_definitions;
CREATE POLICY "quest_defs_select_all" ON quest_definitions
  FOR SELECT TO authenticated USING (true);

-- player_quests: players can only see and update their own rows
DROP POLICY IF EXISTS "player_quests_select_own"  ON player_quests;
DROP POLICY IF EXISTS "player_quests_insert_own"  ON player_quests;
DROP POLICY IF EXISTS "player_quests_update_own"  ON player_quests;

CREATE POLICY "player_quests_select_own" ON player_quests
  FOR SELECT TO authenticated
  USING (player_id::text = auth.uid()::text);

-- Insert is handled by the assign_daily_quests RPC (SECURITY DEFINER),
-- but allow direct insert for the client as a fallback.
CREATE POLICY "player_quests_insert_own" ON player_quests
  FOR INSERT TO authenticated
  WITH CHECK (player_id::text = auth.uid()::text);

-- Players can update their own rows (progress, claim)
CREATE POLICY "player_quests_update_own" ON player_quests
  FOR UPDATE TO authenticated
  USING (player_id::text = auth.uid()::text);


-- =============================================================================
-- 4. QUEST DEFINITIONS SEED DATA  (15 daily + 4 weekly + 2 epic)
-- =============================================================================

-- Clear and re-seed so this migration is idempotent
TRUNCATE quest_definitions RESTART IDENTITY CASCADE;

INSERT INTO quest_definitions
  (title, description, type, target_value, faction, keyword, reward_shards, reward_xp, is_daily, is_weekly, is_epic)
VALUES
  -- ── Daily quests ────────────────────────────────────────────────────────────
  ('First Blood',        'Win 1 match in any mode.',                         'win_matches',        1,  NULL,              NULL,     25,  0,  true,  false, false),
  ('Triple Threat',      'Win 3 matches in any mode.',                       'win_matches',        3,  NULL,              NULL,     50,  0,  true,  false, false),
  ('Battle Hardened',    'Play 3 matches to completion.',                    'play_matches',       3,  NULL,              NULL,     30,  0,  true,  false, false),
  ('AI Slayer',          'Defeat the AI twice.',                             'win_ai',             2,  NULL,              NULL,     35,  0,  true,  false, false),
  ('Ranked Warrior',     'Win 1 ranked match.',                              'win_ranked',         1,  NULL,              NULL,     60,  0,  true,  false, false),
  ('Swift Victory',      'Win a match in under 8 turns.',                    'win_fast',           8,  NULL,              NULL,     55,  0,  true,  false, false),
  ('Untouchable',        'Win a match with 15 or more HP remaining.',        'win_healthy',        15, NULL,              NULL,     50,  0,  true,  false, false),
  ('Thornwood Champion', 'Play 5 cards from the Thornwood faction.',         'play_faction_cards', 5,  'Thornwood',       NULL,     40,  0,  true,  false, false),
  ('Deep One',           'Play 5 cards from the Azure Deep faction.',        'play_faction_cards', 5,  'Azure Deep',      NULL,     40,  0,  true,  false, false),
  ('Ember Caller',       'Play 5 cards from the Ashfen faction.',            'play_faction_cards', 5,  'Ashfen',          NULL,     40,  0,  true,  false, false),
  ('Rift Touched',       'Play 5 cards from the Shattered Expanse faction.', 'play_faction_cards', 5,  'Shattered Expanse', NULL,  40,  0,  true,  false, false),
  ('Warmonger',          'Deal 40 or more damage in a single match.',        'deal_damage',        40, NULL,              NULL,     45,  0,  true,  false, false),
  ('Spellslinger',       'Cast 4 spells in a single match.',                 'play_spells',        4,  NULL,              NULL,     40,  0,  true,  false, false),
  ('Terrain Master',     'Play 2 environment cards.',                        'play_environments',  2,  NULL,              NULL,     45,  0,  true,  false, false),
  ('Echo Chamber',       'Trigger the Echo keyword 3 times.',                'trigger_keyword',    3,  NULL,              'Echo',   50,  0,  true,  false, false),
  ('Chosen Heroes',      'Play 2 champion cards.',                           'play_champions',     2,  NULL,              NULL,     45,  0,  true,  false, false),
  ('Food Fight Fan',     'Play 5 cards from the Food Fight faction.',        'play_faction_cards', 5,  'Food Fight',      NULL,     40,  0,  true,  false, false),
  ('Bleed Them Dry',     'Apply Bleed to enemies 3 times in one match.',     'trigger_keyword',    3,  NULL,              'Bleed',  50,  0,  true,  false, false),

  -- ── Weekly quests ───────────────────────────────────────────────────────────
  ('Faction Master',     'Win matches using 4 different factions.',          'win_faction',        4,  NULL,              NULL,     150, 0,  false, true,  false),
  ('Unstoppable',        'Win 10 matches this week.',                        'win_matches',        10, NULL,              NULL,     200, 0,  false, true,  false),
  ('Damage Dealer',      'Deal 300 total damage across all matches.',        'deal_damage',        300,NULL,              NULL,     175, 0,  false, true,  false),
  ('The Long Game',      'Play 20 matches to completion.',                   'play_matches',       20, NULL,              NULL,     160, 0,  false, true,  false),

  -- ── Epic quests ─────────────────────────────────────────────────────────────
  ('Immaculate',         'Win a match without losing a single creature.',    'win_no_losses',      1,  NULL,              NULL,     300, 0,  false, false, true),
  ('Legendary Run',      'Win 5 ranked matches in a row.',                   'win_ranked',         5,  NULL,              NULL,     500, 0,  false, false, true);


-- =============================================================================
-- 5. assign_daily_quests RPC
-- =============================================================================
-- Call from client: supabase.rpc('assign_daily_quests', { p_player_id: user.id })
-- Returns the player's active daily quests for today (up to 3).
-- If fewer than 3 exist, randomly assigns from the daily pool to reach 3.
-- Safe to call multiple times — idempotent for the same player+day.

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
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  today_date     date := current_date;
  expiry         timestamptz := (current_date + interval '1 day')::timestamptz;
  existing_count int;
  needed         int;
  new_quest_ids  uuid[];
BEGIN
  -- Count how many active daily quests the player already has today
  SELECT COUNT(*) INTO existing_count
  FROM player_quests pq
  WHERE pq.player_id = p_player_id
    AND pq.assigned_date = today_date
    AND pq.expires_at > now()
    AND pq.is_claimed = false
    AND EXISTS (
      SELECT 1 FROM quest_definitions qd
      WHERE qd.id = pq.quest_definition_id AND qd.is_daily = true
    );

  needed := 3 - existing_count;

  IF needed > 0 THEN
    -- Pick random daily quests not already assigned to this player today
    SELECT ARRAY(
      SELECT qd.id
      FROM quest_definitions qd
      WHERE qd.is_daily = true
        AND qd.id NOT IN (
          SELECT pq2.quest_definition_id
          FROM player_quests pq2
          WHERE pq2.player_id = p_player_id
            AND pq2.assigned_date = today_date
        )
      ORDER BY random()
      LIMIT needed
    ) INTO new_quest_ids;

    -- Insert the new assignments
    INSERT INTO player_quests (player_id, quest_definition_id, assigned_date, expires_at)
    SELECT p_player_id, unnest(new_quest_ids), today_date, expiry;
  END IF;

  -- Return all of today's daily quests for this player with definition details
  RETURN QUERY
  SELECT
    pq.id,
    pq.quest_definition_id,
    qd.title,
    qd.description,
    qd.type,
    qd.target_value,
    qd.faction,
    qd.keyword,
    qd.reward_shards,
    pq.current_progress,
    pq.is_completed,
    pq.is_claimed,
    pq.expires_at
  FROM player_quests pq
  JOIN quest_definitions qd ON qd.id = pq.quest_definition_id
  WHERE pq.player_id = p_player_id
    AND pq.assigned_date = today_date
    AND qd.is_daily = true
  ORDER BY pq.created_at;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION assign_daily_quests(uuid) TO authenticated;


-- =============================================================================
-- 6. update_quest_progress RPC
-- =============================================================================
-- Call after each match: supabase.rpc('update_quest_progress', { p_player_id, p_quest_id, p_progress })
-- Marks complete if progress >= target_value.

CREATE OR REPLACE FUNCTION update_quest_progress(
  p_player_id  uuid,
  p_quest_id   uuid,
  p_progress   int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_target int;
BEGIN
  SELECT qd.target_value INTO v_target
  FROM player_quests pq
  JOIN quest_definitions qd ON qd.id = pq.quest_definition_id
  WHERE pq.id = p_quest_id AND pq.player_id = p_player_id;

  IF NOT FOUND THEN RETURN; END IF;

  UPDATE player_quests
  SET
    current_progress = p_progress,
    is_completed = (p_progress >= v_target)
  WHERE id = p_quest_id
    AND player_id = p_player_id
    AND is_claimed = false;
END;
$$;

GRANT EXECUTE ON FUNCTION update_quest_progress(uuid, uuid, int) TO authenticated;


-- =============================================================================
-- 7. REALTIME
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'player_quests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE player_quests;
  END IF;
END $$;


-- =============================================================================
-- DONE
-- =============================================================================

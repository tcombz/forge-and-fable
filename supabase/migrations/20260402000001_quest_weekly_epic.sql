-- =============================================================================
-- Forge & Fable — Weekly & Epic Quest Assignment
-- 2026-04-02
-- Paste into Supabase Dashboard → SQL Editor and run AFTER the main quest
-- migration (20260402000000_quest_system.sql).
-- =============================================================================


-- =============================================================================
-- assign_weekly_quests RPC
-- =============================================================================
-- Idempotent: call on every login.
-- Assigns 3 weekly quests + 1 epic quest if the player has none active
-- for the current week (Mon 00:00 UTC → next Mon 00:00 UTC).
-- Returns all active weekly + epic quests for this player.

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
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  -- Current week runs Mon 00:00 UTC → next Mon 00:00 UTC
  week_end      timestamptz := date_trunc('week', now()) + interval '7 days';
  existing_w    int;
  existing_e    int;
  new_weekly    uuid[];
  new_epic      uuid[];
BEGIN
  -- ── Weekly quests ──────────────────────────────────────────────────────────
  SELECT COUNT(*) INTO existing_w
  FROM player_quests pq
  JOIN quest_definitions qd ON qd.id = pq.quest_definition_id
  WHERE pq.player_id = p_player_id
    AND qd.is_weekly   = true
    AND pq.expires_at  > now();

  IF (3 - existing_w) > 0 THEN
    SELECT ARRAY(
      SELECT qd.id FROM quest_definitions qd
      WHERE qd.is_weekly = true
        AND qd.id NOT IN (
          SELECT pq2.quest_definition_id
          FROM player_quests pq2
          JOIN quest_definitions q2 ON q2.id = pq2.quest_definition_id
          WHERE pq2.player_id = p_player_id
            AND q2.is_weekly  = true
            AND pq2.expires_at > now()
        )
      ORDER BY random()
      LIMIT (3 - existing_w)
    ) INTO new_weekly;

    INSERT INTO player_quests (player_id, quest_definition_id, assigned_date, expires_at)
    SELECT p_player_id, unnest(new_weekly), current_date, week_end;
  END IF;

  -- ── Epic quest (1 per week) ────────────────────────────────────────────────
  SELECT COUNT(*) INTO existing_e
  FROM player_quests pq
  JOIN quest_definitions qd ON qd.id = pq.quest_definition_id
  WHERE pq.player_id = p_player_id
    AND qd.is_epic    = true
    AND pq.expires_at > now();

  IF existing_e = 0 THEN
    SELECT ARRAY(
      SELECT qd.id FROM quest_definitions qd
      WHERE qd.is_epic = true
        AND qd.id NOT IN (
          SELECT pq2.quest_definition_id
          FROM player_quests pq2
          JOIN quest_definitions q2 ON q2.id = pq2.quest_definition_id
          WHERE pq2.player_id = p_player_id
            AND q2.is_epic    = true
            AND pq2.expires_at > now()
        )
      ORDER BY random()
      LIMIT 1
    ) INTO new_epic;

    IF array_length(new_epic, 1) > 0 THEN
      INSERT INTO player_quests (player_id, quest_definition_id, assigned_date, expires_at)
      SELECT p_player_id, unnest(new_epic), current_date, week_end;
    END IF;
  END IF;

  -- ── Return all active weekly + epic quests ─────────────────────────────────
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
    pq.expires_at,
    qd.is_weekly,
    qd.is_epic
  FROM player_quests pq
  JOIN quest_definitions qd ON qd.id = pq.quest_definition_id
  WHERE pq.player_id = p_player_id
    AND pq.expires_at > now()
    AND (qd.is_weekly = true OR qd.is_epic = true)
  ORDER BY qd.is_weekly DESC, pq.created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION assign_weekly_quests(uuid) TO authenticated;


-- =============================================================================
-- reroll_daily_quest RPC
-- =============================================================================
-- Deletes one daily quest row and assigns a fresh one.
-- Called by the client "Reroll" button (once per day, enforced client-side).

CREATE OR REPLACE FUNCTION reroll_daily_quest(
  p_player_id  uuid,
  p_quest_id   uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Remove the quest only if it's the player's own, daily, uncompleted
  DELETE FROM player_quests pq
  USING quest_definitions qd
  WHERE pq.id                  = p_quest_id
    AND pq.player_id           = p_player_id
    AND qd.id                  = pq.quest_definition_id
    AND qd.is_daily            = true
    AND pq.is_completed        = false;

  -- assign_daily_quests will top back up to 3 on next call
END;
$$;

GRANT EXECUTE ON FUNCTION reroll_daily_quest(uuid, uuid) TO authenticated;


-- =============================================================================
-- Optional: pg_cron weekly reset (requires pg_cron extension)
-- =============================================================================
-- Expired quests are passively hidden by the expires_at filter, so no active
-- cleanup is strictly required. The lines below add an optional Monday 00:05
-- UTC job that purges old claimed rows to keep the table tidy.
--
-- Uncomment if pg_cron is enabled on your Supabase project:
--
-- SELECT cron.schedule(
--   'weekly-quest-cleanup',
--   '5 0 * * 1',  -- Monday 00:05 UTC
--   $$DELETE FROM player_quests
--     WHERE expires_at < now() - interval '1 day'
--       AND is_claimed = true;$$
-- );


-- =============================================================================
-- DONE
-- =============================================================================

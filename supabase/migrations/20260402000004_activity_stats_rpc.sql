-- =============================================================================
-- Forge & Fable — Global Activity Stats RPC
-- 2026-04-02
-- Paste into Supabase Dashboard → SQL Editor
--
-- The matches table has restrictive RLS (players can only see their own matches).
-- This SECURITY DEFINER function bypasses RLS to return global activity counts
-- and recent battle data for the LiveActivityWidget.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_activity_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today_midnight timestamptz := date_trunc('day', now() AT TIME ZONE 'UTC');
  recent_data    jsonb;
BEGIN
  SELECT jsonb_agg(row_to_json(t))
  INTO recent_data
  FROM (
    SELECT
      id,
      game_state->>'p1Name'  AS p1_name,
      game_state->>'p2Name'  AS p2_name,
      game_state->>'winner'  AS winner,
      COALESCE((game_state->>'ranked')::boolean, false) AS ranked
    FROM matches
    WHERE game_state->>'winner' IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 5
  ) t;

  RETURN jsonb_build_object(
    'active_matches', (SELECT COUNT(*) FROM matches WHERE status = 'active'),
    'today_matches',  (SELECT COUNT(*) FROM matches WHERE created_at >= today_midnight),
    'recent_matches', COALESCE(recent_data, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_activity_stats() TO authenticated;
-- Also grant to anon so the landing page can show stats before login
GRANT EXECUTE ON FUNCTION get_activity_stats() TO anon;

-- =============================================================================
-- DONE
-- =============================================================================

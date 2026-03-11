// Forge & Fable — PvP Action Validator Edge Function
// Deploy: supabase functions deploy pvp-action
// This function validates and applies PvP moves server-side to prevent cheating.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get the calling user from JWT
    const authHeader = req.headers.get("Authorization")!;
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const { matchId, action } = await req.json();
    if (!matchId || !action) return json({ error: "Missing matchId or action" }, 400);

    // Fetch match
    const { data: match, error: matchErr } = await supabase
      .from("matches")
      .select("*")
      .eq("id", matchId)
      .single();

    if (matchErr || !match) return json({ error: "Match not found" }, 404);
    if (match.status !== "active") return json({ error: "Match is not active" }, 400);

    const gs = match.game_state;
    if (!gs) return json({ error: "No game state" }, 400);

    // Determine role
    const role = match.player1_id === user.id ? "p1" : match.player2_id === user.id ? "p2" : null;
    if (!role) return json({ error: "You are not a player in this match" }, 403);

    // Validate it's this player's turn
    if (gs.phase !== role) return json({ error: "Not your turn" }, 400);
    if (gs.winner) return json({ error: "Match already over" }, 400);

    // Apply action
    let newGs = JSON.parse(JSON.stringify(gs)); // deep clone
    const op = role === "p1" ? "p2" : "p1";

    switch (action.type) {

      case "end_turn": {
        const newTurn = role === "p2" ? gs.turn + 1 : gs.turn;
        const newMax = Math.min(10, newTurn + 1);
        newGs.phase = op;
        newGs.turn = newTurn;
        newGs[op + "Energy"] = newMax;
        newGs[op + "Max"] = newMax;
        // Reset my board's attack flags
        newGs[role + "Board"] = (gs[role + "Board"] || []).map((c: any) => ({ ...c, hasAttacked: false, canAttack: true }));
        // Bleed opponent
        newGs[op + "Board"] = (gs[op + "Board"] || [])
          .map((c: any) => c.bleed > 0 ? { ...c, currentHp: c.currentHp - c.bleed } : c)
          .filter((c: any) => c.currentHp > 0);
        // Draw for opponent
        if ((newGs[op + "Deck"] || []).length > 0) {
          const [drawn, ...rest] = newGs[op + "Deck"];
          newGs[op + "Hand"] = [...(newGs[op + "Hand"] || []), drawn];
          newGs[op + "Deck"] = rest;
        }
        newGs.log = [...(gs.log || []).slice(-20), `Turn ${gs.turn} ended.`];
        break;
      }

      case "attack_face": {
        const { attackerUid } = action;
        const att = (gs[role + "Board"] || []).find((c: any) => c.uid === attackerUid);
        if (!att) return json({ error: "Attacker not found" }, 400);
        if (att.hasAttacked) return json({ error: "Already attacked" }, 400);
        if (!att.canAttack) return json({ error: "Cannot attack yet" }, 400);
        // Must have no enemy creatures to attack face
        if ((gs[op + "Board"] || []).length > 0) return json({ error: "Must attack a creature first" }, 400);
        const dmg = att.currentAtk;
        newGs[op + "HP"] = gs[op + "HP"] - dmg;
        newGs[role + "Board"] = gs[role + "Board"].map((c: any) => c.uid === attackerUid ? { ...c, hasAttacked: true } : c);
        newGs.log = [...(gs.log || []).slice(-20), `${att.name} deals ${dmg} direct!`];
        if (newGs[op + "HP"] <= 0) { newGs.winner = role; newGs.log = [...newGs.log, "Victory!"]; }
        break;
      }

      case "attack_creature": {
        const { attackerUid, targetUid } = action;
        const att = (gs[role + "Board"] || []).find((c: any) => c.uid === attackerUid);
        const tgt = (gs[op + "Board"] || []).find((c: any) => c.uid === targetUid);
        if (!att || !tgt) return json({ error: "Attacker or target not found" }, 400);
        if (att.hasAttacked) return json({ error: "Already attacked" }, 400);
        if (!att.canAttack) return json({ error: "Cannot attack yet" }, 400);
        const av = att.currentAtk;
        const nTHP = tgt.shielded ? tgt.currentHp : tgt.currentHp - av;
        const nAHP = att.currentHp - tgt.currentAtk;
        newGs[op + "Board"] = gs[op + "Board"]
          .map((c: any) => c.uid === targetUid ? { ...c, currentHp: nTHP, shielded: false } : c)
          .filter((c: any) => c.currentHp > 0);
        newGs[role + "Board"] = gs[role + "Board"]
          .map((c: any) => c.uid === attackerUid ? { ...c, hasAttacked: true, currentHp: nAHP } : c)
          .filter((c: any) => c.currentHp > 0);
        newGs.log = [...(gs.log || []).slice(-20), `${att.name}(${av}) attacks ${tgt.name}`];
        if (nTHP <= 0) newGs.log = [...newGs.log, `${tgt.name} destroyed!`];
        if (nAHP <= 0) newGs.log = [...newGs.log, `${att.name} falls.`];
        if (newGs[op + "HP"] <= 0) { newGs.winner = role; }
        break;
      }

      case "play_card": {
        const { cardUid } = action;
        const card = (gs[role + "Hand"] || []).find((c: any) => c.uid === cardUid);
        if (!card) return json({ error: "Card not in hand" }, 400);
        const energy = gs[role + "Energy"];
        const hp = gs[role + "HP"];
        const canAfford = card.bloodpact ? card.cost < hp : card.cost <= energy;
        if (!canAfford) return json({ error: "Cannot afford card" }, 400);
        newGs[role + "Hand"] = gs[role + "Hand"].filter((c: any) => c.uid !== cardUid);
        if (card.bloodpact) { newGs[role + "HP"] = hp - card.cost; }
        else { newGs[role + "Energy"] = energy - card.cost; }
        if (card.type === "creature" || card.type === "champion") {
          if ((gs[role + "Board"] || []).length >= 5) return json({ error: "Board full" }, 400);
          const inst = { ...card, currentHp: card.hp, maxHp: card.hp, currentAtk: card.atk, canAttack: (card.keywords||[]).includes("Swift"), hasAttacked: false, bleed: 0 };
          newGs[role + "Board"] = [...(gs[role + "Board"] || []), inst];
        } else if (card.type === "environment") {
          newGs.env = { ...card, owner: role };
        }
        newGs.log = [...(gs.log || []).slice(-20), `Play ${card.name}!`];
        break;
      }

      default:
        return json({ error: `Unknown action type: ${action.type}` }, 400);
    }

    // Persist new game state
    const { error: updateErr } = await supabase
      .from("matches")
      .update({ game_state: newGs, status: newGs.winner ? "finished" : "active" })
      .eq("id", matchId);

    if (updateErr) return json({ error: "Failed to update game state" }, 500);

    return json({ ok: true, game_state: newGs });

  } catch (err) {
    console.error(err);
    return json({ error: "Internal error" }, 500);
  }
});

function json(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

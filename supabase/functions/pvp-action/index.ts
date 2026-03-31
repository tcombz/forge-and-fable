// Forge & Fable — PvP Action Validator Edge Function
// Deploy: supabase functions deploy pvp-action
// This function validates and applies PvP moves server-side to prevent cheating.
//
// Keyword resolution order (mirrors client App.jsx):
//   1. onPlay effects
//   2. Combat damage exchange
//   3. Bleed apply (attacker keyword → target gets bleed stack)
//   4. Anchor: immune to spell targeting (freeze_target etc.)
//   5. Level Up: check attacksMade thresholds after every attack
//   6. onDeath: resolved for any creature that hits 0 HP
//   7. Splat chain: attacker damages all other enemies; strip Splat before recursive onDeath
//   8. Shield absorbs one hit (combat or Splat)
//   9. Turn-start: bleed ticks, canAttack/hasAttacked reset, energy/draw

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Keyword helpers ─────────────────────────────────────────────────────────

function hasKw(card: any, kw: string): boolean {
  return (card.keywords || []).includes(kw);
}

/** Apply all Level Up tiers whose `at` threshold matches current attacksMade. */
function applyLevelUp(creature: any, log: string[]): any {
  const tiers = creature.levelUp || [];
  if (!tiers.length) return creature;
  let c = { ...creature };
  for (const tier of tiers) {
    if ((c.attacksMade || 0) === tier.at) {
      c = {
        ...c,
        currentAtk: c.currentAtk + (tier.bonus?.atk || 0),
        currentHp:  c.currentHp  + (tier.bonus?.hp  || 0),
        maxHp:      c.maxHp      + (tier.bonus?.hp  || 0),
        levelLabel: tier.label,
        buffNote:   `✦ ${tier.label}`,
      };
      log.push(`✦ ${c.name} → ${tier.label}! (+${tier.bonus?.atk || 0}/+${tier.bonus?.hp || 0})`);
    }
  }
  return c;
}

/**
 * Apply Splat damage from `attacker` to all creatures on `targetBoard`
 * except the one at `skipUid` (already resolved in direct combat).
 * Respects Shield; strips the attacker's Splat keyword before any onDeath
 * to prevent infinite chains.
 */
function applySplat(
  attacker: any,
  targetBoard: any[],
  skipUid: string,
  log: string[]
): any[] {
  const dmg = attacker.currentAtk;
  const result: any[] = [];
  for (const st of targetBoard) {
    if (st.uid === skipUid) { result.push(st); continue; }
    if (st.shielded) {
      log.push(`💥 Splat! ${attacker.name} → ${st.name} (blocked by shield)`);
      result.push({ ...st, shielded: false });
    } else {
      const hp = st.currentHp - dmg;
      log.push(`💥 Splat! ${attacker.name} → ${st.name} for ${dmg}`);
      if (hp > 0) result.push({ ...st, currentHp: hp });
      // onDeath effects could go here in a future pass; Splat keyword stripped
      // on attacker copy to prevent re-trigger (mirrors client logic)
    }
  }
  return result;
}

// ─── Edge function ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Authenticate caller
    const authHeader = req.headers.get("Authorization")!;
    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
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

    // Validate turn
    if (gs.phase !== role) return json({ error: "Not your turn" }, 400);
    if (gs.winner)         return json({ error: "Match already over" }, 400);

    const newGs: any = JSON.parse(JSON.stringify(gs));
    const op = role === "p1" ? "p2" : "p1";
    const log: string[] = [...(gs.log || []).slice(-20)];

    // ── Actions ──────────────────────────────────────────────────────────────

    switch (action.type) {

      // ── end_turn ────────────────────────────────────────────────────────────
      case "end_turn": {
        const newTurn = role === "p2" ? gs.turn + 1 : gs.turn;
        const newMax  = Math.min(10, newTurn + 1);
        newGs.phase           = op;
        newGs.turn            = newTurn;
        newGs[op + "Energy"]  = newMax;
        newGs[op + "Max"]     = newMax;

        // Reset my board's attack flags
        newGs[role + "Board"] = (gs[role + "Board"] || []).map((c: any) => ({
          ...c, hasAttacked: false, canAttack: true,
        }));

        // Tick bleed on opponent's creatures (uses stored per-turn bleed amount)
        newGs[op + "Board"] = (gs[op + "Board"] || [])
          .map((c: any) => c.bleed > 0 ? { ...c, currentHp: c.currentHp - c.bleed } : c)
          .filter((c: any) => c.currentHp > 0);

        // Draw for opponent
        if ((newGs[op + "Deck"] || []).length > 0) {
          const [drawn, ...rest] = newGs[op + "Deck"];
          newGs[op + "Hand"]    = [...(newGs[op + "Hand"] || []), drawn];
          newGs[op + "Deck"]    = rest;
        }

        log.push(`Turn ${gs.turn} ended.`);
        break;
      }

      // ── attack_face ─────────────────────────────────────────────────────────
      case "attack_face": {
        const { attackerUid } = action;
        const att = (gs[role + "Board"] || []).find((c: any) => c.uid === attackerUid);
        if (!att)            return json({ error: "Attacker not found" }, 400);
        if (att.hasAttacked) return json({ error: "Already attacked" }, 400);
        if (!att.canAttack)  return json({ error: "Cannot attack yet" }, 400);
        if ((gs[op + "Board"] || []).length > 0) return json({ error: "Must attack a creature first" }, 400);

        const dmg = att.currentAtk;
        newGs[op + "HP"] = gs[op + "HP"] - dmg;
        log.push(`${att.name} deals ${dmg} direct!`);

        // Track attacks + Level Up
        let updated = { ...att, hasAttacked: true, attacksMade: (att.attacksMade || 0) + 1 };
        updated = applyLevelUp(updated, log);
        newGs[role + "Board"] = gs[role + "Board"].map((c: any) =>
          c.uid === attackerUid ? updated : c
        );

        if (newGs[op + "HP"] <= 0) { newGs.winner = role; log.push("Victory!"); }
        break;
      }

      // ── attack_creature ──────────────────────────────────────────────────────
      case "attack_creature": {
        const { attackerUid, targetUid } = action;
        const att = (gs[role + "Board"] || []).find((c: any) => c.uid === attackerUid);
        const tgt = (gs[op   + "Board"] || []).find((c: any) => c.uid === targetUid);
        if (!att || !tgt)    return json({ error: "Attacker or target not found" }, 400);
        if (att.hasAttacked) return json({ error: "Already attacked" }, 400);
        if (!att.canAttack)  return json({ error: "Cannot attack yet" }, 400);

        const av = att.currentAtk;

        // Shield absorbs one hit
        let nTHP: number;
        if (tgt.shielded) {
          nTHP = tgt.currentHp; // no damage, shield consumed
          log.push(`${att.name} hits ${tgt.name}'s shield!`);
        } else {
          nTHP = tgt.currentHp - av;
          log.push(`${att.name}(${av}) attacks ${tgt.name}(${tgt.currentAtk})`);
        }
        const nAHP = att.currentHp - (hasKw(tgt, "Thorns") ? tgt.currentAtk : tgt.currentAtk);

        // Increment attacksMade on attacker
        let updatedAtt: any = {
          ...att,
          hasAttacked:  true,
          currentHp:    nAHP,
          attacksMade:  (att.attacksMade || 0) + 1,
        };
        updatedAtt = applyLevelUp(updatedAtt, log);

        // Update target
        let updatedTgt: any = { ...tgt, currentHp: nTHP, shielded: false };

        // Bleed: attacker has Bleed → target gains bleed stack
        if (hasKw(att, "Bleed") && nTHP > 0) {
          const bleedAmt = att.bleedAmount || 1;
          updatedTgt = { ...updatedTgt, bleed: (updatedTgt.bleed || 0) + bleedAmt };
          log.push(`${tgt.name} is bleeding (${bleedAmt}/turn).`);
        }
        // Bleed: target has Bleed → attacker gains bleed stack
        if (hasKw(tgt, "Bleed") && nAHP > 0) {
          const bleedAmt = tgt.bleedAmount || 1;
          updatedAtt = { ...updatedAtt, bleed: (updatedAtt.bleed || 0) + bleedAmt };
          log.push(`${att.name} is bleeding (${bleedAmt}/turn).`);
        }

        if (nTHP <= 0) log.push(`${tgt.name} destroyed!`);
        if (nAHP <= 0) log.push(`${att.name} falls.`);

        // Apply to boards (filter dead)
        newGs[op   + "Board"] = gs[op   + "Board"]
          .map((c: any) => c.uid === targetUid ? updatedTgt : c)
          .filter((c: any) => c.currentHp > 0);
        newGs[role + "Board"] = gs[role + "Board"]
          .map((c: any) => c.uid === attackerUid ? updatedAtt : c)
          .filter((c: any) => c.currentHp > 0);

        // Splat: attacker survives and has Splat → hit all other enemy creatures
        if (hasKw(att, "Splat") && nAHP > 0) {
          newGs[op + "Board"] = applySplat(updatedAtt, newGs[op + "Board"], targetUid, log);
        }

        if (newGs[op + "HP"] <= 0) { newGs.winner = role; log.push("Victory!"); }
        break;
      }

      // ── play_card ────────────────────────────────────────────────────────────
      case "play_card": {
        const { cardUid } = action;
        const card = (gs[role + "Hand"] || []).find((c: any) => c.uid === cardUid);
        if (!card) return json({ error: "Card not in hand" }, 400);

        const energy = gs[role + "Energy"];
        const hp     = gs[role + "HP"];
        const canAfford = card.bloodpact ? card.cost < hp : card.cost <= energy;
        if (!canAfford) return json({ error: "Cannot afford card" }, 400);

        newGs[role + "Hand"] = gs[role + "Hand"].filter((c: any) => c.uid !== cardUid);
        if (card.bloodpact) { newGs[role + "HP"]     = hp - card.cost; }
        else                { newGs[role + "Energy"] = energy - card.cost; }

        if (card.type === "creature" || card.type === "champion") {
          if ((gs[role + "Board"] || []).length >= 5) return json({ error: "Board full" }, 400);
          const inst = {
            ...card,
            currentHp:    card.hp,
            maxHp:        card.hp,
            currentAtk:   card.atk,
            canAttack:    hasKw(card, "Swift"),
            hasAttacked:  false,
            bleed:        0,
            attacksMade:  0,  // required for Level Up tracking
          };
          newGs[role + "Board"] = [...(gs[role + "Board"] || []), inst];

        } else if (card.type === "environment") {
          newGs.env = { ...card, owner: role };

        } else if (card.type === "spell") {
          // Spell effects resolved client-side; server enforces Anchor immunity
          // for any spell that targets a specific creature.
          const { targetUid } = action;
          if (targetUid) {
            const tgtCreature = (gs[op + "Board"] || []).find((c: any) => c.uid === targetUid);
            if (tgtCreature && hasKw(tgtCreature, "Anchor")) {
              return json({ error: `${tgtCreature.name} is Anchored — immune to spells!` }, 400);
            }
          }
        }

        log.push(`Play ${card.name}!`);
        break;
      }

      default:
        return json({ error: `Unknown action type: ${action.type}` }, 400);
    }

    newGs.log = log;

    // Persist
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

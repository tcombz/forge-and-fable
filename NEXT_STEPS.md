# Forge & Fable — Next Steps (Post v1.5)

---

## IMMEDIATE (Before Next Session)

### 1. Save Velrun Anime Island Art
- Drop the image into: `public/alt-art/velrun-anime-island.jpg`
- It will auto-appear in collection for anyone who owns Velrun

### 2. Deploy Edge Function (PvP Validation)
```bash
npx supabase login
npx supabase link --project-ref gzeftiuvfjcjvsfsefha
npx supabase functions deploy pvp-action
```
Then in the frontend (PvpBattleScreen), replace direct `supabase.from("matches").update(...)` calls
with calls to the edge function:
```js
await supabase.functions.invoke("pvp-action", {
  body: { matchId, action: { type: "end_turn" } }
});
```

### 3. Deploy to Production
```bash
npm run build
# Push dist/ to Vercel / Netlify / your host
```

---

## NEXT SESSION PRIORITIES

### A. Anime Island Card Set
- 32 anime-style alt arts (one per existing card) — created externally, dropped in `/public/alt-art/`
- Legendary card arts should be hardest to get (separate pack tier)
- Add `Anime Island Pack` to the store with its own pack odds:
  - Common alt: 60% | Uncommon alt: 25% | Rare alt: 10% | Epic alt: 4% | Legendary alt: 1%
- Register each alt in the `ALT_ARTS` constant (already structured for this)
- Remove `freeForOwners: true` from Velrun once the pack launches

### B. Match History on Profile
- Add `match_history jsonb[]` column to `profiles` table
- After each battle ends, append `{ opponent, result, date, turns }` to history
- Show last 10 matches on the Profile page with W/L badge and opponent name

### C. Deck Builder — Move to Collection Tab
- User asked to move the Deck Builder button from Battle Setup → Collection page
- Add a "DECKS" section at the bottom of CollectionScreen
- Show saved decks with edit/delete options

### D. Navigation Bar Improvements
- Make the nav tabs larger and easier to read (bigger font, icon + label)
- Consider a left-side rail nav on desktop instead of top tabs
- Add active state glow on current tab

### E. Edge Function Integration (Full PvP)
- Wire up all PvP actions to go through `pvp-action` edge function instead of direct DB writes
- This prevents: playing cards you can't afford, attacking out of turn, injecting fake game state
- The function file is already created at `supabase/functions/pvp-action/index.ts`

### F. New Card Set — Content
- Design the next set of cards (Thornwood expansion? Bloodpact creatures?)
- Update `POOL` array with new card data
- Add to pack odds tables

### G. Shard Economy Polish
- Weekly free pack (currently gives 30 shards on Friday reset — working)
- Consider: Daily login bonus (5 shards/day)
- Consider: Win bonus (+3 shards per PvP win)

### H. Admin Panel (Future)
- Simple admin route (password-gated) to:
  - View active matches
  - Ban/unban users
  - Grant alpha keys
  - Give shards to users

---

## KNOWN BUGS TO TRACK

| Bug | Status | Notes |
|-----|--------|-------|
| Photo upload not persisting | Needs re-test | Supabase Storage bucket `avatars` must be public |
| Shards not always deducting | Needs re-test | Check browser console for RLS errors on pack buy |
| Matchmaking: player A waits | Fixed v1.5 | Polling fallback added + Realtime now enabled |
| Cards different sizes | Fixed v1.5 | Full-art cards all same height now |

---

## INFRASTRUCTURE CHECKLIST

- [x] Supabase Auth (email + password)
- [x] Supabase Realtime on `matchmaking` + `matches`
- [x] `profiles` table with RLS
- [x] `matchmaking` table with RLS
- [x] `matches` table with RLS
- [x] `avatars` storage bucket (verify: public access)
- [x] `selected_arts` column on profiles
- [ ] `match_history` column on profiles (next session)
- [ ] Edge function deployed
- [ ] Anime Island pack in store

---

## ARCHITECTURE NOTES

- All game logic lives in `src/App.jsx` (single file, ~1800 lines)
- Audio: extracted MP3s at `/public/music-home.mp3` and `/public/music-battle.mp3`
- Alt art images: `/public/alt-art/<card-id>-<set-id>.jpg`
- Edge functions: `/supabase/functions/<name>/index.ts`
- Card pool: `POOL` array in App.jsx (~line 320)
- Alt arts: `ALT_ARTS` object in App.jsx (~line 478)
- Rarity glow colors: `RARITY_GLOW` constant

---

*Generated end of session v1.5 — Forge & Fable*

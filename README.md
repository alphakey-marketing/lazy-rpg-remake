# Lazy RPG Remake（懶貓勇者）

Idle RPG for phones, portrait layout. Remake of `lazy-rpg-1` with a new core and a new look.

## Run

```bash
npm install
npm run dev        # http://localhost:5173 (also reachable from a phone on the same LAN)
npm test           # 20 core tests
npm run build      # typecheck + production build to dist/
npx vite-node scripts/balance.ts arcanist 12          # bot plays 12h, prints pacing
REBIRTH=1 npx vite-node scripts/balance.ts ranger 10  # same, with rebirth
```

In dev, `window.game` in the browser console is the store (for example `game.act(g => g.gold += 1e6)`).

## Architecture

```
src/config/   balance.ts (every number), content.ts (jobs, biomes, monster families)
src/core/     pure TS, no DOM. Deterministic sim (seeded RNG in save)
  sim.ts        tick(state, dt, rng, emit) – same code live (0.05s) and offline (0.5s)
  offline.ts    catch-up up to 8h (+ perk), returns summary for popup
  actions.ts    every player action (train, refine, rebirth, shop…)
  save.ts       versioned save + migrations + deep default fill
src/services/ ads.ts (fake rewarded ads – swap for AdMob), feedback.ts (WebAudio sfx, haptics)
src/ui/       React UI + Canvas2D battle renderer (procedural art, no image assets)
scripts/      balance.ts – headless bot for pacing tuning
tests/        vitest
```

The sim emits events (`heroHit`, `kill`, `loot`, `bossWin`…) and the renderer and UI only react to them. You can swap the renderer for PixiJS or Spine without touching game logic.

## Game loop

- Auto battle. 10 kills, then a Boss; winning advances one stage. Dying drops you back one stage, so you never get stuck.
- 8 biomes repeat. Each loop is darker and stronger.
- Gold goes into training (a ×1.3 milestone every 25 levels). Gear has 6 rarities with auto-equip and auto-salvage.
- Refine goes up to +15 and **never destroys** an item. A failure at +5 or higher drops one level; a charm prevents that.
- Job change at Lv12 and Lv45. Each job has its own skill.
- Corruption (Kuro's pact), from stage 15: stronger monsters, better loot.
- Rebirth, from stage 40: soul shards, then permanent perks.
- Daily quests, 7-day login, gem shop and rewarded ads (offline ×2, free gems 5 times a day).

Pacing from the bot, no rebirth: stage 12 at 5 min, 23 at 10 min, 40 at 1 h, a wall around 50 at 3–5 h. Rebirth then pushes the max stage to about 85 by 10 h.

## Assumptions

- All names and art are original (no Ragnarok IP). The UI language is Cantonese / zh-HK only for now.
- Ads and IAP are stubs. Monthly card, ad removal and starter pack show "即將推出" (coming soon).
- The save lives only in localStorage. There is no server and no cloud save yet.

## Next steps

1. Wrap with Capacitor for Android and iOS, then add a splash screen, icon and status bar.
2. Real art: Spine or sprite sheets for the hero and monsters, plus a bigger VFX pass.
3. AdMob rewarded ads and RevenueCat IAP behind `services/ads.ts`.
4. Cloud save (Firebase or Play Games) and anti-tamper checks on the save.
5. i18n (en, zh-TW), analytics funnel (tutorial, D1/D7), remote-config balance.
6. More content: pets, guild boss, an event stage and more jobs.

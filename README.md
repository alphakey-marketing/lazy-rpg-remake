# Lazy RPG Remake（懶貓勇者）

Idle RPG for phones, portrait layout. Remake of `lazy-rpg-1` with a new core and a new look.

## Run

```bash
npm install
npm run dev        # http://localhost:5173 (also reachable from a phone on the same LAN)
npm test           # core, jobs, tower, achievements and renderer regression tests
npm run build      # typecheck + production build to dist/
npm run first-session -- 20  # audit first 15 min across 20 seeds / player profile
npx vite-node scripts/balance.ts arcanist 12          # bot plays 12h, prints pacing
REBIRTH=1 npx vite-node scripts/balance.ts ranger 10  # same, with rebirth
```

In dev, `window.game` in the browser console is the store (for example `game.act(g => g.gold += 1e6)`).

## Architecture

```
src/config/   balance.ts (every number), content.ts (jobs, biomes, monster families)
src/core/     pure TS, no DOM. Deterministic sim (seeded RNG in save)
  jobs.ts       route mechanics and tier-2 specialization tradeoffs
  sim.ts        tick(state, dt, rng, emit) – same code live (0.05s) and offline (0.5s)
  offline.ts    catch-up up to 8h (+ perk), returns summary for popup
  actions.ts    every player action (train, refine, rebirth, shop…)
  tower.ts      isolated live tower combat, first clears and daily sweep rewards
  goals.ts      next visible player goal for first-session guidance
  achievements.ts  permanent milestones and one-time reward claims
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
- Job change at Lv12 and Lv45, with isolated skill previews and a short promotion reveal. Blade shields/counters, Arcanist charges mana for empowered spells, Ranger builds pursuit. Tier-2 jobs each choose one of two specializations for the current rebirth run. One free tier-1 route correction per save, outside Boss fights; respec preserves HP ratio and cooldown.
- **Kuro the black cat**: tap 🐾 for a claw strike (auto from Kuro Lv5). Bosses drop 🐟 fish; feed fish to level Kuro (stronger claw, +gold, +offline cap). Pet Kuro every 4h for fish plus a 30 min +25% gold/exp blessing; after 24h Kuro sulks and petting gives double fish.
- **Story** (light, comedy): Kuro intro dialogue on each new chapter, a boss line on chapter bosses, battle chatter bubbles, and one memory fragment unlocked per rebirth (why can the cat talk?). Text lives in `src/config/story.ts`; reread it in the 黑貓 → 故事 tab.
- Corruption (Kuro's pact), from stage 15: stronger monsters, better loot.
- **Endless Tower**, after clearing stage 10: permanent floors, 30-second fights, daily rotating rules, first-clear fish, gem milestones every 5 floors, and one shared daily reward for a breakthrough or sweep. Rebirth keeps tower progress. Main-line idle combat continues during tower fights. A 0.8s entrance and 0.9s impact beat keep instant kills readable; the result records actual combat time, hit count, finisher damage and guardian HP. These presentation beats do not change combat difficulty or its 30s timer.
- **Achievements**, in Tasks → Achievements: first Boss, feeding Kuro, job change, auto claw, tower floors 1/5/10 and first rebirth. Claim individually or all at once; completion and claims survive rebirth. Older saves unlock milestones supported by their saved progress.
- **Bestiary** (📖 on the left): 12 monster families. Each family gains a star at 50 / 500 / 5,000 / 50,000 kills, and each star adds a small permanent bonus to one stat (attack, HP, gold, exp, crit, crit damage, attack speed or damage reduction). Kills are kept through rebirth.
- Achievements cover 28 milestones in all, including stage 25–200, kill counts, Boss counts, Kuro levels, tower 25/50, refine +10, 5 rebirths and bestiary stars.
- Rebirth, from stage 40: soul shards, then permanent perks.
- Daily quests, 7-day login, gem shop and rewarded ads (offline ×2, free gems 5 times a day).

Pacing depends on route, upgrades, equipment and seed. Use the balance and first-session scripts to measure the current rules; bot outcomes are not human retention measurements.

## Assumptions

Job mechanics and tower feedback: [design and validation](docs/job-identity-and-tower-feedback.md).

First-session pacing, tower reward rules and validation details: [first-session audit](docs/first-session-audit.md).

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

## Analytics and feedback

- Firebase project `lazy-land`, web app `lazy-rpg-remake`. The config is in `src/services/analytics.ts`.
- `src/ui/analyticsWatch.ts` compares state and sends funnel events: `game_open`, `tutorial_step`, `tutorial_complete`, `stage_reached` (every 5), `boss_fail`, `job_change`, `kuro_level`, `tower_floor`, `rebirth`, `achievement_claim`, `bestiary_star`, `panel_open`, `offline_return`, `session_pause` and `feedback_sent`.
- The 💬 意見 button writes to the Firestore `feedback` collection. Rules in `firestore.rules` allow create only, so clients cannot read it. Read it in the Firebase console under Firestore.
- To update the rules: `firebase deploy --only firestore:rules`.

## Share / deploy

- Web (for friends to test): https://alphakey-marketing.github.io/lazy-rpg-remake/
  - To update it: `npm run deploy`. This builds and pushes to the `gh-pages` branch; the site refreshes in about 1 minute.
- Android, phone on USB debug: `npm run android`. This builds a debug APK and installs it.

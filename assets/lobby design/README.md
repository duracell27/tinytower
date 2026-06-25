# Handoff: Вестибюль / Lobby Elevator Panel

## Overview
This is the **Lobby (Вестибюль) panel** for the tower/hotel idle game. It is a bottom-sheet card that slides up over the tower scene when the player taps the lobby. It contains the core elevator mini-game: a visitor waits in the lobby, asks to be taken to a specific floor, and the player raises the elevator (one elevator-level worth of floors per tap) until the visitor arrives. On arrival the visitor thanks the player and pays tips (coins). The panel also has an **Upgrade** sub-view for upgrading the elevator level (floors moved per lift) and the lobby capacity, plus a daily-tips plan that grants a gem reward when filled.

## About the Design Files
The files in this bundle are **design references created in HTML** — a working prototype showing the intended look and behavior. They are **not production code to copy directly**. The `.dc.html` format is a proprietary live-preview component format (custom `<x-dc>`, `<sc-if>`, `{{ }}` template holes, a `DCLogic` base class); do **not** try to run it in your app.

Your task is to **recreate this design in the target codebase's existing environment** (React Native, Unity, Flutter, React web, etc.) using its established patterns, component library, and state management. If no environment exists yet, pick the framework most appropriate for the game and implement there. Read the HTML to extract exact layout, colors, type, copy, and game logic — then rebuild it idiomatically.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, iconography, animation timings, and interactions are all specified below and present in the prototype. Recreate the UI to match. The numeric game-balance values (costs, tip formula, plan target) are **placeholder defaults** — see "Game Logic & Balance" and confirm real values with the game designer.

## Layout / Container

- Rendered inside a **402px-wide** phone frame (iOS device mock). The real target is a mobile game screen.
- Font family across the whole panel: **Fredoka** (weights 400/500/600/700). Falls back to system sans.
- The panel is a **bottom sheet** that covers the screen from `top: 56px` down to the bottom, sliding in via `transform: translateY()`.
  - Open: `translateY(0)`. Closed: `translateY(102%)`.
  - Transition: `transform .42s cubic-bezier(.4,0,.2,1)`.
- Behind the sheet is a **scrim**: `rgba(18,26,44,0.5)`, fades `opacity .4s ease`, tap to close.
- Sheet body: `border-radius: 26px 26px 0 0`, background `#EAEDF2`, shadow `0 -10px 30px rgba(20,30,50,0.28)`. It is a vertical flexbox: fixed header + scrollable content.
- When closed, a **"Відкрити вестибюль" reopen pill** appears centered near the bottom (`bottom: 42px`): slate gradient pill, elevator icon + label, tap to reopen.

## Screens / Views

The panel has two views toggled by internal state (`view: 'operate' | 'upgrade'`), sharing the same header.

### Header (always visible)
- Background: slate gradient `linear-gradient(180deg,#6C7C92,#56657C)`, inner top highlight `inset 0 1px 0 rgba(255,255,255,0.25)`.
- Drag handle: 38×4px, `rgba(255,255,255,0.55)`, centered, radius 3px.
- Left: 38×38 rounded icon tile (radius 12, `rgba(255,255,255,0.18)`) with a white elevator glyph; then title **"ВЕСТИБЮЛЬ"** (700, 17px, letter-spacing 0.8px, white, text-shadow) and subtitle **"Ліфт · доставка гостей"** (500, 11.5px, `rgba(255,255,255,0.78)`).
- Right: coin chip (gold radial-gradient dot + coin count, 700/13px white, on `rgba(255,255,255,0.14)` pill) and a 32px round close button (`✕`, white stroke 2.4).
- **Two stat tiles** below (flex row, gap 9, each `flex:1`, `rgba(255,255,255,0.13)` bg, radius 12):
  - **"Очікують"** (waiting visitors count) — person icon, label 500/12 `rgba(255,255,255,0.75)`, value 700/15 white right-aligned.
  - **"Новий гість"** (countdown to next arrival) — clock icon, value is `M:SS` timer, `font-variant-numeric: tabular-nums`.

### View A — OPERATE (`showOperate`)
Scrollable content, padding 13px, vertical gap 12px.

1. **Visitor + Shaft card** — white, radius 18, subtle inset border + drop shadow. Two columns (flex, gap 13, padding 14):
   - **Left column** (`flex:1`):
     - **Avatar** 58×58 rounded tile (radius 15, bg `#EEF0F5`), containing an inline SVG character: a body in the **role color** (`rect` fill), white collar triangle, skin-tone face `#F0C49C`, dark hair `#4A3322`, glasses, a gold name-tag. The body rect fill = `roleColor`.
     - **Speech bubble** (`#F1F3F7`, radius 13): 
       - While riding: `<b style="color:roleColor">{roleLabel}</b> · {target} поверх` (e.g. **"Доставник · 2 поверх"**).
       - On arrival: **"Дякую! 🎉"** (600, 14px, `#2A3344`).
     - **Status chip** (`#EEF1F6`, radius 9): colored dot + text.
       - Riding: dot `#F0B92A`, text `"Ліфт на поверсі {floor}"`.
       - Arrived: dot `#52B847`, text `"Поверх {target} · прибули"`.
     - **Primary action button** (full width, radius 13, 700/14.5px):
       - While riding — green 3D button **"Підняти на {target} поверх"** with up-arrow icon. BG `linear-gradient(180deg,#72C24F,#5BA63C)`, 3D shadow `0 3px 0 #4A8A2E,inset 0 1px 0 rgba(255,255,255,0.4)`, white text + text-shadow.
       - On arrival — gold button **"Отримати чайові +{tip}"** with coin dot. BG `linear-gradient(180deg,#F6C642,#E5A41C)`, text `#5A3D06`, shadow `0 3px 0 #BC820F,inset 0 1px 0 rgba(255,255,255,0.5)`.
   - **Right column** (62px) — **elevator shaft**:
     - Target floor number on top (700/11, `#7B52BC`), `0` label at bottom (600/11, `#AEB4C0`).
     - Shaft: 48×148px, radius 10, dark gradient `linear-gradient(180deg,#3C4658,#2C3445)` with inset rails and shadow.
     - **Cabin**: positioned absolutely inside shaft, height 40px, light gradient `linear-gradient(180deg,#EFF1F5,#C9CFD9)`. Its `bottom` animates `transition: bottom .5s cubic-bezier(.45,.05,.3,1)`. Bottom value = `6 + (floor/target)*102` px. Contains two "door" bars and a small gold badge showing the current `{floor}`.

   - **Empty state** (when no one is waiting): centered placeholder — elevator outline icon, **"Вестибюль порожній"** (600/14 `#7C8494`) + **"Нові відвідувачі скоро прийдуть"** (500/12 `#A6ACB8`).

2. **"Розвезти всіх за 💎1"** button (only when visitors waiting) — white card, person-group icon, label `"Розвезти всіх за"`, then a **gem** (cyan diamond, rotated square) + `1`. Serves all waiting visitors at once for 1 gem.

3. **Daily tips card** — white, radius 16:
   - Header row: **"Сьогодні отримано чайових"** (600/12.5 `#6E7686`) and on the right a coin dot + `{dailyTips}` (700/13 `#C28A22`) + `/ {dailyTipsMax}` (500/12 `#A6ACB8`).
   - Progress bar: 8px tall, track `#EAEDF2`, fill `linear-gradient(90deg,#F6C642,#E5A41C)`, `transition: width .4s ease`, width = `dailyTips/dailyTipsMax`.
   - **Reward button** (appears only when plan filled and not yet claimed — `rewardReady`): blue 3D button **"Отримати винагороду за план"** + gem icon + `{rewardGems}` (default **5**). BG `linear-gradient(180deg,#52A6E2,#3B8BCB)`, shadow `0 3px 0 #2E72A8,...`. Tapping grants the gems.
   - **Claimed state** (`rewardClaimed`): light-blue confirmation strip `#EAF4FB` with check icon + **"План виконано · винагороду отримано"**.

4. **"Покращити ліфт"** entry button — slate 3D button (`linear-gradient(180deg,#6C7C92,#56657C)`, shadow `0 3px 0 #45526A`), upload icon. Navigates to the Upgrade view. Caption below: **"Покращення ліфта прискорює підйом і збільшує чайові"** (500/11.5 `#9098A6`).

### View B — UPGRADE (`showUpgrade`)

1. **Back button** — white pill, chevron-left + **"Назад до ліфта"**. Returns to Operate view.

2. **Elevator upgrade card** — white, radius 18:
   - Title **"Ліфт: L-{level}"** (700/17, "L-{level}" in green `#5BA63C`), right: **"{level} пов. / підйом"**.
   - Green progress bar (`linear-gradient(90deg,#72C24F,#5BA63C)`), width = `min(100, level*12)%`.
   - Icon tile (54×54, light gradient) with elevator glyph + description **"Кожне покращення ліфта прискорює підйом і збільшує чайові гостей"**.
   - **Upgrade button** **"Покращити за {cost} 🪙"** — green 3D when affordable; greyed `linear-gradient(180deg,#B7BDC8,#A2A9B6)` + `cursor:not-allowed` when not.

3. **Lobby upgrade card** — white, radius 18:
   - Title **"Вестибюль"**, right: **"{capacity} місць"** (cyan `#2592AB`).
   - Blue progress bar (`linear-gradient(90deg,#52A6E2,#3B8BCB)`), width = `capacity/100`.
   - Icon tile (people glyph) + description **"Більший вестибюль вміщує більше відвідувачів, що чекають на підйом"**.
   - **Upgrade button** **"+20 місць за {cost} 🪙"** — blue 3D when affordable; greyed when not.
   - At max capacity, button is replaced by a **"Максимальний рівень!"** strip (`#EAF4FB`, check icon, `#2592AB`).

## Interactions & Behavior

- **Open / close sheet**: tap lobby → open; tap scrim or close button → close (slides down 102%); reopen pill → open.
- **Raise elevator** (`Підняти`): moves the cabin up by `elevatorLevel` floors per tap, clamped to `target`. Cabin animates. When `floor >= target`, visitor becomes `arrived` (bubble → "Дякую!", status dot green, button switches to "Отримати чайові").
- **Collect tips** (`Отримати чайові`): adds `tip` to coins and to daily tips, decrements `waiting` by 1, resets `floor=0`, spawns the next visitor (new random `target` and `role`), `arrived=false`.
- **Deliver all** (`Розвезти всіх`): costs 1 gem; serves all waiting visitors at once, summing tips; sets `waiting=0`; spawns a fresh visitor; resets floor.
- **Claim reward** (`Отримати винагороду`): only valid when `dailyTips >= dailyTipsMax` and not yet claimed; adds `rewardGems` gems, sets `rewardClaimed=true`.
- **Arrival timer**: a 1-second interval counts `secondsToNext` down from **120s (2 min)**. At zero, a new visitor is added (`waiting + 1`, capped at `capacity`) and the timer resets to 120. If the lobby was empty, the new arrival also becomes the active visitor (new target/role, floor reset).
- **Upgrade elevator**: cost = `elevatorLevel * 50` coins; increments `elevatorLevel` by 1 (more floors per lift, and larger tips via the tip formula). Disabled when unaffordable.
- **Upgrade lobby**: cost = `capacity * 8` coins; `capacity += 20`, capped at **100**. Disabled when unaffordable or at max.

### Animations / Transitions
- Sheet slide: `transform .42s cubic-bezier(.4,0,.2,1)`.
- Scrim fade: `opacity .4s ease`.
- Cabin movement: `bottom .5s cubic-bezier(.45,.05,.3,1)`.
- Progress bars: `width .4s ease`.
- 3D buttons use a bottom box-shadow (`0 3px 0 <darker>`) to imply depth; consider translating down + shrinking the shadow on press for tactile feedback.

## State Management

State variables (initial / default values shown):
- `open: true` — sheet visibility.
- `view: 'operate'` — `'operate' | 'upgrade'`.
- `coins: 2480` — soft currency.
- `gems: 143` — premium currency.
- `elevatorLevel: 1` — floors moved per lift; also scales tips.
- `capacity: 20` — lobby size (max waiting visitors), max 100, step 20.
- `waiting: 12` — visitors currently waiting.
- `floor: 0` — current elevator floor for the active visitor.
- `target: 1–8 (random)` — destination floor the active visitor requested.
- `roleIdx: random` — index into ROLES.
- `arrived: false` — whether active visitor reached their floor.
- `dailyTips: 0`, `dailyTipsMax: 1200` — daily tips plan progress / target.
- `rewardClaimed: false` — daily reward claimed flag.
- `secondsToNext: 120` — countdown to next arrival.

Notes: in a real game these belong in shared/persistent game state (with save/load), not local component state. `coins`/`gems` are presumably global. Daily counters and `rewardClaimed` should reset on a real day rollover.

## Game Logic & Balance (PLACEHOLDER — confirm with designer)

- **Roles** (label → color): Відвідувач `#7B52BC`, Доставник `#2E78B5`, Покупець `#4E9A2E`, Будівельник `#C28A22`. The role only changes the label and avatar color in this prototype — wire up role-specific behavior/bonuses as needed.
- **Tip formula**: `round(target * 130 * (1 + (level - 1) * 0.35))` — base 130 coins per floor, +35% per elevator level above 1.
- **Elevator upgrade cost**: `elevatorLevel * 50` coins.
- **Lobby upgrade cost**: `capacity * 8` coins; +20 capacity each, cap 100.
- **Daily plan target**: 1200 tips. **Reward**: 5 gems.
- **Arrival cadence**: every 120s.
- **Target floor range**: random 1–8.

These are tuning knobs — the real numbers should come from the game's economy design.

## Design Tokens

**Colors**
- Slate header / slate button: `#6C7C92` → `#56657C` (gradient), pressed/shadow `#45526A`.
- Green (raise / elevator upgrade): `#72C24F` → `#5BA63C`, shadow `#4A8A2E`, accent text `#5BA63C`.
- Gold (coins / tips): `#F6C642` → `#E5A41C`, shadow `#BC820F`, coin dot `#FFE69B`→`#F2B330`, text `#C28A22` / `#5A3D06`.
- Blue / cyan (lobby / gems / reward): `#52A6E2` → `#3B8BCB`, shadow `#2E72A8`, gem `#8FE6F2`→`#3FB8D6`, text `#2592AB`, light strip `#EAF4FB`.
- Disabled button: `#B7BDC8` → `#A2A9B6`, shadow `#8A909C`.
- Surfaces: card white `#fff`; panel bg `#EAEDF2`; inner fills `#F1F3F7` / `#EEF1F6` / `#EEF0F5`; track `#EAEDF2`.
- Text: primary `#2A3344`; secondary `#5A6478` / `#6E7686`; muted `#7C8494` / `#9098A6` / `#A6ACB8`.
- Status dots: pending `#F0B92A`, success `#52B847`.
- Avatar skin `#F0C49C`, hair `#4A3322`, name-tag `#FFD23E`.
- Shaft: `#3C4658` → `#2C3445`; cabin `#EFF1F5` → `#C9CFD9`.

**Typography** — Fredoka. Sizes used: 17 (titles), 15 (values/buttons), 14.5 (buttons), 14, 13.5, 13, 12.5, 12, 11.5, 11, 9 (cabin badge). Weights 700 (titles/values), 600 (labels), 500 (secondary), 400.

**Radii**: sheet 26 (top corners); cards 16–18; buttons 13–14; tiles 12–15; chips 9–13; pills 11–22.

**Shadows**: card `inset 0 0 0 1px rgba(40,60,90,0.06), 0 2px 6px -2px rgba(40,60,90,0.13)`; 3D button `0 3px 0 <darker>, inset 0 1px 0 rgba(255,255,255,0.4)`; sheet `0 -10px 30px rgba(20,30,50,0.28)`; progress track inset `inset 0 1px 2px rgba(40,60,90,0.1)`.

**Spacing**: content padding 13; card padding 14–15; inter-card gap 12; stat tiles gap 9.

## Assets

- **Fredoka** font — Google Fonts (`Fredoka:wght@400;500;600;700`).
- **Background image** — the panel slides over the tower scene; behind the sheet sits the game's base background (`welcome-bg.png` in the main project). Not bundled here — this handoff covers the lobby panel only. Use whatever scene the panel overlays in your build.
- **Icons** are all **inline SVG** (elevator, person, clock, up-arrow, coin/gem shapes, gift, check, chevron) — no icon font or image files. The **visitor avatar** is hand-built inline SVG. Re-implement with your icon system or copy the SVG paths from the HTML.

## Screenshots (in `screenshots/`)
- `01-operate-riding.png` — Operate view, visitor riding (raise button, shaft cabin mid-travel).
- `02-operate-arrived.png` — Visitor arrived ("Дякую!", gold "Отримати чайові" button).
- `03-upgrade.png` — Upgrade view (elevator + lobby upgrade cards).
- `04-reward-and-empty.png` — Daily plan filled (blue "Отримати винагороду за план 💎5") with empty-lobby state above.

## Files (in this bundle)
- `Lobby Panel.dc.html` — the lobby/elevator panel (this design). Read its `<script>` block for the full game logic.
- `screenshots/` — rendered states of the panel (see Screenshots section above).

> The `.dc.html` file is a design reference in a live-preview format. Extract design + logic from it; do not run it directly. Recreate in your target stack.

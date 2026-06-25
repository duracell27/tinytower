# Handoff: Готель — панель мешканців (Hotel Residents Panel)

## Overview
A slide-up bottom sheet for a mobile tower-management game (Ukrainian UI). It opens
when the player taps the **Готель (Hotel)** floor in the tower. The sheet lists
residents who are currently **unemployed and looking for work**. Each resident card
shows an avatar, name, dream job, current employment status, a mood marker, and a
specialization level (1–9). Tapping a card expands it to reveal more detail plus two
actions: **Знайти роботу** (Find a job) and **Виселити** (Evict).

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes that
show the intended look and behavior. They are **not production code to copy directly**.
The HTML uses a small in-house templating runtime (`support.js`, `.dc.html` Design
Components) that exists only for prototyping.

The task is to **recreate these designs in the target codebase's existing environment**
(React, Vue, SwiftUI, Unity UI, native, etc.) using its established components, styling
approach, and state patterns. If no UI environment exists yet, pick the most appropriate
framework for the project and implement the designs there. Treat the HTML purely as a
visual + behavioral spec.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, icons, and interactions.
Recreate pixel-accurately using the codebase's own UI primitives. Exact hex values,
sizes, and easings are given below.

---

## Screens / Views

The design is a single overlay with three logical layers, sized for a 402 px-wide phone
screen (iPhone-class frame).

### 1. Background (context)
The game tower scene, dimmed behind the sheet. Not part of this feature — just shows the
panel slides up over the existing tower view.

### 2. Scrim
- Full-screen overlay: `background: rgba(18,26,44,0.5)`
- Fades in/out with the sheet (`opacity` transition `0.4s ease`)
- Tapping the scrim closes the sheet
- `pointer-events: none` when the sheet is closed

### 3. Bottom Sheet
Slides up from the bottom; occupies from `56px` below the top of the screen to the bottom.

- Transform: open = `translateY(0)`, closed = `translateY(102%)`
- Transition: `transform 0.42s cubic-bezier(.4,0,.2,1)`
- Container: `border-radius: 26px 26px 0 0`, `background: #EAEDF2`,
  `box-shadow: 0 -10px 30px rgba(20,30,50,0.28)`
- Layout: vertical flex — fixed header + scrollable list

#### Sheet Header
- Padding: `11px 16px 13px`
- Background: `linear-gradient(180deg, #6C7C92, #56657C)`, `inset 0 1px 0 rgba(255,255,255,0.25)`
- **Drag handle**: `38×4px`, `border-radius: 3px`, `rgba(255,255,255,0.55)`, centered, `12px` bottom margin
- **Title row**:
  - Building icon in a `38×38px` rounded square (`border-radius:12px`, `background: rgba(255,255,255,0.18)`)
  - Title **ГОТЕЛЬ** — Fredoka 700, 17px, `letter-spacing:0.8px`, `#fff`, text-shadow `0 1px 1px rgba(30,40,60,0.4)`
  - Subtitle **Мешканці · пошук роботи** — Fredoka 500, 11.5px, `rgba(255,255,255,0.78)`
  - **Close button** (right): `32×32px` circle, `rgba(255,255,255,0.16)`, white X icon (stroke 2.4)
- **Stats row** (margin-top 13px, two equal pills, gap 9px):
  - Pill "Місць" (seats total): `background: rgba(255,255,255,0.13)`, person icon, label 12px `rgba(255,255,255,0.75)`, value 15px/700 `#fff`. Default value **70**.
  - Pill "Вільно" (free): `background: rgba(124,205,90,0.22)`, green dot `#9BE070`, label `rgba(255,255,255,0.82)`, value `#EAF8E2`. Default value **4**.

#### Resident List
- Scroll container: `flex:1`, `overflow-y:auto`, `padding:13px`, vertical flex, `gap:11px`
- Scrollbar hidden
- One card per resident (9 sample residents)

---

## Resident Card

### Collapsed state
- `background:#fff`, `border-radius:18px`, `cursor:pointer`
- Shadow (collapsed): `inset 0 0 0 1px rgba(40,60,90,0.06), 0 2px 6px -2px rgba(40,60,90,0.13)`
- Shadow (expanded): `inset 0 0 0 2px <shirtColor>, 0 8px 20px -6px rgba(40,60,90,0.28)`
- Shadow transition: `box-shadow 0.25s ease`
- Inner row: flex, `align-items:center`, `gap:12px`, `padding:11px 13px 11px 11px`

**Avatar tile** (`60×60px`, `border-radius:15px`, `background:#E7EBF1`, `inset 0 0 0 1px rgba(40,60,90,0.07)`, overflow hidden, person anchored to bottom):
A simple flat avatar drawn in a `64×64` viewBox SVG, bottom-aligned:
- Side hair (only for female): two ellipses `cx 15 / 49, cy 35, rx 6, ry 14`, fill = hair color
- Shirt (shoulders): `rect x9 y45 w46 h26 rx14`, **fill = floor color of the dream job** (the key gameplay signal)
- Name tag: `rect x25 y54 w14 h8 rx2.5`, white, opacity 0.9
- Neck: `rect x27.5 y37 w9 h10 rx4`, skin
- Hair (top): `circle cx32 cy22 r15`, hair color
- Head: `circle cx32 cy27 r13.5`, skin (`#F0C49C`)

**Info column** (flex:1, min-width:0, vertical flex, gap 4px):
- Name + mood marker row:
  - Name — Fredoka 600, 16px, `#2A3344`, ellipsis truncation
  - **Mood marker** — `9×9px` circle, `box-shadow: 0 0 0 3px <ring>`. Color is one of:
    - good = `#52B847` (ring `rgba(82,184,71,0.22)`)
    - mid  = `#F0B92A` (ring `rgba(240,185,42,0.24)`)
    - bad  = `#E2685A` (ring `rgba(226,104,90,0.24)`)
- Dream-job row: flag icon (stroke = floor accent color) + dream job text — Fredoka 600, 12.5px, **color = floor accent**, ellipsis
- Status row: briefcase icon (stroke `#A6ACB8`) + status text — Fredoka 500, 12.5px, `#9098A6`. For unemployed: **«Безробітний»** (m) / **«Безробітна»** (f)

**Level block** (right, flex none, gap 5px):
- Caption "РІВЕНЬ" — Fredoka 600, 8px, `letter-spacing:0.6px`, `#AEB4C0`
- Number 1–9 — Fredoka 700, 24px, **color = floor accent**
- Chevron `9×14` SVG, stroke `#C2C8D2`; rotates `0deg → 90deg` when expanded, transition `transform 0.25s ease`

### Expanded state (accordion)
A detail panel below the collapsed row, animated open:
- Wrapper: `max-height` `0px → 440px`, `opacity` `0 → 1`, `overflow:hidden`,
  transition `max-height 0.34s ease, opacity 0.25s ease`
- Inner: `padding:13px 15px 15px`, `margin:0 2px`, top border `1px solid rgba(40,60,90,0.07)`
- **Info rows** (vertical flex, gap 10px) — each is `[9×9px rounded-3 dot] [label 13px/500 #7C8494] [value 13px/600]`:
  - **Навичка:** `<category> · рівень <level>` — value color = floor accent; dot = floor accent
  - **Робота мрії:** `<dream job>` — value color = floor accent; dot = floor accent
  - **Працює:** `<status>` — value `#9098A6`; dot `#B7BDC8`
  - **Проживає:** `Готель` — value `#4A5468`; dot `#6E7C92`
- **Buttons** (vertical flex, gap 9px, margin-top 15px), each `padding:12px`, `border-radius:13px`, Fredoka 700, 14px, white, text-shadow `0 1px 1px rgba(0,0,0,0.22)`, `inset 0 1px 0 rgba(255,255,255,...)`:
  - **Знайти роботу** — `linear-gradient(180deg,#72C24F,#5BA63C)`, drop edge `box-shadow:0 3px 0 #4A8A2E`, person-plus icon
  - **Виселити** — `linear-gradient(180deg,#E2685A,#CC4A3C)`, drop edge `box-shadow:0 3px 0 #A8392C`, logout/door icon
  - Both stop click propagation so they don't collapse the card
- **Hint** (margin-top 11px, centered) — Fredoka 500, 11.5px, `line-height:1.35`, `#9098A6`:
  «Чим вищий навик працівника, тим більшу знижку на закупівлю він дає»

---

## Floors (shirt + accent color mapping)
Each resident's dream job belongs to a tower floor. The **shirt color of the avatar
equals that floor's color** — this is the key visual link the player uses to match
workers to floors. Accent color is the readable text variant used for the dream job
label and the level number.

| Floor key | Category (Навичка) | Shirt color | Accent (text) | Sample dream jobs |
|-----------|--------------------|-------------|---------------|-------------------|
| green     | Кондитерська       | `#62B23F`   | `#4E9A2E`     | Торти, Булки, Пирожені |
| teal      | Пральня            | `#36AE9C`   | `#1F8979`     | Прання, Сушка, Відбілювання |
| amber     | Кав'ярня           | `#E7A21E`   | `#B07F12`     | Кава, Млинці, Десерти |

Skin tone (all avatars): `#F0C49C`. Hair color is per-resident (browns/blondes,
e.g. `#5C3A22`, `#E0A93C`, `#C9923A`, `#D8A24A`, `#B5763A`).

## Sample data (9 residents)
| Name | Gender | Floor | Dream job | Mood | Level |
|------|--------|-------|-----------|------|-------|
| Коля Некрасов | m | green | Торти | good | random 1–9 |
| Надя Бєлкіна | f | teal | Прання | bad | random 1–9 |
| Саша Яшина | f | amber | Кава | mid | random 1–9 |
| Дима Громов | m | amber | Млинці | good | random 1–9 |
| Миша Шевчук | m | teal | Сушка | mid | random 1–9 |
| Андрій Семенов | m | green | Булки | bad | random 1–9 |
| Маша Громова | f | amber | Десерти | good | random 1–9 |
| Ваня Вайнер | m | teal | Відбілювання | mid | random 1–9 |
| Ірина Коваль | f | green | Пирожені | bad | random 1–9 |

The **specialization level is a random integer 1–9**, generated once when the panel
mounts and kept stable while open. In production this comes from the resident's data
model, not from `Math.random()`.

---

## Interactions & Behavior
- **Open**: triggered by tapping the Hotel floor (or the "Відкрити готель" pill when closed). Sheet slides up, scrim fades in.
- **Close**: tap close (X) button or tap the scrim. Sheet slides down (`translateY(102%)`), scrim fades out.
- **Expand resident**: tap a card. Accordion — only **one** card open at a time (opening another closes the previous). Tapping the open card collapses it.
- **Знайти роботу / Виселити**: action buttons inside the expanded card. They must `stopPropagation` so they don't toggle the accordion. (Behavior beyond the click is game logic — not specified by this design.)
- Mood marker and level are read-only indicators.

## State Management
- `open: boolean` — sheet visibility (default true in the prototype; in-app it starts false and opens on tap)
- `expanded: residentId | null` — which card is open (accordion)
- `residents[]` — each with: id, name, gender, floor key, dream job, mood (good/mid/bad), hair color, and **level (1–9 from the data model)**
- Derived per resident: shirt color + accent (from floor), category name, status string (gendered), mood dot + ring colors

## Design Tokens
**Colors**
- Sheet bg `#EAEDF2`; card bg `#fff`; avatar tile `#E7EBF1`
- Header gradient `#6C7C92 → #56657C`
- Text: name `#2A3344`, label `#7C8494`, muted `#9098A6`, caption `#AEB4C0`, "Проживає" value `#4A5468`
- Scrim `rgba(18,26,44,0.5)`
- Floor greens/teal/amber + accents (table above)
- Mood: `#52B847` / `#F0B92A` / `#E2685A`
- Primary button green `#72C24F → #5BA63C` (edge `#4A8A2E`); danger red `#E2685A → #CC4A3C` (edge `#A8392C`)

**Radii**: sheet top `26px`; cards `18px`; avatar tile `15px`; buttons `13px`; stat pills `12px`; header icon box `12px`; dots `3px`.

**Typography**: Fredoka (Google Fonts), weights 400/500/600/700. Sizes used: 24, 17, 16, 15, 13, 12.5, 12, 11.5, 8 px.

**Shadows**: see card collapsed/expanded and button drop-edge values above.

**Easings/Durations**: sheet `0.42s cubic-bezier(.4,0,.2,1)`; scrim `0.4s ease`; accordion `max-height 0.34s ease` + `opacity 0.25s ease`; chevron/card-shadow `0.25s ease`.

## Assets
- **Fonts**: Fredoka via Google Fonts.
- **Icons**: all drawn inline as simple SVG (building, person, person-plus, briefcase, flag, logout/door, X, chevron). No external icon files. Recreate with the codebase's icon set if available.
- **Avatars**: procedurally drawn flat SVG (shapes only — no image assets). Shirt color is data-driven (floor color). Recreate as a parametric avatar component, or swap for the game's real character art while keeping the floor-colored shirt.
- **Background**: the existing game tower scene (out of scope for this feature).

## Files
- `Hotel Panel.dc.html` — the full prototype of this panel (markup + logic). Primary reference.
- `TowerScene.dc.html` — the tower view shown behind the sheet (context; floor colors originate here).
- `Production.dc.html` — existing production card; shows the game's button/skeuomorphic style the buttons here match.
- `Main Screen.dc.html` — how the phone frame + tower are composed (context).

> Note: `.dc.html` files use a prototyping runtime. Read them for structure/values, but
> implement using the target codebase's own component and state patterns.

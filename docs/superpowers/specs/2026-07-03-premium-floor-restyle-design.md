# Premium Floor Restyle (production floors only)

**Date:** 2026-07-03
**Status:** Draft — color mapping confirmed, pending final spec review

## Problem

The current floor UI (`FloorCard.tsx`, `ProductionCard.tsx`) uses a flat, slightly dated palette. The user wants a "premium casual mobile game" look (Supercell / Royal Match / Travel Town quality) — soft rounded shapes, gentle gradients, subtle depth — applied to the 3 currently-built production floors (Bakery/green, Laundry/teal, Coffee Shop/amber), using a fixed 5-color brand palette that maps 1:1 to the 5 `floorType`s already defined in `gameConfig.ts` (3 built, 2 reserved for future floors).

**Explicitly out of scope:** `TechnicalFloor.tsx` (Hotel + Lobby). The user will specify their color treatment separately later. No changes to Hotel/Lobby in this pass.

## Goal

- Reskin the 3 built floors (`FloorCard.tsx` + `ProductionCard.tsx`) with the new palette, larger corner radii, softer shadows, and more polish — without moving, adding, or removing any UI element or changing any interaction.
- Fix an existing inconsistency: the worker multiplier badge is hardcoded amber (`bonusBubbleAmber`) regardless of floor — it should follow the floor's color.
- Worker shirt color (`WorkerAvatar.tsx`, via `gameConfig.floorTypes[...].shirtColor`) and the `JobPickerSheet` accent pill follow the same per-floor color, since both already read from `floorTypes[...].accent` / `.shirtColor`.

## Non-goals

- Hotel/Lobby (`TechnicalFloor.tsx`) — separate follow-up, different palette to be given later.
- Adding new UI elements (e.g. a worker "cap" — the current SVG avatar has no cap layer, and the brief says not to add components, so shirt color changes only).
- Changing background image/blur — left as-is.
- Building the two unbuilt floor types (`purple`/Perfumery, `blue`/Ice Cream Parlor) — their palette reservation is preserved for when those floors are actually built.

## Color mapping (confirmed)

The 5 palette colors map to 5 business *categories*, not to specific floors — the category a floor belongs to decides its color:

| Category (укр.) | floorType key | Floor | Status | Color |
|---|---|---|---|---|
| Продукти (Products) | `green` | 2 | built | 🟢 Green `#58B947` |
| Сервіс (Service) | `teal` | 3 | built | 🔵 Blue `#4285F4` |
| Відпочинок (Leisure) | `amber` | 4 | built | 🟡 Yellow `#F4B63D` |
| Мода (Fashion) | `purple` | — | not built | 🟣 Purple `#8A52E8` |
| Електроніка (Electronics) | `blue` | — | not built | 🔴 Red `#E85A4F` |

Only the first 3 rows are in scope for this pass. The last 2 are noted for whoever builds those floors later — no code changes to the `purple`/`blue` `floorTypes` entries now. (Note the `floorTypes` key names — `purple`, `blue` — are just internal IDs picked earlier and don't need to match their eventual display color; `blue`'s category is Electronics/Red, not blue.)

## Design

### 1. `shared/config/gameConfig.ts` — `floorTypes`

Update `shirtColor` and `accent` for `green`, `teal`, `amber` to match the new palette (derived shades, not raw hex — accent is a darker/saturated variant used for text and pills, shirtColor is the flat avatar color). `purple`/`blue` entries are untouched (still reserved).

### 2. `FloorCard.tsx` — `FLOOR_SCHEMES`

Update `headerColors`, `bodyColor`, `cardBg`, `nameColor` for floors 2/3/4 to derive from the same 3 base hexes (using `shadeColor` for gradient stops, consistent with the existing pattern). `headerShadowColor` updated to match hue.

Corner radius: `floorContainer.borderRadius` 16 → 24. `cardsContainer` gap 7 → 9, padding 9 → 11 (spacing only, no reflow — still 3 equal-width cards).

Existing header gloss/edge treatment (added last session) is kept and reused as-is — already satisfies the "glass reflection on headers" ask.

### 3. `ProductionCard.tsx`

- `card.borderRadius` 13 → 18, `actionButton.borderRadius` 9 → 12, `productImage.borderRadius`/`hireSlot.borderRadius` bumped proportionally (11/13 → 14/16).
- `bonusBubbleAmber` → renamed `bonusBubble`, becomes a prop-driven color (pass floor accent down from `FloorCard`) instead of the hardcoded `#E89320`.
- Action-button color treatment (resolves the brief's "buttons should use floor color" vs. "preserve interaction model" tension):
  - **Primary CTA states** (`EMPTY`/Hire, `IDLE`/Buy, `READY_TO_LIST`/List, `READY_TO_COLLECT`/Collect) — gradient becomes the floor's accent color (2-stop shade via `shadeColor`), replacing the current fixed orange/green.
  - **In-progress states** (`DELIVERING`, `SELLING`) — these aren't clickable decisions, just countdowns; they keep their current fixed colors (`DELIVERING` blue `#52A6E2`/`#3B8BCB`, `SELLING` purple `#9A72D6`/`#8455C2`, unchanged) so "processing, not actionable" stays visually distinguishable from "your turn to tap." Both already sit outside the green/red/yellow floor palette, so no clash.
- Shadow softening consistent with last session's pass (already partially done on `card`/`productImage`).

### 4. Verification

No automated tests cover visual styling. Verification is: run the app (Expo), view all 3 floors in each production stage (empty/idle/delivering/selling/ready-to-collect/ready-to-list) and confirm no layout shift, text truncation, or overlap versus current build — per the `verify` skill, drive the actual screen rather than relying on typecheck alone.

## Files touched

- `shared/config/gameConfig.ts`
- `src/components/FloorCard.tsx`
- `src/components/ProductionCard.tsx`

(`WorkerAvatar.tsx` and `JobPickerSheet.tsx` need no direct edits — they already read `accent`/`shirtColor` from config.)

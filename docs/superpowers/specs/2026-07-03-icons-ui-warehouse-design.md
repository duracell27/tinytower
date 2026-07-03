# Icons, UI Polish & Warehouse — Design Spec
Date: 2026-07-03

## Scope

Five parallel UI/data tasks:
1. Rename floor types + replace WorkerAvatar SVG with image assets
2. Builder icon in BuyFloorBanner
3. Hotel / Reception image swap + card size adjustments
4. Warehouse sidebar (40px) + tool inventory in DB + bottom sheet
5. Discord icon on WelcomeScreen

---

## Task 1 — Floor type rename + Worker icons

### Floor type rename

`shared/config/gameConfig.ts` floorTypes keys must be renamed:

| Old key | New key |
|---------|---------|
| teal    | blue    |
| amber   | yellow  |
| purple  | violet  |
| blue    | red     |
| green   | green   |

Update every string reference to these keys across:
- `shared/config/gameConfig.ts`
- `shared/config/workerNames.ts` (HAIR_COLORS not affected; floorType generation loop uses `Object.keys`)
- `shared/engine/lobbyCommands.ts` (any hardcoded floorType strings)
- `shared/engine/__tests__/` (test fixtures)
- `shared/schemas/__tests__/` (test fixtures)
- `src/components/FloorCard.tsx` (FLOOR_SCHEMES — currently keyed by floorId, not floorType, so likely unaffected)
- `src/components/JobPickerSheet.tsx` (floorType comparisons)
- `src/stores/gameStore.ts` (any floorType references)

**Data migration**: `floorType` is stored as a plain String in the `Worker` prisma model. Existing DB rows will have old names. For early-stage dev: truncate `Worker` table (or run a SQL UPDATE to rename values) as part of the migration.

### WorkerAvatar replacement

`src/components/WorkerAvatar.tsx`:
- Remove SVG drawing entirely.
- Render `<Image>` (expo-image) from `assets/img/workers/{female ? 'woman' : 'man'}-{floorType}.png`.
- Keep same `size` prop; image fills a square of `size × size`.
- Maintain `memo` wrapper.

Asset map (require() calls, no dynamic require):
```
man-blue, man-green, man-red, man-violet, man-yellow
woman-blue, woman-green, woman-red, woman-violet, woman-yellow
```

Fallback: if `floorType` doesn't match any key, use `man-green` / `woman-green`.

Used in: `WorkerCard`, `JobPickerSheet`, `ProductionCard` — no changes needed in those files; they pass `worker` prop as-is.

---

## Task 2 — Builder icon in BuyFloorBanner

`src/components/BuyFloorBanner.tsx`:
- Remove `PlusIcon` SVG component.
- Replace the `ribbonPlusCircle` View + PlusIcon with an `<Image>` of `assets/img/workers/builder.png`, size 28×28.
- Remove the `ribbonPlusCircle` container; render the image directly in `ribbonLeft` with size 28×28.

---

## Task 3 — Hotel / Reception images

`src/components/TechnicalFloor.tsx`:

**HotelFloor**:
- Already uses `assets/img/hotel.png` — new file is already in place.
- Resize `techImage` from `100×50` to `70×70` (square) to fit new icon style.

**LobbyFloor**:
- Change `require('../../assets/img/lobby.png')` → `require('../../assets/img/reception.png')`.
- Same size adjustment: `70×70`.

Both cards: `body` padding stays at `padding: 12`. The `techImage` style changes from `width:100, height:50` to `width:70, height:70`; `techContent` gap stays at 14.

---

## Task 4 — Warehouse sidebar + tool inventory

### DB schema

Add a new Prisma model to `server/prisma/schema.prisma`:

```prisma
model PlayerTools {
  id       Int    @id @default(autoincrement())
  playerId String @unique
  briks    Int    @default(1)
  glass    Int    @default(1)
  nails    Int    @default(1)
  screw    Int    @default(1)
  player   Player @relation(fields: [playerId], references: [id], onDelete: Cascade)
}
```

Add reverse relation on `Player`: `tools PlayerTools?`

Run `prisma migrate dev` to apply.

**Initialization**: when a player first logs in / registers, create a `PlayerTools` row with defaults (1 of each). Do this in the auth/registration handler on the server.

### Server API

Add a `GET /game/tools` endpoint that returns `{ briks, glass, nails, screw }` for the authenticated player. No write endpoint needed yet (tools are read-only for now; future tasks can add spending/gaining).

### Client state

`src/stores/gameStore.ts`:
- Add `toolInventory: { briks: number; glass: number; nails: number; screw: number }` to state, defaulting to `{ briks: 1, glass: 1, nails: 1, screw: 1 }`.
- Add `setToolInventory(tools)` action.

`src/services/sync.ts`:
- On `start()`, fetch `/game/tools` and call `setToolInventory`.

### UI — Sidebar

`app/(tabs)/game.tsx`:
- `sideRight` width: `0` → `40`.
- Render a new `WarehouseSidebar` component inside `sideRight`.

`src/components/WarehouseSidebar.tsx` (new file):
- Vertical column, 40px wide, full height.
- Top: `werehouse.png` icon (28×28), tappable → opens `WarehouseSheet`.
- Below: 4 tool icons (briks/glass/nails/screw), each 24×24, with a small count label below (Fredoka_600SemiBold, 9px).
- All icons are tappable (same action: open WarehouseSheet).
- Background: subtle semi-transparent overlay or transparent.

### UI — WarehouseSheet (bottom sheet)

`src/components/WarehouseSheet.tsx` (new file):
- Reuses same animation pattern as `JobPickerSheet` (slide up from bottom, scrim).
- Header: `werehouse.png` icon + title "Склад" (or i18n key).
- Body: list of 4 tools, each row shows:
  - Tool icon (32×32)
  - Tool name (localised)
  - Count badge (right side)
- No interaction beyond viewing for now.

---

## Task 5 — Discord icon on WelcomeScreen

`src/screens/WelcomeScreen.tsx`:
- Add a `Pressable` with `discord.png` image (48×48), positioned `absolute`:
  - `left: 16`
  - `top: 0`, `bottom: 0` — use a wrapper View with `justifyContent: 'center'` and `pointerEvents: 'box-none'` so it doesn't block touches.
- On press: `Linking.openURL('https://discord.com/channels/1521796294270517260/1521882117208932483')`.
- `zIndex: 2` to sit above background gradient.

---

## Data / migration checklist

- [ ] Rename floorType keys in gameConfig and all string references
- [ ] SQL or truncate: clear existing Worker rows with old floorType values
- [ ] Prisma migration: add `PlayerTools` model
- [ ] Server: auto-create `PlayerTools` on player registration/first-login
- [ ] Server: add `GET /game/tools` endpoint
- [ ] Client: `toolInventory` in gameStore + sync on start

## Open questions

None — all resolved in brainstorming session.

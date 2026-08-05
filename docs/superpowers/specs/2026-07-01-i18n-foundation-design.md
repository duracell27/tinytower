# Multilingual Foundation (i18n)

**Date:** 2026-07-01
**Status:** Approved

## Problem

The game has no internationalization infrastructure, and its UI is currently hardcoded almost entirely in Ukrainian (~20 files, ~200 distinct strings), including:

- Screen/component chrome: tab labels, buttons, headers, validation messages, alerts, timers (`app/(tabs)/*`, `src/screens/*`, `src/components/*`)
- Game content data baked into `shared/config/gameConfig.ts` — a file shared by both client and server — as literal display strings (`floorTypes.<key>.category`, `floors[].name`, `productionTypes.<key>.displayName`)
- Random flavor-name pools: `shared/config/workerNames.ts` (server-side worker generation) and `src/stores/authStore.ts` (client-side guest name generation), both hardcoded Ukrainian word lists

There is no mechanism to select, persist, or resolve a UI language, and display text is entangled with shared game logic and (in one case) inert per-floor state.

## Goal

- Lay a technical foundation for multilingual support without translating into any second language yet
- English becomes the one real, complete language — all current Ukrainian UI/content text is translated to English
- Adding a second language later should require only: new JSON resource file(s) + new entries in name pools + adding the locale to a supported-languages list — no architectural changes
- No flash of wrong language on app start

## Non-Goals

- Translating into any language other than English right now
- A language-picker settings screen (nothing to pick between yet)
- Server-side awareness of per-player locale (e.g. a `Player.locale` DB column) — worker-name generation defaults to the English pool for everyone until this exists

## Design

### 1. Runtime — language resolution & init

Libraries: `i18next`, `react-i18next`, `expo-localization`.

Resolution order, computed synchronously before first render:

1. Persisted preference from MMKV (same storage already used for game state)
2. Device locale via `expo-localization` (`Localization.getLocales()`, synchronous), matched against `supportedLanguages` (currently `['en']`)
3. Fallback: `'en'`

All three steps are synchronous (MMKV reads and `Localization.getLocales()` don't require awaiting), so `src/i18n/index.ts` resolves the language and calls `i18next.init(...)` with `initImmediate: false` at module-import time — imported at the top of `app/_layout.tsx` before any component mounts. This avoids any loading state or flicker between an initial and a "real" language.

A `setAppLanguage(lang)` helper writes the choice to MMKV and calls `i18next.changeLanguage(lang)`. No UI calls it yet, but it's the one function a future settings screen would need.

### 2. UI chrome translation resources

Organized as i18next namespaces under `src/i18n/locales/en/`:

- `common.json` — generic buttons, relative-time strings (used by `profile.tsx`)
- `auth.json` — `LoginScreen.tsx`, `WelcomeScreen.tsx`
- `tabs.json` — `app/(tabs)/_layout.tsx`, `city.tsx`, `shop.tsx`
- `hotel.json` — `HotelPanel.tsx`, `FloorCard.tsx`, `TechnicalFloor.tsx`, `WorkerCard.tsx`, `JobPickerSheet.tsx`, `ProductionCard.tsx`, `LevelUpModal.tsx`, `DeliverAllModal.tsx`
- `lobby.json` — `LobbyPanel.tsx`

Components switch from hardcoded Ukrainian strings to `useTranslation('<namespace>')` + `t('key.path')`. Keys are short, structural, and namespaced by feature (e.g. `hotel.evictConfirm.title`) rather than using the English text as the key itself, so key stability doesn't depend on the English copy staying fixed.

### 3. Game content localization

`shared/config/gameConfig.ts` (imported by both server and client) is stripped of display text — it keeps only IDs and gameplay numbers (costs, durations, slot counts). A new client-only resource, `src/i18n/locales/en/gameContent.json`, keyed by the same stable IDs already in config, holds the display strings:

```json
{
  "floorTypes": { "green": { "category": "Bakery" } },
  "floors": { "2": { "name": "Bakery" } },
  "productionTypes": { "bulky": { "displayName": "Buns" } }
}
```

Components read these through a small helper (e.g. `t('gameContent:productionTypes.' + id + '.displayName')`) resolved dynamically by ID rather than a literal key — see the testing section for how this is still validated.

**Cleanup enabled by this change:** `FloorCard.tsx` currently has its own hardcoded `FLOOR_SCHEMES` map duplicating `gameConfig.floors[].name` as a second source of truth for the same text. It's consolidated to read display name from the same `gameContent` lookup by floor id; the color/accent values in `FLOOR_SCHEMES` (not translatable content) stay as they are.

### 4. Locale-aware name pools

Both `shared/config/workerNames.ts` (server, `generateRandomWorkers`) and the guest-name generator in `src/stores/authStore.ts` (`enterAsGuest`) currently hardcode Ukrainian word pools. Both are restructured to a locale-keyed shape:

```ts
type SupportedLocale = 'en'; // extend later, e.g. 'en' | 'uk'

const workerNamePools: Record<SupportedLocale, { first: string[]; last: string[] }> = {
  en: { first: [/* English first names */], last: [/* English surnames */] },
};

const DEFAULT_LOCALE: SupportedLocale = 'en';
export function generateRandomWorkers(count: number, locale: SupportedLocale = DEFAULT_LOCALE) { /* ... */ }
```

Same shape for the adjective/noun pools in `authStore.ts`. The client-side generator resolves against the current i18n language (the client already knows it); the server-side generator always uses `DEFAULT_LOCALE` for now since there's no per-player locale yet — the parameter exists so wiring in real per-player locale later is a call-site change, not a rewrite.

### 5. Data model cleanup — remove dead `Floor.name`

`Floor.name` in `GameState`/`FloorStateSchema` (`shared/schemas/gameState.ts`) is confirmed dead: not persisted in the server DB (Prisma's `Floor` model has no `name` column; the server reconstructs it from config on load and discards it), not rendered from state anywhere (`FloorCard.tsx` uses its own map, `JobPickerSheet.tsx` reads `gameConfig.floors` directly). It only exists as an inert field, though it is written into the client's local MMKV blob today.

Removed from `FloorStateSchema` and no longer populated server-side. `FloorStateSchema` is a plain `z.object()` (not `.strict()`), so zod already ignores the unknown `name` key on old cached MMKV blobs during parsing — no extra back-compat handling needed.

## Testing

- **Language resolution** (`src/i18n/index.ts`): unit tests for the fallback chain — persisted preference wins, else matched device locale, else `'en'` — mocking MMKV and `expo-localization`.
- **Name pool generation**: existing tests for `generateRandomWorkers` and guest-name generation updated if they assert on literal Ukrainian output; shape assertions (count, non-empty strings) should keep passing.
- **`shared/config/__tests__/gameConfig.test.ts`**: updated for the new ID-only config shape (no more `category`/`name`/`displayName` fields to assert on).
- **Translation key coverage** (new: `src/i18n/__tests__/keysExist.test.ts`, runs under existing jest/`npm test`):
  - Regex-scans all `.tsx`/`.ts` under `app/` and `src/` for literal `t('key')` / `t('namespace:key.path')` calls and asserts each resolves in the corresponding English JSON.
  - UI-chrome namespaces (`common`, `auth`, `tabs`, `hotel`, `lobby`) must use literal keys; any dynamic (template/concatenated) `t()` call found in these namespaces fails the check.
  - `gameContent` is looked up dynamically by ID, so instead of key-literal scanning, the test cross-references IDs: every `floorTypes`/`floors`/`productionTypes` key in `gameConfig` must have a matching entry in `gameContent.json` and vice versa — catches drift when a floor/product type is added without a matching display name.

## Future Work (explicitly deferred)

- Adding a second real language (translate the JSON resources, add its entry to name pools, add it to `supportedLanguages`)
- A settings screen exposing `setAppLanguage()`
- `Player.locale` column + server using it to pick the worker-name pool language

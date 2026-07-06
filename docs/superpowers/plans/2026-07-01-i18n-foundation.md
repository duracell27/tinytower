# Multilingual Foundation (i18n) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay a technical i18n foundation (i18next + react-i18next + expo-localization) and translate every Ukrainian UI/content string in the app to English, with no flash of the wrong language on startup.

**Architecture:** A pure `pickLanguage()` function resolves the startup language (persisted MMKV preference → device locale → `'en'`), consumed by a synchronous `src/i18n/index.ts` that initializes i18next before the app renders. UI chrome moves into per-feature i18next namespace JSON files (`common`, `auth`, `tabs`, `hotel`, `lobby`); game-content display text (floor categories, floor names, product names) moves out of the shared `gameConfig` (used by both client and server) into a client-only `gameContent` namespace keyed by the same stable ids already in config, so the server never carries display text. Random name pools (workers, guests) become locale-keyed with only `en` populated.

**Tech Stack:** TypeScript, React Native / Expo Router, i18next, react-i18next, expo-localization, Zustand, react-native-mmkv, Jest (ts-jest), Zod

## Global Constraints

- English is the only populated language right now (`SUPPORTED_LANGUAGES = ['en']`); do not add translations for any other language.
- Translation keys must be short, structural identifiers (e.g. `hotel.evictConfirm.title`), never the English text itself used as the key.
- Game-content display text (floor categories/names, product names) must not exist as literal strings in `shared/` — only ids/keys and gameplay numbers stay in shared config; display strings live client-side in `src/i18n/locales/en/gameContent.json`.
- Use `useTranslation(namespace)` (react-i18next hook) in every component that needs translated text, not a bare `i18next.t()` call — this is what makes a future language switch require zero component changes.
- Client-side tests run from repo root: `npx jest <path>` (excludes `server/`, per existing `testPathIgnorePatterns`).
- Server-side tests run from `server/`: `cd server && npx jest <path>`.
- TypeScript check client: `npx tsc --noEmit`. TypeScript check server: `cd server && npx tsc --noEmit`.
- Install Expo-managed native modules with `npx expo install <pkg>` (picks the SDK-56-compatible version), plain `npm install` for pure-JS packages (`i18next`, `react-i18next`).

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/i18n/language.ts` | Create | Pure `pickLanguage()` resolution logic + supported-language constants |
| `src/i18n/__tests__/language.test.ts` | Create | Unit tests for the fallback chain |
| `src/i18n/index.ts` | Create | Synchronous i18next init, `setAppLanguage()` |
| `src/i18n/locales/en/common.json` | Create | Shared action words + relative-time strings |
| `src/i18n/locales/en/auth.json` | Create | LoginScreen + WelcomeScreen strings |
| `src/i18n/locales/en/tabs.json` | Create | Tab labels, city/shop placeholders, profile screen |
| `src/i18n/locales/en/hotel.json` | Create | HotelPanel, FloorCard, TechnicalFloor, WorkerCard, JobPickerSheet, ProductionCard, LevelUpModal, DeliverAllModal |
| `src/i18n/locales/en/lobby.json` | Create | LobbyPanel |
| `src/i18n/locales/en/gameContent.json` | Create | Floor categories/names, product display names |
| `src/i18n/__tests__/keysExist.test.ts` | Create | Static translation-key coverage check |
| `app/_layout.tsx` | Modify | Import `src/i18n` first, before any other import |
| `shared/config/gameConfig.ts` | Modify | Strip display text, keep ids/numbers only |
| `shared/schemas/gameConfig.ts` | Modify | Remove `category`/`name`/`displayName` from schemas |
| `shared/schemas/gameState.ts` | Modify | Remove dead `name` from `FloorStateSchema` |
| `shared/types/index.ts` | Modify | Remove `name` from `Floor` interface |
| `shared/config/workerNames.ts` | Modify | Locale-keyed name pools, English populated |
| `shared/config/__tests__/gameConfig.test.ts` | Modify | Update for ID-only config shape |
| `src/stores/__tests__/gameStore.test.ts` | Modify | Update local `testConfig` for new shape |
| `src/stores/authStore.ts` | Modify | Locale-aware guest name pools |
| `server/src/sync/sync.service.ts` | Modify | Drop dead floor-name reconstruction |
| `src/components/FloorCard.tsx` | Modify | Translate, consolidate `FLOOR_SCHEMES` dedup |
| `src/components/WorkerCard.tsx` | Modify | Translate |
| `src/components/JobPickerSheet.tsx` | Modify | Translate |
| `src/components/ProductionCard.tsx` | Modify | Translate |
| `src/components/HotelPanel.tsx` | Modify | Translate |
| `src/components/TechnicalFloor.tsx` | Modify | Translate |
| `src/components/LevelUpModal.tsx` | Modify | Translate |
| `src/components/DeliverAllModal.tsx` | Modify | Translate |
| `src/components/LobbyPanel.tsx` | Modify | Translate |
| `src/components/BottomNav.tsx` | Modify | Translate (shares tab labels with `_layout.tsx`) |
| `app/(tabs)/_layout.tsx` | Modify | Translate tab labels |
| `app/(tabs)/city.tsx` | Modify | Translate |
| `app/(tabs)/shop.tsx` | Modify | Translate |
| `app/(tabs)/profile.tsx` | Modify | Translate |
| `src/screens/LoginScreen.tsx` | Modify | Translate |
| `src/screens/WelcomeScreen.tsx` | Modify | Translate |

---

## Task 1: Install i18n dependencies

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install packages**

```bash
npm install i18next react-i18next
npx expo install expo-localization
```

- [ ] **Step 2: Verify install**

Run: `node -e "console.log(require('./package.json').dependencies['i18next'], require('./package.json').dependencies['react-i18next'], require('./package.json').dependencies['expo-localization'])"`
Expected: three version strings printed, no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add i18next, react-i18next, expo-localization"
```

---

## Task 2: Pure language-resolution logic

**Files:**
- Create: `src/i18n/language.ts`
- Test: `src/i18n/__tests__/language.test.ts`

**Interfaces:**
- Produces: `SupportedLanguage` (type, currently `'en'`), `SUPPORTED_LANGUAGES: readonly SupportedLanguage[]`, `DEFAULT_LANGUAGE: SupportedLanguage`, `pickLanguage(storedLanguage: string | null, deviceLanguageCodes: (string | null)[], supported?: readonly string[], fallback?: string): string`

- [ ] **Step 1: Write the failing test**

Create `src/i18n/__tests__/language.test.ts`:

```ts
import { pickLanguage, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '../language';

describe('pickLanguage', () => {
  it('returns the stored language when it is supported', () => {
    expect(pickLanguage('en', ['fr', 'de'], ['en', 'fr'])).toBe('en');
  });

  it('ignores a stored language that is not supported', () => {
    expect(pickLanguage('de', ['fr'], ['en', 'fr'], 'en')).toBe('fr');
  });

  it('falls back to the first supported device locale when nothing is stored', () => {
    expect(pickLanguage(null, ['fr', 'en'], ['en', 'fr'])).toBe('fr');
  });

  it('skips unsupported device locales to find a supported one', () => {
    expect(pickLanguage(null, ['de', 'en'], ['en', 'fr'])).toBe('en');
  });

  it('falls back to the default language when nothing matches', () => {
    expect(pickLanguage(null, ['de', 'fr'], ['en'], 'en')).toBe('en');
  });

  it('exports en as the only supported language for now', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['en']);
    expect(DEFAULT_LANGUAGE).toBe('en');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/i18n/__tests__/language.test.ts`
Expected: FAIL — `Cannot find module '../language'`

- [ ] **Step 3: Write minimal implementation**

Create `src/i18n/language.ts`:

```ts
export type SupportedLanguage = 'en';

export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = ['en'];
export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

export function pickLanguage(
  storedLanguage: string | null,
  deviceLanguageCodes: (string | null)[],
  supported: readonly string[] = SUPPORTED_LANGUAGES,
  fallback: string = DEFAULT_LANGUAGE,
): string {
  if (storedLanguage && supported.includes(storedLanguage)) {
    return storedLanguage;
  }

  for (const code of deviceLanguageCodes) {
    if (code && supported.includes(code)) {
      return code;
    }
  }

  return fallback;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/i18n/__tests__/language.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/i18n/language.ts src/i18n/__tests__/language.test.ts
git commit -m "feat(i18n): add pure language-resolution logic"
```

---

## Task 3: i18next runtime init + locale scaffolding

**Files:**
- Create: `src/i18n/index.ts`
- Create: `src/i18n/locales/en/common.json`
- Create: `src/i18n/locales/en/auth.json`
- Create: `src/i18n/locales/en/tabs.json`
- Create: `src/i18n/locales/en/hotel.json` (stub)
- Create: `src/i18n/locales/en/lobby.json` (stub)
- Create: `src/i18n/locales/en/gameContent.json` (stub)
- Modify: `app/_layout.tsx:1`

**Interfaces:**
- Consumes: `pickLanguage`, `SUPPORTED_LANGUAGES`, `DEFAULT_LANGUAGE`, `SupportedLanguage` from `./language` (Task 2)
- Produces: default export `i18next` instance (already initialized), `setAppLanguage(lang: SupportedLanguage): void`. Namespaces registered: `common`, `auth`, `tabs`, `hotel`, `lobby`, `gameContent`.

- [ ] **Step 1: Create the namespace JSON files**

Create `src/i18n/locales/en/common.json`:

```json
{
  "actions": {
    "login": "Log In",
    "register": "Register",
    "cancel": "Cancel",
    "or": "or"
  },
  "relativeTime": {
    "never": "never",
    "justNow": "just now",
    "minutesAgo": "{{count}}m ago",
    "hoursAgo": "{{count}}h ago",
    "daysAgo": "{{count}}d ago"
  }
}
```

Create `src/i18n/locales/en/auth.json`:

```json
{
  "login": {
    "errors": {
      "fillAllFields": "Please fill in all fields",
      "enterPlayerName": "Enter a player name",
      "passwordTooShort": "Password must be at least 6 characters",
      "somethingWentWrong": "Something went wrong"
    },
    "welcomeBack": {
      "title": "Welcome back!",
      "subtitle": "Log in to keep building your tower"
    },
    "createAccount": {
      "title": "Create an account",
      "subtitle": "Save your progress and play on any device"
    },
    "tabs": {
      "login": "Log In",
      "register": "Register"
    },
    "labels": {
      "playerName": "Player Name",
      "email": "Email",
      "password": "Password"
    },
    "placeholders": {
      "playerName": "What should we call you?",
      "email": "you@example.com",
      "password": "At least 6 characters"
    },
    "forgotPassword": "Forgot password?",
    "terms": {
      "accept": "I accept the ",
      "and": " and ",
      "termsOfUse": "Terms of Use",
      "privacyPolicy": "Privacy Policy"
    },
    "submit": {
      "login": "Log In",
      "createAccount": "Create Account"
    }
  },
  "welcome": {
    "errors": {
      "enterPassword": "Enter password",
      "wrongPassword": "Incorrect password"
    },
    "bubble": "Build higher,\nearn more  ",
    "chips": {
      "floorsLabel": "floors"
    },
    "passwordPrompt": {
      "placeholder": "Password"
    },
    "continueLabel": {
      "authenticated": "Continue",
      "hasAccount": "Continue Game"
    },
    "playButton": "Start Building!",
    "guestNote": "Your progress will be saved after registering",
    "terms": {
      "continuingText": "By continuing, you accept our ",
      "and": " and ",
      "terms": "Terms",
      "policy": "Policy"
    }
  }
}
```

Create `src/i18n/locales/en/tabs.json`:

```json
{
  "labels": {
    "tower": "Tower",
    "city": "City",
    "shop": "Shop",
    "profile": "Profile"
  },
  "city": {
    "title": "City",
    "comingSoon": "Nothing here yet"
  },
  "shop": {
    "title": "Shop",
    "comingSoon": "Nothing here yet"
  },
  "profile": {
    "title": "Profile",
    "guestFallbackName": "Player",
    "stats": {
      "level": "Level",
      "xp": "XP"
    },
    "sync": {
      "online": "You're online",
      "pending_one": "{{count}} command not synced",
      "pending_other": "{{count}} commands not synced",
      "critical": "{{count}} commands not synced · possible data loss"
    },
    "logout": "Log Out"
  }
}
```

Create `src/i18n/locales/en/hotel.json` (stub, filled in by later tasks):

```json
{}
```

Create `src/i18n/locales/en/lobby.json` (stub, filled in by a later task):

```json
{}
```

Create `src/i18n/locales/en/gameContent.json` (stub, filled in by Task 4):

```json
{}
```

- [ ] **Step 2: Create the i18next init module**

Create `src/i18n/index.ts`:

```ts
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import { createMMKV } from 'react-native-mmkv';
import {
  pickLanguage,
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from './language';

import common from './locales/en/common.json';
import auth from './locales/en/auth.json';
import tabs from './locales/en/tabs.json';
import hotel from './locales/en/hotel.json';
import lobby from './locales/en/lobby.json';
import gameContent from './locales/en/gameContent.json';

const LANGUAGE_STORAGE_KEY = 'appLanguage';

let languageStorage: ReturnType<typeof createMMKV> | null = null;
function getLanguageStorage() {
  if (!languageStorage) {
    languageStorage = createMMKV({ id: 'settings' });
  }
  return languageStorage;
}

const storedLanguage = getLanguageStorage().getString(LANGUAGE_STORAGE_KEY) ?? null;
const deviceLanguageCodes = Localization.getLocales().map((locale) => locale.languageCode);
const initialLanguage = pickLanguage(
  storedLanguage,
  deviceLanguageCodes,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
);

i18next.use(initReactI18next).init({
  lng: initialLanguage,
  fallbackLng: DEFAULT_LANGUAGE,
  initImmediate: false,
  ns: ['common', 'auth', 'tabs', 'hotel', 'lobby', 'gameContent'],
  defaultNS: 'common',
  resources: {
    en: { common, auth, tabs, hotel, lobby, gameContent },
  },
  interpolation: { escapeValue: false },
});

export function setAppLanguage(lang: SupportedLanguage): void {
  getLanguageStorage().set(LANGUAGE_STORAGE_KEY, lang);
  i18next.changeLanguage(lang);
}

export default i18next;
```

- [ ] **Step 3: Wire the import into the app root, before anything else**

Edit `app/_layout.tsx`, change:

```ts
import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
```

to:

```ts
import '../src/i18n';
import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
```

- [ ] **Step 4: Verify with typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors (pre-existing deprecation warning, if any, is unrelated).

- [ ] **Step 5: Manual smoke check**

Run: `npx expo start` and open the app in a simulator/device. Confirm it launches with no crash and no visible flash/flicker of a loading state before the UI appears (there's no UI text driven by i18n yet, so this just confirms the synchronous init doesn't break startup).

- [ ] **Step 6: Commit**

```bash
git add src/i18n app/_layout.tsx
git commit -m "feat(i18n): initialize i18next synchronously before first render"
```

---

## Task 4: Populate game-content translations

**Files:**
- Modify: `src/i18n/locales/en/gameContent.json`

**Interfaces:**
- Consumes: ids already defined in `shared/config/gameConfig.ts` — floor type keys (`green`, `teal`, `amber`, `purple`, `blue`), floor ids (`2`, `3`, `4`), production type keys (`bulky`, `cupcake`, `cake`, `wash`, `dry`, `bleach`, `coffee`, `pancake`, `dessert`)
- Produces: keys `floorTypes.<key>.category`, `floors.<id>.name`, `productionTypes.<key>.displayName` under the `gameContent` namespace, consumed by Tasks 5–13.

- [ ] **Step 1: Fill in the content**

Replace the contents of `src/i18n/locales/en/gameContent.json`:

```json
{
  "floorTypes": {
    "green": { "category": "Bakery" },
    "teal": { "category": "Laundry" },
    "amber": { "category": "Coffee Shop" },
    "purple": { "category": "Perfumery" },
    "blue": { "category": "Ice Cream Parlor" }
  },
  "floors": {
    "2": { "name": "Bakery" },
    "3": { "name": "Laundry" },
    "4": { "name": "Coffee Shop" }
  },
  "productionTypes": {
    "bulky": { "displayName": "Buns" },
    "cupcake": { "displayName": "Cupcakes" },
    "cake": { "displayName": "Cakes" },
    "wash": { "displayName": "Wash" },
    "dry": { "displayName": "Dry" },
    "bleach": { "displayName": "Bleach" },
    "coffee": { "displayName": "Coffee" },
    "pancake": { "displayName": "Pancakes" },
    "dessert": { "displayName": "Desserts" }
  }
}
```

- [ ] **Step 2: Verify it's valid JSON and importable**

Run: `node -e "console.log(Object.keys(require('./src/i18n/locales/en/gameContent.json').productionTypes).length)"`
Expected: `9`

- [ ] **Step 3: Commit**

```bash
git add src/i18n/locales/en/gameContent.json
git commit -m "feat(i18n): populate gameContent translations"
```

---

## Task 5: Translate FloorCard.tsx and consolidate the display-name duplicate

**Files:**
- Modify: `src/components/FloorCard.tsx`
- Modify: `src/i18n/locales/en/hotel.json`

**Interfaces:**
- Consumes: `gameContent:floors.<id>.name`, `gameContent:productionTypes.<key>.displayName` (Task 4)
- Produces: `FLOOR_SCHEMES` (exported, used by `JobPickerSheet.tsx`) no longer has a `displayName` field — confirm no other file reads `FLOOR_SCHEMES[...].displayName` before removing it.

- [ ] **Step 1: Confirm no other consumer reads `FLOOR_SCHEMES[...].displayName`**

Run: `grep -rn "displayName" src/components/JobPickerSheet.tsx`
Expected: no matches (JobPickerSheet only reads `headerColors` off `FLOOR_SCHEMES`, confirmed in Task 7).

- [ ] **Step 2: Add hotel.json entries for this file**

Edit `src/i18n/locales/en/hotel.json`, replace `{}` with:

```json
{
  "floorCard": {
    "productFallback": "Product {{index}}"
  }
}
```

- [ ] **Step 3: Remove `displayName` from the scheme interface and data**

Edit `src/components/FloorCard.tsx`, change:

```ts
export interface FloorColorScheme {
  headerColors: [string, string];
  headerShadowColor: string;
  bodyColor: string;
  cardBg: string;
  nameColor: string;
  displayName: string;
  stars: number;
}

export const FLOOR_SCHEMES: Record<number, FloorColorScheme> = {
  2: {
    headerColors: ['#74C44F', '#5DA83C'],
    headerShadowColor: 'rgba(40,70,25,0.4)',
    bodyColor: '#D2EAB4',
    cardBg: '#F2F8E9',
    nameColor: '#5B963A',
    displayName: 'КОНДИТЕРСЬКА',
    stars: 0,
  },
  3: {
    headerColors: ['#43BCAA', '#2E9E8E'],
    headerShadowColor: 'rgba(20,70,60,0.4)',
    bodyColor: '#BEE6DD',
    cardBg: '#EBF7F3',
    nameColor: '#2E9384',
    displayName: 'ПРАЛЬНЯ',
    stars: 0,
  },
  4: {
    headerColors: ['#F2B838', '#E09E10'],
    headerShadowColor: 'rgba(120,80,0,0.4)',
    bodyColor: '#F7E4AC',
    cardBg: '#FDF8E9',
    nameColor: '#B5871E',
    displayName: "КАВ'ЯРНЯ",
    stars: 0,
  },
};
```

to:

```ts
export interface FloorColorScheme {
  headerColors: [string, string];
  headerShadowColor: string;
  bodyColor: string;
  cardBg: string;
  nameColor: string;
  stars: number;
}

export const FLOOR_SCHEMES: Record<number, FloorColorScheme> = {
  2: {
    headerColors: ['#74C44F', '#5DA83C'],
    headerShadowColor: 'rgba(40,70,25,0.4)',
    bodyColor: '#D2EAB4',
    cardBg: '#F2F8E9',
    nameColor: '#5B963A',
    stars: 0,
  },
  3: {
    headerColors: ['#43BCAA', '#2E9E8E'],
    headerShadowColor: 'rgba(20,70,60,0.4)',
    bodyColor: '#BEE6DD',
    cardBg: '#EBF7F3',
    nameColor: '#2E9384',
    stars: 0,
  },
  4: {
    headerColors: ['#F2B838', '#E09E10'],
    headerShadowColor: 'rgba(120,80,0,0.4)',
    bodyColor: '#F7E4AC',
    cardBg: '#FDF8E9',
    nameColor: '#B5871E',
    stars: 0,
  },
};
```

- [ ] **Step 4: Drop the `title` field from `PRODUCT_IMAGES` (now redundant with `gameContent`)**

Change:

```ts
// Product names and images for each floor's 3 slots
const PRODUCT_IMAGES: Record<number, { title: string; image: ImageSource }[]> = {
  2: [
    { title: 'Булки', image: require('../../assets/products/bulky.png') },
    { title: 'Пирожені', image: require('../../assets/products/cupcake.png') },
    { title: 'Торти', image: require('../../assets/products/cake.png') },
  ],
  3: [
    { title: 'Прання', image: require('../../assets/products/wash.png') },
    { title: 'Сушка', image: require('../../assets/products/dry.png') },
    { title: 'Відбілювання', image: require('../../assets/products/bleach.png') },
  ],
  4: [
    { title: 'Кава', image: require('../../assets/products/coffee.png') },
    { title: 'Млинці', image: require('../../assets/products/pancake.png') },
    { title: 'Десерти', image: require('../../assets/products/dessert.png') },
  ],
};
```

to:

```ts
// Product images for each floor's 3 slots (display names come from the gameContent i18n namespace)
const PRODUCT_IMAGES: Record<number, { image: ImageSource }[]> = {
  2: [
    { image: require('../../assets/products/bulky.png') },
    { image: require('../../assets/products/cupcake.png') },
    { image: require('../../assets/products/cake.png') },
  ],
  3: [
    { image: require('../../assets/products/wash.png') },
    { image: require('../../assets/products/dry.png') },
    { image: require('../../assets/products/bleach.png') },
  ],
  4: [
    { image: require('../../assets/products/coffee.png') },
    { image: require('../../assets/products/pancake.png') },
    { image: require('../../assets/products/dessert.png') },
  ],
};
```

- [ ] **Step 5: Add the `useTranslation` hooks and use them for the floor name and product titles**

Change:

```ts
import ProductionCard from './ProductionCard';
import { useFloor, useGameStore } from '../stores/gameStore';
import { gameConfig } from '../../shared/config/gameConfig';
import { getWorkerForSlot, getFloorDiscount } from '../../shared/engine/workerUtils';
import type { ImageSource } from 'expo-image';
```

to:

```ts
import { useTranslation } from 'react-i18next';
import ProductionCard from './ProductionCard';
import { useFloor, useGameStore } from '../stores/gameStore';
import { gameConfig } from '../../shared/config/gameConfig';
import { getWorkerForSlot, getFloorDiscount } from '../../shared/engine/workerUtils';
import type { ImageSource } from 'expo-image';
```

Change:

```ts
function FloorCardInner({ floorId, balance, now, onHireSlot }: FloorCardProps) {
  const floor = useFloor(floorId);
  const workers = useGameStore((s) => s.workers);
  const scheme = FLOOR_SCHEMES[floorId] || FLOOR_SCHEMES[1];
  const floorConfig = gameConfig.floors.find((f) => f.id === floorId);
  const availableTypes = floorConfig?.availableTypes ?? [];
  const products = PRODUCT_IMAGES[floorId] || PRODUCT_IMAGES[1];
  const discount = getFloorDiscount(workers, floorId);
```

to:

```ts
function FloorCardInner({ floorId, balance, now, onHireSlot }: FloorCardProps) {
  const { t } = useTranslation('hotel');
  const { t: tContent } = useTranslation('gameContent');
  const floor = useFloor(floorId);
  const workers = useGameStore((s) => s.workers);
  const scheme = FLOOR_SCHEMES[floorId] || FLOOR_SCHEMES[1];
  const floorConfig = gameConfig.floors.find((f) => f.id === floorId);
  const availableTypes = floorConfig?.availableTypes ?? [];
  const products = PRODUCT_IMAGES[floorId] || PRODUCT_IMAGES[1];
  const discount = getFloorDiscount(workers, floorId);
  const floorName = tContent(`floors.${floorId}.name`, { defaultValue: `Floor ${floorId}` });
```

Change:

```tsx
        <Text style={[styles.floorName, { textShadowColor: scheme.headerShadowColor }]}>
          {scheme.displayName}
        </Text>
```

to:

```tsx
        <Text style={[styles.floorName, { textShadowColor: scheme.headerShadowColor }]}>
          {floorName}
        </Text>
```

Change:

```tsx
              productTitle={products[idx]?.title ?? `Товар ${idx + 1}`}
```

to:

```tsx
              productTitle={tContent(`productionTypes.${availableTypes[idx]}.displayName`, {
                defaultValue: availableTypes[idx] ?? t('floorCard.productFallback', { index: idx + 1 }),
              })}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/FloorCard.tsx src/i18n/locales/en/hotel.json
git commit -m "feat(i18n): translate FloorCard and drop duplicate display-name map"
```

---

## Task 6: Translate WorkerCard.tsx

**Files:**
- Modify: `src/components/WorkerCard.tsx`
- Modify: `src/i18n/locales/en/hotel.json`

**Interfaces:**
- Consumes: `gameContent:floorTypes.<key>.category`, `gameContent:productionTypes.<key>.displayName` (Task 4)

- [ ] **Step 1: Add hotel.json entries**

Edit `src/i18n/locales/en/hotel.json`, add a `workerCard` key alongside the existing `floorCard` key:

```json
{
  "floorCard": {
    "productFallback": "Product {{index}}"
  },
  "workerCard": {
    "unemployedFemale": "Unemployed",
    "unemployedMale": "Unemployed",
    "level": "LEVEL",
    "info": {
      "skill": "Skill",
      "dreamJob": "Dream Job",
      "worksAt": "Works At",
      "livesAt": "Lives At",
      "hotel": "Hotel"
    },
    "actions": {
      "findJob": "Find Job",
      "evict": "Evict"
    },
    "hint": "The higher a worker's skill, the bigger the purchase discount they give"
  }
}
```

- [ ] **Step 2: Add the hooks and replace `gameConfig` display-text reads**

Change:

```ts
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { gameConfig } from '../../shared/config/gameConfig';
import type { Worker } from '../../shared/types';
import WorkerAvatar from './WorkerAvatar';
```

to:

```ts
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { gameConfig } from '../../shared/config/gameConfig';
import type { Worker } from '../../shared/types';
import WorkerAvatar from './WorkerAvatar';
```

Change:

```ts
  const ft = gameConfig.floorTypes[worker.floorType];
  const accent = ft?.accent ?? '#888';
  const shirtColor = ft?.shirtColor ?? '#999';
  const category = ft?.category ?? worker.floorType;
  const dreamJobName =
    gameConfig.productionTypes[worker.dreamJob]?.displayName ?? worker.dreamJob;
```

to:

```ts
  const { t } = useTranslation('hotel');
  const { t: tContent } = useTranslation('gameContent');
  const ft = gameConfig.floorTypes[worker.floorType];
  const accent = ft?.accent ?? '#888';
  const shirtColor = ft?.shirtColor ?? '#999';
  const category = tContent(`floorTypes.${worker.floorType}.category`, { defaultValue: worker.floorType });
  const dreamJobName = tContent(`productionTypes.${worker.dreamJob}.displayName`, { defaultValue: worker.dreamJob });
```

- [ ] **Step 3: Translate the remaining chrome**

Change:

```ts
  const isUnemployed = worker.assignedFloorId === null;
  const statusText = worker.female ? 'Безробітна' : 'Безробітний';
```

to:

```ts
  const isUnemployed = worker.assignedFloorId === null;
  const statusText = worker.female ? t('workerCard.unemployedFemale') : t('workerCard.unemployedMale');
```

Change:

```tsx
            <Text style={styles.levelLabel}>РІВЕНЬ</Text>
```

to:

```tsx
            <Text style={styles.levelLabel}>{t('workerCard.level')}</Text>
```

Change:

```tsx
            <InfoRow label="Навичка" value={`${category} · рівень ${worker.level}`} />
            <InfoRow label="Робота мрії" value={dreamJobName} />
            <InfoRow
              label="Працює"
              value={worker.female ? 'Безробітна' : 'Безробітний'}
            />
            <InfoRow label="Проживає" value="Готель" />
```

to:

```tsx
            <InfoRow label={t('workerCard.info.skill')} value={`${category} · ${worker.level}`} />
            <InfoRow label={t('workerCard.info.dreamJob')} value={dreamJobName} />
            <InfoRow
              label={t('workerCard.info.worksAt')}
              value={worker.female ? t('workerCard.unemployedFemale') : t('workerCard.unemployedMale')}
            />
            <InfoRow label={t('workerCard.info.livesAt')} value={t('workerCard.info.hotel')} />
```

Change:

```tsx
              <Text style={styles.actionButtonText}>Знайти роботу</Text>
```

to:

```tsx
              <Text style={styles.actionButtonText}>{t('workerCard.actions.findJob')}</Text>
```

Change:

```tsx
              <Text style={styles.actionButtonText}>Виселити</Text>
```

to:

```tsx
              <Text style={styles.actionButtonText}>{t('workerCard.actions.evict')}</Text>
```

Change:

```tsx
          <Text style={styles.hintText}>
            Чим вищий навик працівника, тим більшу знижку на закупівлю він дає
          </Text>
```

to:

```tsx
          <Text style={styles.hintText}>
            {t('workerCard.hint')}
          </Text>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/WorkerCard.tsx src/i18n/locales/en/hotel.json
git commit -m "feat(i18n): translate WorkerCard"
```

---

## Task 7: Translate JobPickerSheet.tsx

**Files:**
- Modify: `src/components/JobPickerSheet.tsx`
- Modify: `src/i18n/locales/en/hotel.json`

**Interfaces:**
- Consumes: `gameContent:floorTypes.<key>.category`, `gameContent:floors.<id>.name`, `gameContent:productionTypes.<key>.displayName` (Task 4)
- Produces: `FloorSection` no longer carries a `floorName` field — `SectionHeader` derives it itself.

- [ ] **Step 1: Add hotel.json entries**

Edit `src/i18n/locales/en/hotel.json`, add a `jobPicker` key:

```json
  "jobPicker": {
    "matchBadges": {
      "dream": "Dream Job · 2x",
      "match": "Matching Type · 1.3x",
      "other": "Other Type · 1x"
    },
    "empty": "All slots are taken",
    "assign": "Assign"
  }
```

- [ ] **Step 2: Import the hook**

Change:

```ts
import { useGameStore } from '../stores/gameStore';
import { gameConfig } from '../../shared/config/gameConfig';
import { getWorkerForSlot } from '../../shared/engine/workerUtils';
```

to:

```ts
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../stores/gameStore';
import { gameConfig } from '../../shared/config/gameConfig';
import { getWorkerForSlot } from '../../shared/engine/workerUtils';
```

- [ ] **Step 3: Translate `MATCH_BADGES` — move labels into a hook-driven lookup**

`MATCH_BADGES` is a module-level constant today; since its `label` needs `t()`, move label lookup inside the component instead of the constant. Change:

```ts
const MATCH_BADGES = {
  dream: {
    label: 'Робота мрії · 2x',
    bg: 'rgba(82,184,71,0.15)',
    text: '#4E9A2E',
  },
  match: {
    label: 'Підходящий тип · 1.3x',
    bg: 'rgba(240,185,42,0.15)',
    text: '#B07F12',
  },
  other: {
    label: 'Інший тип · 1x',
    bg: 'rgba(0,0,0,0.05)',
    text: '#9098A6',
  },
} as const;
```

to:

```ts
const MATCH_BADGE_STYLES = {
  dream: { bg: 'rgba(82,184,71,0.15)', text: '#4E9A2E' },
  match: { bg: 'rgba(240,185,42,0.15)', text: '#B07F12' },
  other: { bg: 'rgba(0,0,0,0.05)', text: '#9098A6' },
} as const;
```

- [ ] **Step 4: Remove `floorName` from `FloorSection` and its construction**

Change:

```ts
interface FloorSection {
  floorId: number;
  floorName: string;
  floorType: string;
  data: SlotItem[];
}
```

to:

```ts
interface FloorSection {
  floorId: number;
  floorType: string;
  data: SlotItem[];
}
```

Change:

```ts
      result.push({
        floorId: floorConfig.id,
        floorName: floorConfig.name,
        floorType: floorConfig.floorType,
        data: slots,
      });
```

to:

```ts
      result.push({
        floorId: floorConfig.id,
        floorType: floorConfig.floorType,
        data: slots,
      });
```

- [ ] **Step 5: Use the hook in the main component for the category pill**

Change:

```ts
  const ft = worker ? gameConfig.floorTypes[worker.floorType] : null;
  const accent = ft?.accent ?? '#888';
  const category = ft?.category ?? worker?.floorType ?? '';

  const isEmpty = sections.length === 0;
```

to:

```ts
  const { t } = useTranslation('hotel');
  const { t: tContent } = useTranslation('gameContent');
  const ft = worker ? gameConfig.floorTypes[worker.floorType] : null;
  const accent = ft?.accent ?? '#888';
  const category = tContent(`floorTypes.${worker?.floorType ?? ''}.category`, {
    defaultValue: worker?.floorType ?? '',
  });

  const isEmpty = sections.length === 0;
```

Change:

```tsx
            <Text style={styles.emptyText}>Всі місця зайняті</Text>
```

to:

```tsx
            <Text style={styles.emptyText}>{t('jobPicker.empty')}</Text>
```

- [ ] **Step 6: `SectionHeader` derives the floor name itself**

Change:

```tsx
function SectionHeader({ section }: { section: FloorSection }) {
  const scheme = FLOOR_SCHEMES[section.floorId];
  const headerColors = scheme?.headerColors ?? ['#888', '#777'];

  return (
    <View style={sectionStyles.container}>
      <LinearGradient
        colors={headerColors}
        style={sectionStyles.header}
      >
        <View style={sectionStyles.numberBadge}>
          <Text style={sectionStyles.numberText}>{section.floorId}</Text>
        </View>
        <Text style={sectionStyles.floorName}>{section.floorName}</Text>
      </LinearGradient>
    </View>
  );
}
```

to:

```tsx
function SectionHeader({ section }: { section: FloorSection }) {
  const { t: tContent } = useTranslation('gameContent');
  const scheme = FLOOR_SCHEMES[section.floorId];
  const headerColors = scheme?.headerColors ?? ['#888', '#777'];
  const floorName = tContent(`floors.${section.floorId}.name`, {
    defaultValue: `Floor ${section.floorId}`,
  });

  return (
    <View style={sectionStyles.container}>
      <LinearGradient
        colors={headerColors}
        style={sectionStyles.header}
      >
        <View style={sectionStyles.numberBadge}>
          <Text style={sectionStyles.numberText}>{section.floorId}</Text>
        </View>
        <Text style={sectionStyles.floorName}>{floorName}</Text>
      </LinearGradient>
    </View>
  );
}
```

- [ ] **Step 7: `SlotRow` derives the product name and badge itself**

Change:

```tsx
function SlotRow({
  item,
  onAssign,
}: {
  item: SlotItem;
  onAssign: (floorId: number, slotIdx: number) => void;
}) {
  const productConfig = gameConfig.productionTypes[item.typeId];
  const productName = productConfig?.displayName ?? item.typeId;
  const badge = MATCH_BADGES[item.matchLevel];

  return (
    <View style={slotStyles.row}>
      <Text style={slotStyles.productName} numberOfLines={1}>
        {productName}
      </Text>

      <View style={[slotStyles.badge, { backgroundColor: badge.bg }]}>
        <Text style={[slotStyles.badgeText, { color: badge.text }]}>
          {badge.label}
        </Text>
      </View>

      <Pressable
        onPress={() => onAssign(item.floorId, item.slotIdx)}
        style={({ pressed }) => [
          slotStyles.assignButton,
          pressed && slotStyles.assignButtonPressed,
        ]}
      >
        <LinearGradient
          colors={['#72C24F', '#5BA63C']}
          style={slotStyles.assignButtonGradient}
        >
          <Text style={slotStyles.assignButtonText}>Призначити</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}
```

to:

```tsx
function SlotRow({
  item,
  onAssign,
}: {
  item: SlotItem;
  onAssign: (floorId: number, slotIdx: number) => void;
}) {
  const { t } = useTranslation('hotel');
  const { t: tContent } = useTranslation('gameContent');
  const productName = tContent(`productionTypes.${item.typeId}.displayName`, {
    defaultValue: item.typeId,
  });
  const badgeStyle = MATCH_BADGE_STYLES[item.matchLevel];
  const badgeLabel = t(`jobPicker.matchBadges.${item.matchLevel}`);

  return (
    <View style={slotStyles.row}>
      <Text style={slotStyles.productName} numberOfLines={1}>
        {productName}
      </Text>

      <View style={[slotStyles.badge, { backgroundColor: badgeStyle.bg }]}>
        <Text style={[slotStyles.badgeText, { color: badgeStyle.text }]}>
          {badgeLabel}
        </Text>
      </View>

      <Pressable
        onPress={() => onAssign(item.floorId, item.slotIdx)}
        style={({ pressed }) => [
          slotStyles.assignButton,
          pressed && slotStyles.assignButtonPressed,
        ]}
      >
        <LinearGradient
          colors={['#72C24F', '#5BA63C']}
          style={slotStyles.assignButtonGradient}
        >
          <Text style={slotStyles.assignButtonText}>{t('jobPicker.assign')}</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 9: Commit**

```bash
git add src/components/JobPickerSheet.tsx src/i18n/locales/en/hotel.json
git commit -m "feat(i18n): translate JobPickerSheet"
```

---

## Task 8: Translate ProductionCard.tsx

**Files:**
- Modify: `src/components/ProductionCard.tsx`
- Modify: `src/i18n/locales/en/hotel.json`

**Interfaces:**
- Consumes: nothing new from earlier tasks (this file receives `productTitle` as a prop, already translated by Task 5's `FloorCard`).

- [ ] **Step 1: Add hotel.json entries**

Edit `src/i18n/locales/en/hotel.json`, add a `productionCard` key:

```json
  "productionCard": {
    "time": {
      "seconds": "{{count}}s",
      "minutesSeconds": "{{minutes}}m {{seconds}}s",
      "hoursMinutes": "{{hours}}h {{minutes}}m",
      "daysHours": "{{days}}d {{hours}}h",
      "minutes": "{{count}}m",
      "hours": "{{count}}h",
      "days": "{{count}}d"
    },
    "actions": {
      "hire": "Hire",
      "buy": "Buy",
      "list": "List",
      "collect": "Collect"
    },
    "status": {
      "delivering": "Delivering",
      "selling": "Selling"
    }
  }
```

- [ ] **Step 2: Import the hook and translate the time formatters**

Change:

```ts
import { getProductionStatus } from '../../shared/engine/productionStatus';
import { getRevenueMultiplier } from '../../shared/engine/workerUtils';
import { useGameStore } from '../stores/gameStore';
import { gameConfig } from '../../shared/config/gameConfig';
import WorkerAvatar from './WorkerAvatar';
```

to:

```ts
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { getProductionStatus } from '../../shared/engine/productionStatus';
import { getRevenueMultiplier } from '../../shared/engine/workerUtils';
import { useGameStore } from '../stores/gameStore';
import { gameConfig } from '../../shared/config/gameConfig';
import WorkerAvatar from './WorkerAvatar';
```

`formatTime`/`formatDuration` are plain module-level functions (not components), so they use the shared `i18n.t()` directly rather than the `useTranslation` hook (which can only be called inside a component). Change:

```ts
function formatTime(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  if (totalSec < 60) return `${totalSec} с.`;
  const totalMin = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (totalMin < 60) return `${totalMin} хв. ${sec} с.`;
  const hours = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  if (hours < 24) return `${hours} г. ${min} хв.`;
  const days = Math.floor(hours / 24);
  const h = hours % 24;
  return `${days} дн. ${h} г.`;
}

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec} с.`;
  const min = Math.floor(totalSec / 60);
  if (min < 60) return `${min} хв.`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} г.`;
  return `${Math.floor(hours / 24)} дн.`;
}
```

to:

```ts
function formatTime(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  if (totalSec < 60) return i18n.t('hotel:productionCard.time.seconds', { count: totalSec });
  const totalMin = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (totalMin < 60) return i18n.t('hotel:productionCard.time.minutesSeconds', { minutes: totalMin, seconds: sec });
  const hours = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  if (hours < 24) return i18n.t('hotel:productionCard.time.hoursMinutes', { hours, minutes: min });
  const days = Math.floor(hours / 24);
  const h = hours % 24;
  return i18n.t('hotel:productionCard.time.daysHours', { days, hours: h });
}

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return i18n.t('hotel:productionCard.time.seconds', { count: totalSec });
  const min = Math.floor(totalSec / 60);
  if (min < 60) return i18n.t('hotel:productionCard.time.minutes', { count: min });
  const hours = Math.floor(min / 60);
  if (hours < 24) return i18n.t('hotel:productionCard.time.hours', { count: hours });
  return i18n.t('hotel:productionCard.time.days', { count: Math.floor(hours / 24) });
}
```

- [ ] **Step 3: Translate the labels inside the component**

Change:

```ts
  const isHire = effectiveStage === 'EMPTY';
  const isTimer = effectiveStage === 'DELIVERING' || effectiveStage === 'SELLING' || effectiveStage === 'READY_TO_LIST';
  const isLocked = !worker;

  // Label text
  let labelText = '';
  let subText = '';
  switch (effectiveStage) {
    case 'EMPTY':
      labelText = 'Найняти';
      subText = typeConfig ? String(effectiveCost) : '';
      break;
    case 'IDLE':
      labelText = 'Закупити';
      subText = typeConfig ? String(effectiveCost) : '';
      break;
    case 'DELIVERING':
      labelText = formatTime(timeRemaining);
      subText = 'Доставка';
      break;
    case 'READY_TO_LIST':
      labelText = 'Викласти';
      subText = typeConfig ? formatDuration(typeConfig.sellDuration) : '';
      break;
    case 'SELLING':
      labelText = formatTime(timeRemaining);
      subText = 'Продаж';
      break;
    case 'READY_TO_COLLECT':
      labelText = 'Зібрати';
      subText = typeConfig ? String(effectiveRevenue) : '';
      break;
  }
```

to:

```ts
  const { t } = useTranslation('hotel');
  const isHire = effectiveStage === 'EMPTY';
  const isTimer = effectiveStage === 'DELIVERING' || effectiveStage === 'SELLING' || effectiveStage === 'READY_TO_LIST';
  const isLocked = !worker;

  // Label text
  let labelText = '';
  let subText = '';
  switch (effectiveStage) {
    case 'EMPTY':
      labelText = t('productionCard.actions.hire');
      subText = typeConfig ? String(effectiveCost) : '';
      break;
    case 'IDLE':
      labelText = t('productionCard.actions.buy');
      subText = typeConfig ? String(effectiveCost) : '';
      break;
    case 'DELIVERING':
      labelText = formatTime(timeRemaining);
      subText = t('productionCard.status.delivering');
      break;
    case 'READY_TO_LIST':
      labelText = t('productionCard.actions.list');
      subText = typeConfig ? formatDuration(typeConfig.sellDuration) : '';
      break;
    case 'SELLING':
      labelText = formatTime(timeRemaining);
      subText = t('productionCard.status.selling');
      break;
    case 'READY_TO_COLLECT':
      labelText = t('productionCard.actions.collect');
      subText = typeConfig ? String(effectiveRevenue) : '';
      break;
  }
```

Change (the locked/no-worker hire button, which duplicates the `EMPTY` label):

```tsx
            <StageIcon stage={'EMPTY'} />
            <Text style={styles.actionLabel}>Найняти</Text>
```

to:

```tsx
            <StageIcon stage={'EMPTY'} />
            <Text style={styles.actionLabel}>{t('productionCard.actions.hire')}</Text>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ProductionCard.tsx src/i18n/locales/en/hotel.json
git commit -m "feat(i18n): translate ProductionCard"
```

---

## Task 9: Translate HotelPanel.tsx

**Files:**
- Modify: `src/components/HotelPanel.tsx`
- Modify: `src/i18n/locales/en/hotel.json`

- [ ] **Step 1: Add hotel.json entries**

Edit `src/i18n/locales/en/hotel.json`, add a `hotelPanel` key:

```json
  "hotelPanel": {
    "title": "Hotel",
    "subtitle": "Residents · job search",
    "seats": "Seats",
    "free": "Free",
    "evictConfirm": {
      "title": "Evict worker?",
      "message": "{{name}} will be evicted from the hotel",
      "cancel": "Cancel",
      "confirm": "Evict"
    }
  }
```

- [ ] **Step 2: Import the hook and translate**

Change:

```ts
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useGameStore } from '../stores/gameStore';
import WorkerCard from './WorkerCard';
```

to:

```ts
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../stores/gameStore';
import WorkerCard from './WorkerCard';
```

Change:

```ts
export default function HotelPanel({ visible, onClose }: HotelPanelProps) {
  const [expandedWorkerId, setExpandedWorkerId] = useState<string | null>(null);
```

to:

```ts
export default function HotelPanel({ visible, onClose }: HotelPanelProps) {
  const { t } = useTranslation('hotel');
  const [expandedWorkerId, setExpandedWorkerId] = useState<string | null>(null);
```

Change:

```ts
  const handleEvict = useCallback(
    (workerId: string, workerName: string) => {
      Alert.alert(
        'Виселити працівника?',
        `${workerName} буде виселений з готелю`,
        [
          { text: 'Скасувати', style: 'cancel' },
          {
            text: 'Виселити',
            style: 'destructive',
            onPress: () => {
              useGameStore.getState().evictWorker(workerId);
            },
          },
        ],
      );
    },
    [],
  );
```

to:

```ts
  const handleEvict = useCallback(
    (workerId: string, workerName: string) => {
      Alert.alert(
        t('hotelPanel.evictConfirm.title'),
        t('hotelPanel.evictConfirm.message', { name: workerName }),
        [
          { text: t('hotelPanel.evictConfirm.cancel'), style: 'cancel' },
          {
            text: t('hotelPanel.evictConfirm.confirm'),
            style: 'destructive',
            onPress: () => {
              useGameStore.getState().evictWorker(workerId);
            },
          },
        ],
      );
    },
    [t],
  );
```

Change:

```tsx
                    <View>
                      <Text style={styles.titleText}>Готель</Text>
                      <Text style={styles.subtitleText}>Мешканці · пошук роботи</Text>
                    </View>
```

to:

```tsx
                    <View>
                      <Text style={styles.titleText}>{t('hotelPanel.title')}</Text>
                      <Text style={styles.subtitleText}>{t('hotelPanel.subtitle')}</Text>
                    </View>
```

Change:

```tsx
                  <View style={styles.statPill}>
                    <Text style={styles.statLabel}>Місць</Text>
                    <Text style={styles.statValue}>{hotelCapacity}</Text>
                  </View>
                  <View style={styles.statPill}>
                    <Text style={styles.statLabel}>Вільно</Text>
```

to:

```tsx
                  <View style={styles.statPill}>
                    <Text style={styles.statLabel}>{t('hotelPanel.seats')}</Text>
                    <Text style={styles.statValue}>{hotelCapacity}</Text>
                  </View>
                  <View style={styles.statPill}>
                    <Text style={styles.statLabel}>{t('hotelPanel.free')}</Text>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/HotelPanel.tsx src/i18n/locales/en/hotel.json
git commit -m "feat(i18n): translate HotelPanel"
```

---

## Task 10: Translate TechnicalFloor.tsx

**Files:**
- Modify: `src/components/TechnicalFloor.tsx`
- Modify: `src/i18n/locales/en/hotel.json`

- [ ] **Step 1: Add hotel.json entries**

Edit `src/i18n/locales/en/hotel.json`, add a `technicalFloor` key:

```json
  "technicalFloor": {
    "hotel": {
      "name": "Hotel",
      "tag": "SERVICE",
      "hasVacancy": "Vacancies available",
      "full": "No vacancies",
      "occupied": "OCCUPIED"
    },
    "lobby": {
      "name": "Lobby",
      "tag": "SERVICE",
      "waiting": "Waiting",
      "newGuest": "New guest",
      "full": "Full"
    }
  }
```

- [ ] **Step 2: Import the hook and translate `HotelFloor`**

Change:

```ts
import Svg, { Circle, Path } from 'react-native-svg';
```

to:

```ts
import Svg, { Circle, Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
```

Change:

```ts
export function HotelFloor({ hotelOccupied, hotelTotal, onPress }: HotelFloorProps) {
  const hasVacancy = hotelOccupied < hotelTotal;

  return (
    <Pressable onPress={onPress} style={styles.container}>
      <LinearGradient colors={HEADER_COLORS} style={styles.header}>
        <View style={styles.numberBadge}>
          <Text style={styles.numberText}>1</Text>
        </View>
        <Text style={styles.floorName} numberOfLines={1}>Готель</Text>
        <View style={styles.techTag}>
          <StarIcon />
          <Text style={styles.techTagText}>СЕРВІС</Text>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        <View style={styles.techContent}>
          <Image
            source={require('../../assets/img/hotel.png')}
            style={styles.techImage}
            contentFit="contain"
          />
          <View style={styles.techInfo}>
            <View style={styles.infoRow}>
              {/* Left: vacancy pill */}
              <View style={[styles.statusPill, hasVacancy ? styles.statusGreen : styles.statusRed]}>
                <View style={[styles.statusDot, { backgroundColor: hasVacancy ? '#5BA63C' : '#D14343' }]} />
                <Text style={[styles.statusText, { color: hasVacancy ? '#3C7A2A' : '#A13030' }]}>
                  {hasVacancy ? 'Є вільні місця' : 'Немає вільних'}
                </Text>
              </View>
              {/* Right: occupancy count */}
              <View style={styles.occupancyRight}>
                <Text style={styles.occupancyLabel}>ЗАЙНЯТО</Text>
```

to:

```ts
export function HotelFloor({ hotelOccupied, hotelTotal, onPress }: HotelFloorProps) {
  const { t } = useTranslation('hotel');
  const hasVacancy = hotelOccupied < hotelTotal;

  return (
    <Pressable onPress={onPress} style={styles.container}>
      <LinearGradient colors={HEADER_COLORS} style={styles.header}>
        <View style={styles.numberBadge}>
          <Text style={styles.numberText}>1</Text>
        </View>
        <Text style={styles.floorName} numberOfLines={1}>{t('technicalFloor.hotel.name')}</Text>
        <View style={styles.techTag}>
          <StarIcon />
          <Text style={styles.techTagText}>{t('technicalFloor.hotel.tag')}</Text>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        <View style={styles.techContent}>
          <Image
            source={require('../../assets/img/hotel.png')}
            style={styles.techImage}
            contentFit="contain"
          />
          <View style={styles.techInfo}>
            <View style={styles.infoRow}>
              {/* Left: vacancy pill */}
              <View style={[styles.statusPill, hasVacancy ? styles.statusGreen : styles.statusRed]}>
                <View style={[styles.statusDot, { backgroundColor: hasVacancy ? '#5BA63C' : '#D14343' }]} />
                <Text style={[styles.statusText, { color: hasVacancy ? '#3C7A2A' : '#A13030' }]}>
                  {hasVacancy ? t('technicalFloor.hotel.hasVacancy') : t('technicalFloor.hotel.full')}
                </Text>
              </View>
              {/* Right: occupancy count */}
              <View style={styles.occupancyRight}>
                <Text style={styles.occupancyLabel}>{t('technicalFloor.hotel.occupied')}</Text>
```

- [ ] **Step 3: Translate `LobbyFloor`**

Change:

```ts
export function LobbyFloor({ visitorCount, lobbyCapacity, nextVisitorAt, now, onPress }: LobbyFloorProps) {
  const isFull = visitorCount >= lobbyCapacity;
  const secondsLeft = Math.max(0, Math.ceil((nextVisitorAt - now) / 1000));
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timerText = isFull ? 'Повний' : `${minutes}:${String(seconds).padStart(2, '0')}`;

  return (
    <Pressable onPress={onPress} style={styles.container}>
      <LinearGradient colors={HEADER_COLORS} style={styles.header}>
        <View style={styles.numberBadge}>
          <Text style={styles.numberText}>0</Text>
        </View>
        <Text style={styles.floorName} numberOfLines={1}>Вестибюль</Text>
        <View style={styles.techTag}>
          <StarIcon />
          <Text style={styles.techTagText}>СЕРВІС</Text>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        <View style={styles.techContent}>
          <Image
            source={require('../../assets/img/lobby.png')}
            style={styles.techImage}
            contentFit="contain"
          />
          <View style={styles.techInfo}>
            <View style={styles.infoRow}>
              <Text style={styles.visitorLabel}>Очікують</Text>
              {/* Visitor count pill */}
              <View style={styles.visitorPill}>
                <View style={styles.visitorAvatarCircle}>
                  <PersonMiniIcon />
                </View>
                <Text style={styles.visitorPillText}>{visitorCount} / {lobbyCapacity}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.visitorLabel}>Новий гість</Text>
              <Text style={styles.timerText}>{timerText}</Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
```

to:

```ts
export function LobbyFloor({ visitorCount, lobbyCapacity, nextVisitorAt, now, onPress }: LobbyFloorProps) {
  const { t } = useTranslation('hotel');
  const isFull = visitorCount >= lobbyCapacity;
  const secondsLeft = Math.max(0, Math.ceil((nextVisitorAt - now) / 1000));
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timerText = isFull ? t('technicalFloor.lobby.full') : `${minutes}:${String(seconds).padStart(2, '0')}`;

  return (
    <Pressable onPress={onPress} style={styles.container}>
      <LinearGradient colors={HEADER_COLORS} style={styles.header}>
        <View style={styles.numberBadge}>
          <Text style={styles.numberText}>0</Text>
        </View>
        <Text style={styles.floorName} numberOfLines={1}>{t('technicalFloor.lobby.name')}</Text>
        <View style={styles.techTag}>
          <StarIcon />
          <Text style={styles.techTagText}>{t('technicalFloor.lobby.tag')}</Text>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        <View style={styles.techContent}>
          <Image
            source={require('../../assets/img/lobby.png')}
            style={styles.techImage}
            contentFit="contain"
          />
          <View style={styles.techInfo}>
            <View style={styles.infoRow}>
              <Text style={styles.visitorLabel}>{t('technicalFloor.lobby.waiting')}</Text>
              {/* Visitor count pill */}
              <View style={styles.visitorPill}>
                <View style={styles.visitorAvatarCircle}>
                  <PersonMiniIcon />
                </View>
                <Text style={styles.visitorPillText}>{visitorCount} / {lobbyCapacity}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.visitorLabel}>{t('technicalFloor.lobby.newGuest')}</Text>
              <Text style={styles.timerText}>{timerText}</Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/TechnicalFloor.tsx src/i18n/locales/en/hotel.json
git commit -m "feat(i18n): translate TechnicalFloor"
```

---

## Task 11: Translate LevelUpModal.tsx and DeliverAllModal.tsx

**Files:**
- Modify: `src/components/LevelUpModal.tsx`
- Modify: `src/components/DeliverAllModal.tsx`
- Modify: `src/i18n/locales/en/hotel.json`

- [ ] **Step 1: Add hotel.json entries**

Edit `src/i18n/locales/en/hotel.json`, add `levelUp` and `deliverAll` keys:

```json
  "levelUp": {
    "title": "New Level!",
    "subtitle": "Level {{level}}",
    "claim": "Claim"
  },
  "deliverAll": {
    "title": "Everyone Delivered!",
    "rows": {
      "guests": "👤 Guests: {{count}}",
      "businessmen": "💼 Businessmen: {{count}}",
      "deliverers": "📦 Deliverers: {{count}}",
      "sellers": "🛒 Sellers: {{count}}",
      "newWorkers": "🏨 New Workers: {{count}}"
    },
    "done": "Done"
  }
```

- [ ] **Step 2: Translate LevelUpModal**

Change:

```ts
import { useGameStore } from '../stores/gameStore';
import { type LevelUpEvent } from '../../shared/engine/xp';
```

to:

```ts
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../stores/gameStore';
import { type LevelUpEvent } from '../../shared/engine/xp';
```

Change:

```ts
export default function LevelUpModal({ suppressWhileOpen = false }: { suppressWhileOpen?: boolean }) {
  const event = useGameStore((s) => s.levelUpQueue[0] ?? null);
```

to:

```ts
export default function LevelUpModal({ suppressWhileOpen = false }: { suppressWhileOpen?: boolean }) {
  const { t } = useTranslation('hotel');
  const event = useGameStore((s) => s.levelUpQueue[0] ?? null);
```

Change:

```tsx
                <Text style={styles.title}>Новий рівень!</Text>
                <Text style={styles.subtitle}>Рівень {event.newLevel}</Text>
```

to:

```tsx
                <Text style={styles.title}>{t('levelUp.title')}</Text>
                <Text style={styles.subtitle}>{t('levelUp.subtitle', { level: event.newLevel })}</Text>
```

Change:

```tsx
                    <Text style={styles.buttonText}>Отримати</Text>
```

to:

```tsx
                    <Text style={styles.buttonText}>{t('levelUp.claim')}</Text>
```

- [ ] **Step 3: Translate DeliverAllModal**

Change:

```ts
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const { width: SCREEN_W } = Dimensions.get('window');
```

to:

```ts
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

const { width: SCREEN_W } = Dimensions.get('window');
```

Change:

```ts
function DeliverAllContent({ summary, onDismiss }: { summary: DeliverAllSummary; onDismiss: () => void }) {
  const scale = useSharedValue(0.5);
```

to:

```ts
function DeliverAllContent({ summary, onDismiss }: { summary: DeliverAllSummary; onDismiss: () => void }) {
  const { t } = useTranslation('hotel');
  const scale = useSharedValue(0.5);
```

Change:

```tsx
            <Text style={styles.title}>Усіх розвезено!</Text>

            {summary.guestCount > 0 && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>👤 Гостей: {summary.guestCount}</Text>
              </View>
            )}
            {summary.businessmanCount > 0 && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>💼 Бізнесменів: {summary.businessmanCount}</Text>
              </View>
            )}
            {summary.delivererCount > 0 && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>📦 Доставщиків: {summary.delivererCount}</Text>
              </View>
            )}
            {summary.sellerCount > 0 && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>🛒 Продавців: {summary.sellerCount}</Text>
              </View>
            )}
            {summary.newWorkers > 0 && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>🏨 Нових працівників: {summary.newWorkers}</Text>
              </View>
            )}
```

to:

```tsx
            <Text style={styles.title}>{t('deliverAll.title')}</Text>

            {summary.guestCount > 0 && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{t('deliverAll.rows.guests', { count: summary.guestCount })}</Text>
              </View>
            )}
            {summary.businessmanCount > 0 && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{t('deliverAll.rows.businessmen', { count: summary.businessmanCount })}</Text>
              </View>
            )}
            {summary.delivererCount > 0 && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{t('deliverAll.rows.deliverers', { count: summary.delivererCount })}</Text>
              </View>
            )}
            {summary.sellerCount > 0 && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{t('deliverAll.rows.sellers', { count: summary.sellerCount })}</Text>
              </View>
            )}
            {summary.newWorkers > 0 && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{t('deliverAll.rows.newWorkers', { count: summary.newWorkers })}</Text>
              </View>
            )}
```

Change:

```tsx
                <Text style={styles.buttonText}>Готово</Text>
```

to:

```tsx
                <Text style={styles.buttonText}>{t('deliverAll.done')}</Text>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/LevelUpModal.tsx src/components/DeliverAllModal.tsx src/i18n/locales/en/hotel.json
git commit -m "feat(i18n): translate LevelUpModal and DeliverAllModal"
```

---

## Task 12: Translate LobbyPanel.tsx

**Files:**
- Modify: `src/components/LobbyPanel.tsx`
- Modify: `src/i18n/locales/en/lobby.json`

**Interfaces:**
- Consumes: `gameContent:productionTypes.<key>.displayName` (Task 4)

- [ ] **Step 1: Fill in lobby.json**

Replace the contents of `src/i18n/locales/en/lobby.json`:

```json
{
  "header": {
    "title": "Lobby",
    "subtitle": "Elevator · guest delivery"
  },
  "stats": {
    "waiting": "Waiting",
    "newGuest": "New guest"
  },
  "roles": {
    "guest": "Guest",
    "businessman": "Businessman",
    "deliverer": "Deliverer",
    "seller": "Seller"
  },
  "visitor": {
    "thankYou": "Thank you! 🎉",
    "floorSuffix": " · floor {{floor}}",
    "arrivedStatus": "Floor {{floor}} · arrived",
    "elevatorStatus": "Elevator on floor {{floor}}"
  },
  "empty": {
    "title": "Lobby is empty",
    "subtitle": "New visitors will arrive soon"
  },
  "actions": {
    "raiseToFloor": "Raise to floor {{floor}}",
    "checkIntoHotel": "Check into hotel",
    "collect": "Collect",
    "collectTip": "Collect Tip",
    "deliverAll": "Deliver All For"
  },
  "dailyTips": {
    "label": "Tips collected today",
    "claimReward": "Claim Plan Reward",
    "claimed": "Plan completed · reward claimed"
  },
  "dailyGems": {
    "label": "Gems today"
  },
  "elevator": {
    "upgradeEntry": "Upgrade Elevator",
    "upgradeCaption": "Upgrading the elevator speeds up trips and increases tips",
    "backToElevator": "Back to Elevator",
    "cardTitle": "Elevator: ",
    "capacityPerTrip": "{{level}} fl. / trip",
    "description": "Each elevator upgrade speeds up trips and increases guest tips",
    "upgradeFor": "Upgrade For",
    "maxLevel": "Max Level!"
  },
  "lobbyUpgrade": {
    "cardTitle": "Lobby",
    "seats": "{{count}} seats",
    "description": "A bigger lobby holds more visitors waiting for the elevator",
    "upgradeForSeats": "+{{count}} seats for",
    "maxLevel": "Max Level!"
  },
  "hotelFullPopup": {
    "title": "Hotel is full",
    "subtitle": "No room for the new guest — they left",
    "goToHotel": "Go to Hotel",
    "dismiss": "Dismiss"
  },
  "newWorkerPopup": {
    "title": "New Worker!",
    "meta": "Level {{level}} · {{job}}",
    "waitingInHotel": "Waiting in the hotel",
    "findJobNow": "Find a Job Now",
    "later": "Later"
  }
}
```

- [ ] **Step 2: Import the hook and replace `ROLE_LABELS`**

Change:

```ts
import React, { useState, useEffect, useCallback, useRef } from 'react';
```

to:

```ts
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
```

`ROLE_LABELS` is a module-level constant used inside the render tree (`ROLE_LABELS[activeVisitor.role ?? 'guest']`); change it to a function that takes `t` so it stays outside the component but uses translated text:

Change:

```ts
const ROLE_LABELS: Record<string, string> = {
  guest: 'Гість',
  businessman: 'Бізнесмен',
  deliverer: 'Доставщик',
  seller: 'Продавець',
};
```

to (delete this constant; role labels are now looked up directly via `t('roles.' + role)` at the two call sites, translated in Step 4).

- [ ] **Step 3: Add the hook to the main component**

Change:

```ts
export default function LobbyPanel({ visible, onClose, onOpenHotel }: LobbyPanelProps) {
  const [view, setView] = useState<'operate' | 'upgrade'>('operate');
```

to:

```ts
export default function LobbyPanel({ visible, onClose, onOpenHotel }: LobbyPanelProps) {
  const { t } = useTranslation('lobby');
  const { t: tContent } = useTranslation('gameContent');
  const [view, setView] = useState<'operate' | 'upgrade'>('operate');
```

- [ ] **Step 4: Translate the header and stats**

Change:

```tsx
                      <Text style={styles.titleText}>Вестибюль</Text>
                      <Text style={styles.subtitleText}>Ліфт · доставка гостей</Text>
```

to:

```tsx
                      <Text style={styles.titleText}>{t('header.title')}</Text>
                      <Text style={styles.subtitleText}>{t('header.subtitle')}</Text>
```

Change:

```tsx
                    <Text style={styles.statLabel}>Очікують</Text>
```

to:

```tsx
                    <Text style={styles.statLabel}>{t('stats.waiting')}</Text>
```

Change:

```tsx
                    <Text style={styles.statLabel}>Новий гість</Text>
```

to:

```tsx
                    <Text style={styles.statLabel}>{t('stats.newGuest')}</Text>
```

- [ ] **Step 5: Translate the active-visitor speech/status block**

Change:

```tsx
                                <Text style={styles.speechArrivedText}>Дякую! 🎉</Text>
                              ) : (
                                <Text style={styles.speechText}>
                                  <Text style={[styles.speechRoleLabel, { color: ROLE_COLORS[activeVisitor.role ?? 'guest'] }]}>
                                    {ROLE_LABELS[activeVisitor.role ?? 'guest']}
                                  </Text>
                                  {` · ${activeVisitor.targetFloor ?? '?'} поверх`}
                                </Text>
                              )}
                            </View>
                            <View style={styles.statusChip}>
                              <View style={[
                                styles.statusDot,
                                { backgroundColor: arrived ? '#52B847' : '#F0B92A' },
                              ]} />
                              <Text style={styles.statusChipText}>
                                {arrived
                                  ? `Поверх ${activeVisitor.targetFloor} · прибули`
                                  : `Ліфт на поверсі ${elevatorFloor}`}
                              </Text>
```

to:

```tsx
                                <Text style={styles.speechArrivedText}>{t('visitor.thankYou')}</Text>
                              ) : (
                                <Text style={styles.speechText}>
                                  <Text style={[styles.speechRoleLabel, { color: ROLE_COLORS[activeVisitor.role ?? 'guest'] }]}>
                                    {t(`roles.${activeVisitor.role ?? 'guest'}`)}
                                  </Text>
                                  {t('visitor.floorSuffix', { floor: activeVisitor.targetFloor ?? '?' })}
                                </Text>
                              )}
                            </View>
                            <View style={styles.statusChip}>
                              <View style={[
                                styles.statusDot,
                                { backgroundColor: arrived ? '#52B847' : '#F0B92A' },
                              ]} />
                              <Text style={styles.statusChipText}>
                                {arrived
                                  ? t('visitor.arrivedStatus', { floor: activeVisitor.targetFloor })
                                  : t('visitor.elevatorStatus', { floor: elevatorFloor })}
                              </Text>
```

- [ ] **Step 6: Translate the empty-lobby state and daily cards**

Change:

```tsx
                      <Text style={styles.emptyTitle}>Вестибюль порожній</Text>
                      <Text style={styles.emptySubtitle}>Нові відвідувачі скоро прийдуть</Text>
```

to:

```tsx
                      <Text style={styles.emptyTitle}>{t('empty.title')}</Text>
                      <Text style={styles.emptySubtitle}>{t('empty.subtitle')}</Text>
```

Change:

```tsx
                    <Text style={styles.deliverAllText}>Розвезти всіх за</Text>
```

to:

```tsx
                    <Text style={styles.deliverAllText}>{t('actions.deliverAll')}</Text>
```

Change:

```tsx
                    <Text style={styles.dailyTipsLabel}>Сьогодні отримано чайових</Text>
```

to:

```tsx
                    <Text style={styles.dailyTipsLabel}>{t('dailyTips.label')}</Text>
```

Change:

```tsx
                        <Text style={styles.rewardButtonText}>Отримати винагороду за план</Text>
```

to:

```tsx
                        <Text style={styles.rewardButtonText}>{t('dailyTips.claimReward')}</Text>
```

Change:

```tsx
                      <Text style={styles.claimedText}>План виконано · винагороду отримано</Text>
```

to:

```tsx
                      <Text style={styles.claimedText}>{t('dailyTips.claimed')}</Text>
```

Change:

```tsx
                  <Text style={styles.dailyGemsLabel}>Діаманти сьогодні</Text>
```

to:

```tsx
                  <Text style={styles.dailyGemsLabel}>{t('dailyGems.label')}</Text>
```

- [ ] **Step 7: Translate the elevator/lobby upgrade views**

Change:

```tsx
                    <Text style={styles.upgradeEntryText}>Покращити ліфт</Text>
                  </LinearGradient>
                  <View style={styles.upgradeEntryShadow} />
                </Pressable>
                <Text style={styles.upgradeCaption}>
                  Покращення ліфта прискорює підйом і збільшує чайові
                </Text>
```

to:

```tsx
                    <Text style={styles.upgradeEntryText}>{t('elevator.upgradeEntry')}</Text>
                  </LinearGradient>
                  <View style={styles.upgradeEntryShadow} />
                </Pressable>
                <Text style={styles.upgradeCaption}>
                  {t('elevator.upgradeCaption')}
                </Text>
```

Change:

```tsx
                  <Text style={styles.backButtonText}>Назад до ліфта</Text>
```

to:

```tsx
                  <Text style={styles.backButtonText}>{t('elevator.backToElevator')}</Text>
```

Change:

```tsx
                      <Text style={styles.upgradeCardTitle}>Ліфт: </Text>
                    ...
                    <Text style={styles.upgradeCardCapacity}>{elevatorLevel} пов. / підйом</Text>
```

to:

```tsx
                      <Text style={styles.upgradeCardTitle}>{t('elevator.cardTitle')}</Text>
                    ...
                    <Text style={styles.upgradeCardCapacity}>{t('elevator.capacityPerTrip', { level: elevatorLevel })}</Text>
```

Change:

```tsx
                    <Text style={styles.upgradeDesc}>
                      Кожне покращення ліфта прискорює підйом і збільшує чайові гостей
                    </Text>
```

to:

```tsx
                    <Text style={styles.upgradeDesc}>
                      {t('elevator.description')}
                    </Text>
```

Change:

```tsx
                        <Text style={styles.upgradeButtonText}>Покращити за</Text>
```

to:

```tsx
                        <Text style={styles.upgradeButtonText}>{t('elevator.upgradeFor')}</Text>
```

Change:

```tsx
                      <Text style={[styles.claimedText, { color: '#5BA63C' }]}>Максимальний рівень!</Text>
```

to:

```tsx
                      <Text style={[styles.claimedText, { color: '#5BA63C' }]}>{t('elevator.maxLevel')}</Text>
```

Change:

```tsx
                    <Text style={styles.upgradeCardTitle}>Вестибюль</Text>
                    <Text style={[styles.upgradeCardCapacity, { color: '#2592AB' }]}>{lobbyCapacity} місць</Text>
```

to:

```tsx
                    <Text style={styles.upgradeCardTitle}>{t('lobbyUpgrade.cardTitle')}</Text>
                    <Text style={[styles.upgradeCardCapacity, { color: '#2592AB' }]}>{t('lobbyUpgrade.seats', { count: lobbyCapacity })}</Text>
```

Change:

```tsx
                      Більший вестибюль вміщує більше відвідувачів, що чекають на підйом
```

to:

```tsx
                      {t('lobbyUpgrade.description')}
```

Change:

```tsx
                        <Text style={styles.upgradeButtonText}>+{lobbyUpgradeSeats} місць за</Text>
```

to:

```tsx
                        <Text style={styles.upgradeButtonText}>{t('lobbyUpgrade.upgradeForSeats', { count: lobbyUpgradeSeats })}</Text>
```

Change:

```tsx
                      <Text style={[styles.claimedText, { color: '#2592AB' }]}>Максимальний рівень!</Text>
```

to:

```tsx
                      <Text style={[styles.claimedText, { color: '#2592AB' }]}>{t('lobbyUpgrade.maxLevel')}</Text>
```

- [ ] **Step 8: Translate the hotel-full and new-worker popups**

Change:

```tsx
                <Text style={popupStyles.title}>Готель заповнений</Text>
                <Text style={popupStyles.subtitle}>Немає місця для нового гостя — він пішов</Text>
```

to:

```tsx
                <Text style={popupStyles.title}>{t('hotelFullPopup.title')}</Text>
                <Text style={popupStyles.subtitle}>{t('hotelFullPopup.subtitle')}</Text>
```

Change:

```tsx
                  <Text style={popupStyles.findJobText}>Перейти до готелю</Text>
```

to:

```tsx
                  <Text style={popupStyles.findJobText}>{t('hotelFullPopup.goToHotel')}</Text>
```

Change:

```tsx
                <Text style={popupStyles.dismissText}>Закрити</Text>
```

to:

```tsx
                <Text style={popupStyles.dismissText}>{t('hotelFullPopup.dismiss')}</Text>
```

Change:

```tsx
                <Text style={popupStyles.title}>Новий працівник!</Text>
                <Text style={[popupStyles.name, { color: gameConfig.floorTypes[newWorkerPopup.floorType]?.shirtColor ?? '#3B8BCB' }]}>{newWorkerPopup.name}</Text>
                <Text style={popupStyles.meta}>
                  {'Рівень ' + newWorkerPopup.level + ' · ' +
                    (gameConfig.productionTypes[newWorkerPopup.dreamJob]?.displayName ?? newWorkerPopup.dreamJob)}
                </Text>
                <Text style={popupStyles.subtitle}>Очікує у готелі</Text>
```

to:

```tsx
                <Text style={popupStyles.title}>{t('newWorkerPopup.title')}</Text>
                <Text style={[popupStyles.name, { color: gameConfig.floorTypes[newWorkerPopup.floorType]?.shirtColor ?? '#3B8BCB' }]}>{newWorkerPopup.name}</Text>
                <Text style={popupStyles.meta}>
                  {t('newWorkerPopup.meta', {
                    level: newWorkerPopup.level,
                    job: tContent(`productionTypes.${newWorkerPopup.dreamJob}.displayName`, { defaultValue: newWorkerPopup.dreamJob }),
                  })}
                </Text>
                <Text style={popupStyles.subtitle}>{t('newWorkerPopup.waitingInHotel')}</Text>
```

Change:

```tsx
                  <Text style={popupStyles.findJobText}>Знайти роботу зараз</Text>
```

to:

```tsx
                  <Text style={popupStyles.findJobText}>{t('newWorkerPopup.findJobNow')}</Text>
```

Change:

```tsx
                <Text style={popupStyles.dismissText}>Пізніше</Text>
```

to:

```tsx
                <Text style={popupStyles.dismissText}>{t('newWorkerPopup.later')}</Text>
```

- [ ] **Step 9: Translate the action-button label builder**

Change:

```tsx
      return {
        label: `Підняти на ${nextFloor} поверх`,
```

to:

```tsx
      return {
        label: t('actions.raiseToFloor', { floor: nextFloor }),
```

Change:

```tsx
      return {
        label: 'Прийняти до готелю',
```

to:

```tsx
      return {
        label: t('actions.checkIntoHotel'),
```

Change:

```tsx
      return {
        label: 'Отримати',
        amount: '+1' as string | null,
```

to:

```tsx
      return {
        label: t('actions.collect'),
        amount: '+1' as string | null,
```

Change:

```tsx
    return {
      label: 'Отримати чайові',
```

to:

```tsx
    return {
      label: t('actions.collectTip'),
```

- [ ] **Step 10: Verify no Ukrainian text remains**

Run: `grep -nP '[\x{0400}-\x{04FF}]' src/components/LobbyPanel.tsx`
Expected: no output.

- [ ] **Step 11: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 12: Commit**

```bash
git add src/components/LobbyPanel.tsx src/i18n/locales/en/lobby.json
git commit -m "feat(i18n): translate LobbyPanel"
```

---

## Task 13: Strip dead display text out of shared game config

**Files:**
- Modify: `shared/config/gameConfig.ts`
- Modify: `shared/schemas/gameConfig.ts`
- Modify: `shared/schemas/gameState.ts`
- Modify: `shared/types/index.ts`
- Modify: `shared/config/__tests__/gameConfig.test.ts`
- Modify: `src/stores/__tests__/gameStore.test.ts`
- Modify: `server/src/sync/sync.service.ts:222-235`

**Interfaces:**
- Consumes: nothing (this is the cleanup step; every consumer of `category`/`name`/`displayName` was migrated to `gameContent` in Tasks 5–12).

- [ ] **Step 1: Confirm no consumer still reads the fields being removed**

Run: `grep -rn "\.displayName\b\|\.category\b" src app shared server --include="*.ts" --include="*.tsx" | grep -v __tests__ | grep -v node_modules`
Expected: no output (all consumers migrated in Tasks 5–12).

- [ ] **Step 2: Remove the fields from the schemas**

Edit `shared/schemas/gameConfig.ts`, change:

```ts
export const ProductionTypeConfigSchema = z.object({
  buyCost: z.number().positive(),
  deliveryDuration: z.number().positive(),
  sellDuration: z.number().positive(),
  batchValue: z.number().positive(),
  displayName: z.string(),
});

export const FloorTypeConfigSchema = z.object({
  category: z.string(),
  shirtColor: z.string(),
  accent: z.string(),
  dreamJobs: z.array(z.string()).min(1),
});

export const FloorConfigSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  slots: z.number().int().min(1).max(3),
  floorType: z.string(),
  availableTypes: z.array(z.string()).min(1),
});
```

to:

```ts
export const ProductionTypeConfigSchema = z.object({
  buyCost: z.number().positive(),
  deliveryDuration: z.number().positive(),
  sellDuration: z.number().positive(),
  batchValue: z.number().positive(),
});

export const FloorTypeConfigSchema = z.object({
  shirtColor: z.string(),
  accent: z.string(),
  dreamJobs: z.array(z.string()).min(1),
});

export const FloorConfigSchema = z.object({
  id: z.number().int(),
  slots: z.number().int().min(1).max(3),
  floorType: z.string(),
  availableTypes: z.array(z.string()).min(1),
});
```

Edit `shared/schemas/gameState.ts`, change:

```ts
export const FloorStateSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  productions: z.array(ProductionSchema).min(1).max(3),
});
```

to:

```ts
export const FloorStateSchema = z.object({
  id: z.number().int(),
  productions: z.array(ProductionSchema).min(1).max(3),
});
```

- [ ] **Step 3: Remove `name` from the `Floor` type**

Edit `shared/types/index.ts`, change:

```ts
export interface Floor {
  id: number;
  name: string;
  productions: Production[];
}
```

to:

```ts
export interface Floor {
  id: number;
  productions: Production[];
}
```

- [ ] **Step 4: Remove the literal display text and dead `name` assignment from `gameConfig.ts`**

Edit `shared/config/gameConfig.ts`, change:

```ts
const rawConfig = {
  floorTypes: {
    green:  { category: 'Кондитерська', shirtColor: '#62B23F', accent: '#4E9A2E', dreamJobs: ['bulky', 'cupcake', 'cake'] },
    teal:   { category: 'Пральня',     shirtColor: '#36AE9C', accent: '#1F8979', dreamJobs: ['wash', 'dry', 'bleach'] },
    amber:  { category: "Кав'ярня",    shirtColor: '#E7A21E', accent: '#B07F12', dreamJobs: ['coffee', 'pancake', 'dessert'] },
    purple: { category: 'Парфумерія',  shirtColor: '#9A6FD0', accent: '#7B52BC', dreamJobs: ['aroma', 'soap', 'candle'] },
    blue:   { category: 'Морозиво',    shirtColor: '#4C9BDD', accent: '#2E78B5', dreamJobs: ['icecream', 'shake', 'sorbet'] },
  },
  floors: [
    { id: 2, name: 'Кондитерська', slots: 3, floorType: 'green', availableTypes: ['bulky', 'cupcake', 'cake'] },
    { id: 3, name: 'Пральня',     slots: 3, floorType: 'teal',  availableTypes: ['wash', 'dry', 'bleach'] },
    { id: 4, name: "Кав'ярня",    slots: 3, floorType: 'amber', availableTypes: ['coffee', 'pancake', 'dessert'] },
  ],
  productionTypes: {
    bulky:    { buyCost: 10,  deliveryDuration: 5000,  sellDuration: 10000, batchValue: 20,  displayName: 'Булки' },
    cupcake:  { buyCost: 15,  deliveryDuration: 8000,  sellDuration: 12000, batchValue: 28,  displayName: 'Пирожені' },
    cake:     { buyCost: 25,  deliveryDuration: 12000, sellDuration: 15000, batchValue: 48,  displayName: 'Торти' },
    wash:     { buyCost: 30,  deliveryDuration: 10000, sellDuration: 15000, batchValue: 55,  displayName: 'Прання' },
    dry:      { buyCost: 40,  deliveryDuration: 15000, sellDuration: 20000, batchValue: 72,  displayName: 'Сушка' },
    bleach:   { buyCost: 50,  deliveryDuration: 20000, sellDuration: 25000, batchValue: 95,  displayName: 'Відбілювання' },
    coffee:   { buyCost: 20,  deliveryDuration: 8000,  sellDuration: 12000, batchValue: 40,  displayName: 'Кава' },
    pancake:  { buyCost: 35,  deliveryDuration: 12000, sellDuration: 18000, batchValue: 64,  displayName: 'Млинці' },
    dessert:  { buyCost: 45,  deliveryDuration: 18000, sellDuration: 22000, batchValue: 88,  displayName: 'Десерти' },
  },
```

to:

```ts
const rawConfig = {
  floorTypes: {
    green:  { shirtColor: '#62B23F', accent: '#4E9A2E', dreamJobs: ['bulky', 'cupcake', 'cake'] },
    teal:   { shirtColor: '#36AE9C', accent: '#1F8979', dreamJobs: ['wash', 'dry', 'bleach'] },
    amber:  { shirtColor: '#E7A21E', accent: '#B07F12', dreamJobs: ['coffee', 'pancake', 'dessert'] },
    purple: { shirtColor: '#9A6FD0', accent: '#7B52BC', dreamJobs: ['aroma', 'soap', 'candle'] },
    blue:   { shirtColor: '#4C9BDD', accent: '#2E78B5', dreamJobs: ['icecream', 'shake', 'sorbet'] },
  },
  floors: [
    { id: 2, slots: 3, floorType: 'green', availableTypes: ['bulky', 'cupcake', 'cake'] },
    { id: 3, slots: 3, floorType: 'teal',  availableTypes: ['wash', 'dry', 'bleach'] },
    { id: 4, slots: 3, floorType: 'amber', availableTypes: ['coffee', 'pancake', 'dessert'] },
  ],
  productionTypes: {
    bulky:    { buyCost: 10,  deliveryDuration: 5000,  sellDuration: 10000, batchValue: 20 },
    cupcake:  { buyCost: 15,  deliveryDuration: 8000,  sellDuration: 12000, batchValue: 28 },
    cake:     { buyCost: 25,  deliveryDuration: 12000, sellDuration: 15000, batchValue: 48 },
    wash:     { buyCost: 30,  deliveryDuration: 10000, sellDuration: 15000, batchValue: 55 },
    dry:      { buyCost: 40,  deliveryDuration: 15000, sellDuration: 20000, batchValue: 72 },
    bleach:   { buyCost: 50,  deliveryDuration: 20000, sellDuration: 25000, batchValue: 95 },
    coffee:   { buyCost: 20,  deliveryDuration: 8000,  sellDuration: 12000, batchValue: 40 },
    pancake:  { buyCost: 35,  deliveryDuration: 12000, sellDuration: 18000, batchValue: 64 },
    dessert:  { buyCost: 45,  deliveryDuration: 18000, sellDuration: 22000, batchValue: 88 },
  },
```

Change:

```ts
export function createInitialState(config: GameConfig): GameState {
  return {
    balance: config.startingBalance,
    gems: 20,
    floors: config.floors.map((floorConfig): Floor => ({
      id: floorConfig.id,
      name: floorConfig.name,
      productions: floorConfig.availableTypes.map((typeId) => ({
```

to:

```ts
export function createInitialState(config: GameConfig): GameState {
  return {
    balance: config.startingBalance,
    gems: 20,
    floors: config.floors.map((floorConfig): Floor => ({
      id: floorConfig.id,
      productions: floorConfig.availableTypes.map((typeId) => ({
```

- [ ] **Step 5: Remove the dead floor-name reconstruction on the server**

Edit `server/src/sync/sync.service.ts`, change:

```ts
  private dbToGameState(player: any): GameState {
    const floors: Floor[] = player.floors.map((f: any) => ({
      id: f.floorId,
      name:
        gameConfig.floors.find((gc) => gc.id === f.floorId)?.name ??
        `Floor ${f.floorId}`,
      productions: f.productions.map(
```

to:

```ts
  private dbToGameState(player: any): GameState {
    const floors: Floor[] = player.floors.map((f: any) => ({
      id: f.floorId,
      productions: f.productions.map(
```

- [ ] **Step 6: Update `gameConfig.test.ts` for the ID-only shape**

Edit `shared/config/__tests__/gameConfig.test.ts`, remove the now-invalid assertion:

```ts
  it('every production type has a displayName', () => {
    for (const [, typeConfig] of Object.entries(gameConfig.productionTypes)) {
      expect(typeof typeConfig.displayName).toBe('string');
      expect(typeConfig.displayName.length).toBeGreaterThan(0);
    }
  });

```

(delete this whole `it` block; the remaining tests in the file — floor count, production-type count, floor-type count, available-type references — are unaffected since they only assert on keys/ids, not display text).

- [ ] **Step 7: Fix the local `testConfig` fixture in `gameStore.test.ts`**

Edit `src/stores/__tests__/gameStore.test.ts`, change:

```ts
const testConfig: GameConfig = {
  floors: [
    { id: 1, name: 'Floor 1', slots: 1, floorType: 'green', availableTypes: ['coffee_shop'] },
  ],
  productionTypes: {
    coffee_shop: { buyCost: 10, deliveryDuration: 5000, sellDuration: 10000, batchValue: 25, displayName: 'Coffee Shop' },
  },
  floorTypes: {
    green: { category: 'Test', shirtColor: '#62B23F', accent: '#4E9A2E', dreamJobs: ['coffee_shop'] },
  },
```

to:

```ts
const testConfig: GameConfig = {
  floors: [
    { id: 1, slots: 1, floorType: 'green', availableTypes: ['coffee_shop'] },
  ],
  productionTypes: {
    coffee_shop: { buyCost: 10, deliveryDuration: 5000, sellDuration: 10000, batchValue: 25 },
  },
  floorTypes: {
    green: { shirtColor: '#62B23F', accent: '#4E9A2E', dreamJobs: ['coffee_shop'] },
  },
```

- [ ] **Step 8: Run the full test suite**

Run: `npx jest`
Expected: PASS, no failures.

Run: `cd server && npx jest && cd ..`
Expected: PASS, no failures.

- [ ] **Step 9: Typecheck both projects**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `cd server && npx tsc --noEmit && cd ..`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add shared/config/gameConfig.ts shared/schemas/gameConfig.ts shared/schemas/gameState.ts shared/types/index.ts shared/config/__tests__/gameConfig.test.ts src/stores/__tests__/gameStore.test.ts server/src/sync/sync.service.ts
git commit -m "refactor: strip dead display text and unused Floor.name from shared game config"
```

---

## Task 14: Locale-aware name pools

**Files:**
- Modify: `shared/config/workerNames.ts`
- Modify: `src/stores/authStore.ts`

**Interfaces:**
- Produces (from `workerNames.ts`): `generateRandomWorkers(count: number, config: GameConfig, locale?: SupportedWorkerLocale): Worker[]` — the `locale` parameter is optional and defaults to `'en'`, so `lobbyCommands.ts:128` and `player.service.ts:19` (which don't pass it) keep working unchanged.

- [ ] **Step 1: Restructure `workerNames.ts` into locale-keyed pools**

Edit `shared/config/workerNames.ts`, change:

```ts
export const WORKER_NAMES = {
  male: [
    'Коля Некрасов', 'Дима Громов', 'Миша Шевчук', 'Андрій Семенов',
    'Ваня Вайнер', 'Олег Кравченко', 'Тарас Мельник', 'Богдан Ткаченко',
    'Роман Бондаренко', 'Ігор Шевченко',
  ],
  female: [
    'Надя Бєлкіна', 'Саша Яшина', 'Маша Громова', 'Ірина Коваль',
    'Оля Петренко', 'Юля Сидоренко', 'Аня Лисенко', 'Катя Бойко',
    'Даша Коваленко', 'Віка Мороз',
  ],
};
```

to:

```ts
export type SupportedWorkerLocale = 'en';

interface WorkerNamePool {
  male: string[];
  female: string[];
}

export const WORKER_NAME_POOLS: Record<SupportedWorkerLocale, WorkerNamePool> = {
  en: {
    male: [
      'Cole Nichols', 'Dean Grover', 'Mike Shevchuk', 'Andrew Simmons',
      'Van Weiner', 'Oliver Craig', 'Terry Miller', 'Bo Tucker',
      'Roman Bond', 'Gregory Ivens',
    ],
    female: [
      'Nadia Belkin', 'Sasha Yashin', 'Mary Grover', 'Irene Cole',
      'Olive Peters', 'Julia Sidon', 'Anna Foxley', 'Kate Boyko',
      'Dasha Cole', 'Vicky Frost',
    ],
  },
};

const DEFAULT_WORKER_LOCALE: SupportedWorkerLocale = 'en';
```

- [ ] **Step 2: Use the pool by locale in `generateRandomWorkers`**

Change:

```ts
export function generateRandomWorkers(count: number, config: GameConfig): Worker[] {
  const floorTypeKeys = Object.keys(config.floorTypes);
  const workers: Worker[] = [];
  const usedNames = new Set<string>();

  for (let i = 0; i < count; i++) {
    const female = Math.random() < 0.5;
    const namePool = female ? WORKER_NAMES.female : WORKER_NAMES.male;
```

to:

```ts
export function generateRandomWorkers(
  count: number,
  config: GameConfig,
  locale: SupportedWorkerLocale = DEFAULT_WORKER_LOCALE,
): Worker[] {
  const floorTypeKeys = Object.keys(config.floorTypes);
  const workers: Worker[] = [];
  const usedNames = new Set<string>();
  const pool = WORKER_NAME_POOLS[locale];

  for (let i = 0; i < count; i++) {
    const female = Math.random() < 0.5;
    const namePool = female ? pool.female : pool.male;
```

- [ ] **Step 3: Locale-aware guest name pools in `authStore.ts`**

Edit `src/stores/authStore.ts`, change:

```ts
import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';
import { api } from '../services/api';
```

to:

```ts
import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';
import i18n from '../i18n';
import { api } from '../services/api';

type GuestNameLocale = 'en';

const GUEST_NAME_POOLS: Record<GuestNameLocale, { adjectives: string[]; nouns: string[] }> = {
  en: {
    adjectives: ['Bold', 'Cheerful', 'Swift', 'Wise', 'Lucky'],
    nouns: ['Builder', 'Architect', 'Owner', 'Foreman', 'Creator'],
  },
};

function currentGuestNameLocale(): GuestNameLocale {
  return 'en';
  // Widen this once a second language is supported: return the app's
  // current i18n language if it's a supported GuestNameLocale, else 'en'.
}

void i18n; // referenced above for the future per-language lookup
```

- [ ] **Step 4: Use the pool in `enterAsGuest`**

Change:

```ts
  enterAsGuest: () => {
    const adjectives = ['Сміливий', 'Веселий', 'Швидкий', 'Мудрий', 'Вдалий'];
    const nouns = ['Будівник', 'Архітектор', 'Власник', 'Майстер', 'Творець'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
```

to:

```ts
  enterAsGuest: () => {
    const pool = GUEST_NAME_POOLS[currentGuestNameLocale()];
    const adj = pool.adjectives[Math.floor(Math.random() * pool.adjectives.length)];
    const noun = pool.nouns[Math.floor(Math.random() * pool.nouns.length)];
```

- [ ] **Step 5: Run the existing tests that exercise worker generation**

Run: `npx jest shared/engine/__tests__/lobbyCommands.test.ts shared/engine/__tests__/workerUtils.test.ts`
Expected: PASS (these assert on shape/count, not literal names, per the codebase's existing convention — confirm no test asserts a literal Ukrainian name string; if one does, update it to assert shape only, e.g. `expect(typeof worker.name).toBe('string')`).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add shared/config/workerNames.ts src/stores/authStore.ts
git commit -m "feat(i18n): locale-aware worker and guest name pools (English populated)"
```

---

## Task 15: Translate the tab screens and bottom nav

**Files:**
- Modify: `app/(tabs)/_layout.tsx`
- Modify: `app/(tabs)/city.tsx`
- Modify: `app/(tabs)/shop.tsx`
- Modify: `app/(tabs)/profile.tsx`
- Modify: `src/components/BottomNav.tsx`

**Interfaces:**
- Consumes: `tabs:labels.tower/city/shop/profile`, `tabs:city.*`, `tabs:shop.*`, `tabs:profile.*`, `common:relativeTime.*` (Task 3)

Note: `app/(tabs)/_layout.tsx` uses `expo-router/unstable-native-tabs`, whose `<NativeTabs.Trigger.Label>` takes a string child directly (no hook context restriction beyond being inside a component) — `useTranslation` works the same way here as anywhere else.

- [ ] **Step 1: Translate the tab layout**

Edit `app/(tabs)/_layout.tsx`, change:

```tsx
import { NativeTabs } from 'expo-router/unstable-native-tabs';

export default function TabsLayout() {
  return (
    <NativeTabs tintColor="#3FA535">
      <NativeTabs.Trigger name="game">
        <NativeTabs.Trigger.Icon sf="building.columns.fill" />
        <NativeTabs.Trigger.Label>Вежа</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="city">
        <NativeTabs.Trigger.Icon sf="map.fill" />
        <NativeTabs.Trigger.Label>Місто</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="shop">
        <NativeTabs.Trigger.Icon sf="bag.fill" />
        <NativeTabs.Trigger.Label>Магазин</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon sf="person.fill" />
        <NativeTabs.Trigger.Label>Профіль</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
```

to:

```tsx
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTranslation } from 'react-i18next';

export default function TabsLayout() {
  const { t } = useTranslation('tabs');

  return (
    <NativeTabs tintColor="#3FA535">
      <NativeTabs.Trigger name="game">
        <NativeTabs.Trigger.Icon sf="building.columns.fill" />
        <NativeTabs.Trigger.Label>{t('labels.tower')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="city">
        <NativeTabs.Trigger.Icon sf="map.fill" />
        <NativeTabs.Trigger.Label>{t('labels.city')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="shop">
        <NativeTabs.Trigger.Icon sf="bag.fill" />
        <NativeTabs.Trigger.Label>{t('labels.shop')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon sf="person.fill" />
        <NativeTabs.Trigger.Label>{t('labels.profile')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
```

- [ ] **Step 2: Translate `city.tsx`**

Edit `app/(tabs)/city.tsx`, change:

```tsx
import { BlurView } from 'expo-blur';
import TopBar from '../../src/components/TopBar';
import { useGameStore, useBalance } from '../../src/stores/gameStore';
import { useAuthStore } from '../../src/stores/authStore';
```

to:

```tsx
import { BlurView } from 'expo-blur';
import { useTranslation } from 'react-i18next';
import TopBar from '../../src/components/TopBar';
import { useGameStore, useBalance } from '../../src/stores/gameStore';
import { useAuthStore } from '../../src/stores/authStore';
```

Change:

```tsx
export default function CityScreen() {
  const balance = useBalance();
  const playerLevel = useGameStore((s) => s.playerLevel);
  const playerXp = useGameStore((s) => s.playerXp);
  const gems = useGameStore((s) => s.gems);
  const player = useAuthStore((s) => s.player);
  const playerName = player?.playerName ?? 'Гравець';
```

to:

```tsx
export default function CityScreen() {
  const { t } = useTranslation('tabs');
  const balance = useBalance();
  const playerLevel = useGameStore((s) => s.playerLevel);
  const playerXp = useGameStore((s) => s.playerXp);
  const gems = useGameStore((s) => s.gems);
  const player = useAuthStore((s) => s.player);
  const playerName = player?.playerName ?? t('profile.guestFallbackName');
```

Change:

```tsx
          <Text style={styles.title}>Місто</Text>
          <Text style={styles.subtitle}>Тут поки немає функціоналу</Text>
```

to:

```tsx
          <Text style={styles.title}>{t('city.title')}</Text>
          <Text style={styles.subtitle}>{t('city.comingSoon')}</Text>
```

- [ ] **Step 3: Translate `shop.tsx`**

Edit `app/(tabs)/shop.tsx`, apply the same two changes as Step 2 (same file structure), using `t('shop.title')` / `t('shop.comingSoon')` and `t('profile.guestFallbackName')` for the fallback:

Change:

```tsx
import { BlurView } from 'expo-blur';
import TopBar from '../../src/components/TopBar';
import { useGameStore, useBalance } from '../../src/stores/gameStore';
import { useAuthStore } from '../../src/stores/authStore';
```

to:

```tsx
import { BlurView } from 'expo-blur';
import { useTranslation } from 'react-i18next';
import TopBar from '../../src/components/TopBar';
import { useGameStore, useBalance } from '../../src/stores/gameStore';
import { useAuthStore } from '../../src/stores/authStore';
```

Change:

```tsx
export default function ShopScreen() {
  const balance = useBalance();
  const playerLevel = useGameStore((s) => s.playerLevel);
  const playerXp = useGameStore((s) => s.playerXp);
  const gems = useGameStore((s) => s.gems);
  const player = useAuthStore((s) => s.player);
  const playerName = player?.playerName ?? 'Гравець';
```

to:

```tsx
export default function ShopScreen() {
  const { t } = useTranslation('tabs');
  const balance = useBalance();
  const playerLevel = useGameStore((s) => s.playerLevel);
  const playerXp = useGameStore((s) => s.playerXp);
  const gems = useGameStore((s) => s.gems);
  const player = useAuthStore((s) => s.player);
  const playerName = player?.playerName ?? t('profile.guestFallbackName');
```

Change:

```tsx
          <Text style={styles.title}>Магазин</Text>
          <Text style={styles.subtitle}>Тут поки немає функціоналу</Text>
```

to:

```tsx
          <Text style={styles.title}>{t('shop.title')}</Text>
          <Text style={styles.subtitle}>{t('shop.comingSoon')}</Text>
```

- [ ] **Step 4: Translate `profile.tsx` — relative time formatter**

Change:

```tsx
import { xpForLevel } from '../../shared/engine/xp';
import { useGameClock } from '../../src/hooks/useGameClock';

function formatSyncTime(ts: number, now: number): string {
  if (ts === 0) return 'ніколи';
  const diff = now - ts;
  if (diff < 60_000) return 'щойно';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}хв тому`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}год тому`;
  return `${Math.floor(diff / 86_400_000)}дн тому`;
}
```

to:

```tsx
import { useTranslation } from 'react-i18next';
import i18n from '../../src/i18n';
import { xpForLevel } from '../../shared/engine/xp';
import { useGameClock } from '../../src/hooks/useGameClock';

function formatSyncTime(ts: number, now: number): string {
  if (ts === 0) return i18n.t('common:relativeTime.never');
  const diff = now - ts;
  if (diff < 60_000) return i18n.t('common:relativeTime.justNow');
  if (diff < 3_600_000) return i18n.t('common:relativeTime.minutesAgo', { count: Math.floor(diff / 60_000) });
  if (diff < 86_400_000) return i18n.t('common:relativeTime.hoursAgo', { count: Math.floor(diff / 3_600_000) });
  return i18n.t('common:relativeTime.daysAgo', { count: Math.floor(diff / 86_400_000) });
}
```

(`formatSyncTime` is a plain module-level function, not a component, so it uses the shared `i18n.t()` directly — same pattern as `ProductionCard.tsx`'s `formatTime`/`formatDuration` in Task 8.)

- [ ] **Step 5: Translate the rest of `profile.tsx`**

Change:

```tsx
export default function ProfileScreen() {
  const player = useAuthStore((s) => s.player);
```

to:

```tsx
export default function ProfileScreen() {
  const { t } = useTranslation('tabs');
  const player = useAuthStore((s) => s.player);
```

Change:

```tsx
  const initial = (player?.playerName ?? 'G').charAt(0).toUpperCase();
```

to:

```tsx
  const initial = (player?.playerName ?? t('profile.guestFallbackName')).charAt(0).toUpperCase();
```

Change:

```tsx
        <View style={styles.header}>
          <Text style={styles.title}>Профіль</Text>
        </View>
```

to:

```tsx
        <View style={styles.header}>
          <Text style={styles.title}>{t('profile.title')}</Text>
        </View>
```

Change:

```tsx
          <Text style={styles.name}>{player?.playerName ?? 'Гравець'}</Text>
```

to:

```tsx
          <Text style={styles.name}>{player?.playerName ?? t('profile.guestFallbackName')}</Text>
```

Change:

```tsx
              <Text style={styles.statValue}>{playerLevel}</Text>
              <Text style={styles.statLabel}>Рівень</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItemXp}>
              <Text style={styles.statValue}>{playerXp}/{xpNeeded}</Text>
              <Text style={styles.statLabel}>Досвід</Text>
```

to:

```tsx
              <Text style={styles.statValue}>{playerLevel}</Text>
              <Text style={styles.statLabel}>{t('profile.stats.level')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItemXp}>
              <Text style={styles.statValue}>{playerXp}/{xpNeeded}</Text>
              <Text style={styles.statLabel}>{t('profile.stats.xp')}</Text>
```

Change:

```tsx
            {syncStatus === 'online' && 'Ви онлайн'}
            {syncStatus === 'pending' && `${commandQueueLength} команд не передано`}
            {syncStatus === 'critical' && `${commandQueueLength} команд не передано · можливі втрати даних`}
```

to:

```tsx
            {syncStatus === 'online' && t('profile.sync.online')}
            {syncStatus === 'pending' && t('profile.sync.pending', { count: commandQueueLength })}
            {syncStatus === 'critical' && t('profile.sync.critical', { count: commandQueueLength })}
```

Change:

```tsx
          <Text style={styles.logoutText}>Вийти з акаунту</Text>
```

to:

```tsx
          <Text style={styles.logoutText}>{t('profile.logout')}</Text>
```

- [ ] **Step 6: Translate `BottomNav.tsx`, reusing the same `tabs.labels.*` keys**

Change:

```tsx
import { GlassView } from 'expo-glass-effect';
import { router, usePathname } from 'expo-router';
```

to:

```tsx
import { GlassView } from 'expo-glass-effect';
import { router, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
```

Change:

```tsx
export default function BottomNav({ onTowerPress }: BottomNavProps = {}) {
  const pathname = usePathname();
```

to:

```tsx
export default function BottomNav({ onTowerPress }: BottomNavProps = {}) {
  const { t } = useTranslation('tabs');
  const pathname = usePathname();
```

Change:

```tsx
          <NavItem active={isGame} label="Вежа" onPress={() => { if (!isGame) router.replace('/game'); else onTowerPress?.(); }}>
            <TowerIcon active={isGame} />
          </NavItem>
          <NavItem active={isCity} label="Місто" onPress={() => { if (!isCity) router.replace('/city'); }}>
            <CityIcon active={isCity} />
          </NavItem>
          <NavItem active={isShop} label="Магазин" onPress={() => { if (!isShop) router.replace('/shop'); }}>
            <ShopIcon active={isShop} />
          </NavItem>
          <NavItem active={isProfile} label="Профіль" onPress={() => { if (!isProfile) router.replace('/profile'); }}>
            <ProfileIcon active={isProfile} />
          </NavItem>
```

to:

```tsx
          <NavItem active={isGame} label={t('labels.tower')} onPress={() => { if (!isGame) router.replace('/game'); else onTowerPress?.(); }}>
            <TowerIcon active={isGame} />
          </NavItem>
          <NavItem active={isCity} label={t('labels.city')} onPress={() => { if (!isCity) router.replace('/city'); }}>
            <CityIcon active={isCity} />
          </NavItem>
          <NavItem active={isShop} label={t('labels.shop')} onPress={() => { if (!isShop) router.replace('/shop'); }}>
            <ShopIcon active={isShop} />
          </NavItem>
          <NavItem active={isProfile} label={t('labels.profile')} onPress={() => { if (!isProfile) router.replace('/profile'); }}>
            <ProfileIcon active={isProfile} />
          </NavItem>
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 8: Commit**

```bash
git add "app/(tabs)/_layout.tsx" "app/(tabs)/city.tsx" "app/(tabs)/shop.tsx" "app/(tabs)/profile.tsx" src/components/BottomNav.tsx
git commit -m "feat(i18n): translate tab screens and bottom nav"
```

---

## Task 16: Translate the auth screens

**Files:**
- Modify: `src/screens/LoginScreen.tsx`
- Modify: `src/screens/WelcomeScreen.tsx`

**Interfaces:**
- Consumes: `auth:login.*`, `auth:welcome.*`, `common:actions.*` (Task 3)

- [ ] **Step 1: Import the hook in `LoginScreen.tsx`**

Change:

```tsx
import Svg, { Path } from 'react-native-svg';
import { useAuthStore } from '../stores/authStore';
```

to:

```tsx
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';
```

- [ ] **Step 2: Translate the validation errors**

Change:

```tsx
export default function LoginScreen({ onSuccess, onGoogle, onApple, onBack }: LoginScreenProps) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
```

to:

```tsx
export default function LoginScreen({ onSuccess, onGoogle, onApple, onBack }: LoginScreenProps) {
  const { t } = useTranslation('auth');
  const [tab, setTab] = useState<'login' | 'register'>('login');
```

Change:

```tsx
    if (!email.trim() || !password.trim()) {
      setError('Заповніть всі поля');
      return;
    }

    if (!isLogin && !playerName.trim()) {
      setError("Введіть ім'я гравця");
      return;
    }

    if (password.length < 6) {
      setError('Пароль має бути не менше 6 символів');
      return;
    }

    try {
      if (isLogin) {
        await useAuthStore.getState().login(email.trim(), password);
      } else {
        await useAuthStore.getState().register(email.trim(), password, playerName.trim());
      }
      onSuccess();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Щось пішло не так';
      setError(msg);
    }
```

to:

```tsx
    if (!email.trim() || !password.trim()) {
      setError(t('login.errors.fillAllFields'));
      return;
    }

    if (!isLogin && !playerName.trim()) {
      setError(t('login.errors.enterPlayerName'));
      return;
    }

    if (password.length < 6) {
      setError(t('login.errors.passwordTooShort'));
      return;
    }

    try {
      if (isLogin) {
        await useAuthStore.getState().login(email.trim(), password);
      } else {
        await useAuthStore.getState().register(email.trim(), password, playerName.trim());
      }
      onSuccess();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('login.errors.somethingWentWrong');
      setError(msg);
    }
```

- [ ] **Step 3: Translate the title/subtitle/tabs**

Change:

```tsx
            <Text style={styles.cardTitle}>
              {isLogin ? 'З поверненням!' : 'Створіть акаунт'}
            </Text>
            <Text style={styles.cardSubtitle}>
              {isLogin
                ? 'Увійдіть, щоб продовжити будувати свою вежу'
                : 'Збережіть прогрес і грайте на всіх пристроях'}
            </Text>
```

to:

```tsx
            <Text style={styles.cardTitle}>
              {isLogin ? t('login.welcomeBack.title') : t('login.createAccount.title')}
            </Text>
            <Text style={styles.cardSubtitle}>
              {isLogin
                ? t('login.welcomeBack.subtitle')
                : t('login.createAccount.subtitle')}
            </Text>
```

Change:

```tsx
                <Text style={[styles.tabText, isLogin && styles.tabTextActive]}>
                  Вхід
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleTabSwitch('register')}
                style={[styles.tab, !isLogin && styles.tabActive]}
              >
                <Text style={[styles.tabText, !isLogin && styles.tabTextActive]}>
                  Реєстрація
                </Text>
```

to:

```tsx
                <Text style={[styles.tabText, isLogin && styles.tabTextActive]}>
                  {t('login.tabs.login')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleTabSwitch('register')}
                style={[styles.tab, !isLogin && styles.tabActive]}
              >
                <Text style={[styles.tabText, !isLogin && styles.tabTextActive]}>
                  {t('login.tabs.register')}
                </Text>
```

- [ ] **Step 4: Translate the form fields**

Change:

```tsx
                <Text style={styles.label}>{"Ім'я гравця"}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Як до вас звертатися?"
```

to:

```tsx
                <Text style={styles.label}>{t('login.labels.playerName')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('login.placeholders.playerName')}
```

Change:

```tsx
              <Text style={styles.label}>Ел. пошта</Text>
```

to:

```tsx
              <Text style={styles.label}>{t('login.labels.email')}</Text>
```

Change:

```tsx
              <Text style={styles.label}>Пароль</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  style={[styles.input, { paddingRight: 48 }]}
                  placeholder="Мінімум 6 символів"
```

to:

```tsx
              <Text style={styles.label}>{t('login.labels.password')}</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  style={[styles.input, { paddingRight: 48 }]}
                  placeholder={t('login.placeholders.password')}
```

- [ ] **Step 5: Translate forgot-password / terms**

Change:

```tsx
                  <Text style={styles.forgotText}>Забули пароль?</Text>
```

to:

```tsx
                  <Text style={styles.forgotText}>{t('login.forgotPassword')}</Text>
```

Change:

```tsx
                <Text style={styles.checkboxText}>
                  {'Я приймаю '}
                  <Text style={styles.checkboxLink}>Умови використання</Text>
                  {' та '}
                  <Text style={styles.checkboxLink}>Політику конфіденційності</Text>
                </Text>
```

to:

```tsx
                <Text style={styles.checkboxText}>
                  {t('login.terms.accept')}
                  <Text style={styles.checkboxLink}>{t('login.terms.termsOfUse')}</Text>
                  {t('login.terms.and')}
                  <Text style={styles.checkboxLink}>{t('login.terms.privacyPolicy')}</Text>
                </Text>
```

- [ ] **Step 6: Translate the submit button and divider**

Change:

```tsx
                  <Text style={styles.submitText}>
                    {isLogin ? 'Увійти' : 'Створити акаунт'}
                  </Text>
```

to:

```tsx
                  <Text style={styles.submitText}>
                    {isLogin ? t('login.submit.login') : t('login.submit.createAccount')}
                  </Text>
```

Change:

```tsx
              <Text style={styles.dividerText}>або</Text>
```

to:

```tsx
              <Text style={styles.dividerText}>{t('common:actions.or')}</Text>
```

- [ ] **Step 7: Typecheck LoginScreen**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 8: Import the hook in `WelcomeScreen.tsx`**

Change:

```tsx
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
```

to:

```tsx
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
```

- [ ] **Step 9: Translate the password prompt errors and content**

Change:

```tsx
export default function WelcomeScreen({ onPlay, onGuest, onLogin, onRegister }: WelcomeScreenProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
```

to:

```tsx
export default function WelcomeScreen({ onPlay, onGuest, onLogin, onRegister }: WelcomeScreenProps) {
  const { t } = useTranslation('auth');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
```

Change:

```tsx
  const handlePasswordSubmit = async () => {
    if (!password.trim()) { setError('Введіть пароль'); return; }
    try {
      await quickLogin(password);
      setShowPasswordPrompt(false);
      onPlay();
    } catch {
      setError('Невірний пароль');
    }
  };
```

to:

```tsx
  const handlePasswordSubmit = async () => {
    if (!password.trim()) { setError(t('welcome.errors.enterPassword')); return; }
    try {
      await quickLogin(password);
      setShowPasswordPrompt(false);
      onPlay();
    } catch {
      setError(t('welcome.errors.wrongPassword'));
    }
  };
```

- [ ] **Step 10: Translate the logo bubble and stat chip label**

Change:

```tsx
          <Text style={styles.bubbleText}>
            {'Будуй вище,\nзаробляй більше  '}
            <View style={styles.bubbleCoinInline} />
          </Text>
```

to:

```tsx
          <Text style={styles.bubbleText}>
            {t('welcome.bubble')}
            <View style={styles.bubbleCoinInline} />
          </Text>
```

Change:

```tsx
              <Text style={styles.floorsLabel}>поверхи</Text>
```

to:

```tsx
              <Text style={styles.floorsLabel}>{t('welcome.chips.floorsLabel')}</Text>
```

- [ ] **Step 11: Translate the password prompt modal**

Change:

```tsx
              style={styles.promptInput}
              placeholder="Пароль"
```

to:

```tsx
              style={styles.promptInput}
              placeholder={t('welcome.passwordPrompt.placeholder')}
```

Change:

```tsx
                  : <Text style={styles.promptSubmitText}>Увійти</Text>
```

to:

```tsx
                  : <Text style={styles.promptSubmitText}>{t('common:actions.login')}</Text>
```

Change:

```tsx
              <Text style={styles.promptCancelText}>Скасувати</Text>
```

to:

```tsx
              <Text style={styles.promptCancelText}>{t('common:actions.cancel')}</Text>
```

- [ ] **Step 12: Translate the continue/play/secondary buttons**

Change:

```tsx
                <Text style={styles.continueLabel}>
                  {isAuthenticated ? 'Продовжити' : 'Продовжити гру'}
                </Text>
```

to:

```tsx
                <Text style={styles.continueLabel}>
                  {isAuthenticated ? t('welcome.continueLabel.authenticated') : t('welcome.continueLabel.hasAccount')}
                </Text>
```

Change:

```tsx
              <Text style={styles.playButtonText}>Почати будувати!</Text>
```

to:

```tsx
              <Text style={styles.playButtonText}>{t('welcome.playButton')}</Text>
```

Change:

```tsx
          <Text style={styles.orText}>або</Text>
```

to:

```tsx
          <Text style={styles.orText}>{t('common:actions.or')}</Text>
```

Change:

```tsx
            <Text style={styles.secondaryLabel}>Увійти</Text>
          </Pressable>
          <Pressable onPress={onRegister} style={styles.secondaryButton}>
            <Svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="#2C4A2A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M12 5v14M5 12h14" />
            </Svg>
            <Text style={styles.secondaryLabel}>Реєстрація</Text>
```

to:

```tsx
            <Text style={styles.secondaryLabel}>{t('common:actions.login')}</Text>
          </Pressable>
          <Pressable onPress={onRegister} style={styles.secondaryButton}>
            <Svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="#2C4A2A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M12 5v14M5 12h14" />
            </Svg>
            <Text style={styles.secondaryLabel}>{t('common:actions.register')}</Text>
```

- [ ] **Step 13: Translate the guest note and terms footer**

Change:

```tsx
        {isFirstTime && (
          <Text style={styles.guestNote}>
            Прогрес збережеться після реєстрації
          </Text>
        )}

        <Text style={styles.termsText}>
          {'Продовжуючи, ви приймаєте наші '}
          <Text style={styles.termsUnderline}>Умови</Text>
          {' та '}
          <Text style={styles.termsUnderline}>Політику</Text>
        </Text>
```

to:

```tsx
        {isFirstTime && (
          <Text style={styles.guestNote}>
            {t('welcome.guestNote')}
          </Text>
        )}

        <Text style={styles.termsText}>
          {t('welcome.terms.continuingText')}
          <Text style={styles.termsUnderline}>{t('welcome.terms.terms')}</Text>
          {t('welcome.terms.and')}
          <Text style={styles.termsUnderline}>{t('welcome.terms.policy')}</Text>
        </Text>
```

- [ ] **Step 14: Verify no Ukrainian text remains in either file**

Run: `grep -nP '[\x{0400}-\x{04FF}]' src/screens/LoginScreen.tsx src/screens/WelcomeScreen.tsx`
Expected: no output.

- [ ] **Step 15: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 16: Commit**

```bash
git add src/screens/LoginScreen.tsx src/screens/WelcomeScreen.tsx
git commit -m "feat(i18n): translate LoginScreen and WelcomeScreen"
```

---

## Task 17: Translation key coverage test

**Files:**
- Create: `src/i18n/__tests__/keysExist.test.ts`

**Interfaces:**
- Consumes: all JSON files under `src/i18n/locales/en/` (Tasks 3–4, 6–12), `gameConfig` from `shared/config/gameConfig.ts` (Task 13's ID-only shape)

- [ ] **Step 1: Verify no Ukrainian text remains anywhere in `app/` or `src/`**

Run: `grep -rlP '[\x{0400}-\x{04FF}]' app src --include="*.tsx" --include="*.ts" | grep -v __tests__`
Expected: no output. If anything prints, translate it before proceeding (it means a string was missed in Tasks 5–16).

- [ ] **Step 2: Write the coverage test**

Create `src/i18n/__tests__/keysExist.test.ts`:

```ts
import fs from 'fs';
import path from 'path';
import common from '../locales/en/common.json';
import auth from '../locales/en/auth.json';
import tabs from '../locales/en/tabs.json';
import hotel from '../locales/en/hotel.json';
import lobby from '../locales/en/lobby.json';
import gameContent from '../locales/en/gameContent.json';
import { gameConfig } from '../../../shared/config/gameConfig';

const NAMESPACES: Record<string, unknown> = { common, auth, tabs, hotel, lobby };
const CHROME_NAMESPACE_NAMES = Object.keys(NAMESPACES);

const SOURCE_ROOTS = ['app', 'src'];
const SOURCE_EXTENSIONS = ['.ts', '.tsx'];

function collectSourceFiles(rootDir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      results.push(...collectSourceFiles(fullPath));
    } else if (SOURCE_EXTENSIONS.includes(path.extname(entry.name))) {
      results.push(fullPath);
    }
  }
  return results;
}

function resolveKeyPath(obj: unknown, keyPath: string): unknown {
  return keyPath.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

// Matches t('key'), t("ns:key"), t(`key`) — literal-string calls only.
const LITERAL_T_CALL = /\bt\(\s*['"`]([\w.:-]+)['"`]/g;
// Matches t( followed by anything that is NOT a literal string as the first char
// (template literal with interpolation, variable, concatenation) — used to flag
// dynamic calls in chrome namespaces, which this test cannot statically check.
const DYNAMIC_T_CALL = /\bt\(\s*(`[^`]*\$\{|[a-zA-Z_])/g;

describe('translation key coverage', () => {
  const files = SOURCE_ROOTS.flatMap((root) => collectSourceFiles(path.join(__dirname, '../../..', root)));

  it('finds source files to check', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  for (const file of files) {
    const relative = path.relative(path.join(__dirname, '../../..'), file);
    const content = fs.readFileSync(file, 'utf8');

    it(`${relative}: every literal t() key resolves in its namespace JSON`, () => {
      let match: RegExpExecArray | null;
      LITERAL_T_CALL.lastIndex = 0;
      while ((match = LITERAL_T_CALL.exec(content))) {
        const raw = match[1];
        const [maybeNs, ...rest] = raw.split(':');
        const hasExplicitNs = rest.length > 0 && CHROME_NAMESPACE_NAMES.includes(maybeNs);
        const ns = hasExplicitNs ? maybeNs : undefined;
        const key = hasExplicitNs ? rest.join(':') : raw;

        if (ns) {
          expect(resolveKeyPath(NAMESPACES[ns], key)).not.toBeUndefined();
        }
        // Keys with no namespace prefix belong to whatever namespace the
        // component activated via useTranslation(namespace) — not statically
        // known here, so only namespace-prefixed keys are checked directly.
      }
    });

    it(`${relative}: no dynamic t() calls in chrome namespaces (gameContent excluded)`, () => {
      if (relative.includes('LobbyPanel') || relative.includes('WorkerCard') ||
          relative.includes('JobPickerSheet') || relative.includes('FloorCard') ||
          relative.includes('ProductionCard')) {
        // These files intentionally use dynamic gameContent lookups by id —
        // covered by the id cross-reference check below instead.
        return;
      }
      DYNAMIC_T_CALL.lastIndex = 0;
      expect(DYNAMIC_T_CALL.test(content)).toBe(false);
    });
  }

  describe('gameContent id cross-reference', () => {
    it('every floorType in gameConfig has a category translation', () => {
      for (const key of Object.keys(gameConfig.floorTypes)) {
        expect((gameContent.floorTypes as Record<string, { category: string }>)[key]).toBeDefined();
      }
    });

    it('every floor in gameConfig has a name translation', () => {
      for (const floor of gameConfig.floors) {
        expect((gameContent.floors as Record<string, { name: string }>)[String(floor.id)]).toBeDefined();
      }
    });

    it('every productionType in gameConfig has a displayName translation', () => {
      for (const key of Object.keys(gameConfig.productionTypes)) {
        expect((gameContent.productionTypes as Record<string, { displayName: string }>)[key]).toBeDefined();
      }
    });

    it('gameContent has no orphan floor entries', () => {
      const validIds = new Set(gameConfig.floors.map((f) => String(f.id)));
      for (const id of Object.keys(gameContent.floors)) {
        expect(validIds.has(id)).toBe(true);
      }
    });
  });
});
```

- [ ] **Step 3: Run it**

Run: `npx jest src/i18n/__tests__/keysExist.test.ts`
Expected: PASS. If a literal-key test fails, it means a `t('ns:key')` call references a key missing from that namespace's JSON — add the missing key. If a dynamic-call test fails for a chrome file, it means a non-gameContent file has a template/variable key — replace it with a literal key.

- [ ] **Step 4: Run the full test suite one more time**

Run: `npx jest`
Expected: PASS, no failures.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/__tests__/keysExist.test.ts
git commit -m "test(i18n): add translation key coverage check"
```

---

## Final verification (after Task 17)

- [ ] Run: `npx tsc --noEmit` — no errors.
- [ ] Run: `cd server && npx tsc --noEmit && cd ..` — no errors.
- [ ] Run: `npx jest` — all pass.
- [ ] Run: `cd server && npx jest && cd ..` — all pass.
- [ ] Run: `grep -rlP '[\x{0400}-\x{04FF}]' app src shared --include="*.tsx" --include="*.ts"` — no output (zero Ukrainian text left in client/shared source).
- [ ] Manual: `npx expo start`, open the app, click through Welcome → Login/Register → Tower → City/Shop/Profile tabs → Hotel panel → Job picker → Lobby panel, confirm every visible string is in English and nothing shows a translation key (e.g. `hotel.workerCard.level`) instead of real text.

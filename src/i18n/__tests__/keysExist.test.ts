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

function resolveExactKeyPath(obj: unknown, keyPath: string): unknown {
  return keyPath.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

// i18next pluralization: t('foo.bar', { count }) resolves at runtime to 'foo.bar_one' /
// 'foo.bar_other' (etc.) when the JSON only defines the suffixed forms and no bare
// 'foo.bar' key exists. Fall back to checking the suffixed variants before failing.
const PLURAL_SUFFIXES = ['_zero', '_one', '_two', '_few', '_many', '_other'];

function resolveKeyPath(obj: unknown, keyPath: string): unknown {
  const direct = resolveExactKeyPath(obj, keyPath);
  if (direct !== undefined) return direct;

  for (const suffix of PLURAL_SUFFIXES) {
    const plural = resolveExactKeyPath(obj, `${keyPath}${suffix}`);
    if (plural !== undefined) return plural;
  }
  return undefined;
}

// Matches: const { t } = useTranslation('ns');  const { t: alias } = useTranslation('ns');
// Captures the local variable name (defaults to 't') and the namespace it's bound to,
// so unprefixed t('key') calls can be resolved against the right namespace per file.
const USE_TRANSLATION_BINDING = /const\s*\{\s*t(?:\s*:\s*(\w+))?\s*\}\s*=\s*useTranslation\(\s*['"`](\w+)['"`]\s*\)/g;

function extractNamespaceBindings(content: string): Map<string, string> {
  const bindings = new Map<string, string>();
  let match: RegExpExecArray | null;
  USE_TRANSLATION_BINDING.lastIndex = 0;
  while ((match = USE_TRANSLATION_BINDING.exec(content))) {
    const varName = match[1] ?? 't';
    const ns = match[2];
    bindings.set(varName, ns);
  }
  return bindings;
}

// Matches CALLNAME('key'), CALLNAME("ns:key"), CALLNAME(`key`) — literal-string calls only.
const LITERAL_T_CALL = /\b(\w+)\(\s*['"`]([\w.:-]+)['"`]/g;
// Matches CALLNAME(`static-prefix${ — a template literal with interpolation, capturing
// the function name and the static prefix before the first interpolation.
const DYNAMIC_T_CALL = /\b(\w+)\(\s*`([^$`]*)\$\{/g;

// Dynamic key lookups deliberately allowed in a chrome namespace, because the key space
// is a small, fixed enum defined by a TS union/schema elsewhere, not an open-ended string.
const ALLOWED_DYNAMIC_CHROME_PREFIXES = ['roles.', 'jobPicker.matchBadges.', 'tools.'];

describe('translation key coverage', () => {
  const files = SOURCE_ROOTS.flatMap((root) => collectSourceFiles(path.join(__dirname, '../../..', root)));

  it('finds source files to check', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  for (const file of files) {
    const relative = path.relative(path.join(__dirname, '../../..'), file);
    const content = fs.readFileSync(file, 'utf8');
    const bindings = extractNamespaceBindings(content);

    it(`${relative}: every literal t() key resolves in its namespace JSON`, () => {
      let match: RegExpExecArray | null;
      LITERAL_T_CALL.lastIndex = 0;
      while ((match = LITERAL_T_CALL.exec(content))) {
        const funcName = match[1];
        const raw = match[2];
        const boundNs = bindings.get(funcName);
        if (!boundNs) continue; // not a recognized t()/tContent()-style call in this file

        const [maybeNs, ...rest] = raw.split(':');
        const hasExplicitNs = rest.length > 0 && (CHROME_NAMESPACE_NAMES.includes(maybeNs) || maybeNs === 'gameContent');
        const ns = hasExplicitNs ? maybeNs : boundNs;
        const key = hasExplicitNs ? rest.join(':') : raw;

        if (ns === 'gameContent') continue; // checked separately via the id cross-reference below
        expect(resolveKeyPath(NAMESPACES[ns], key)).not.toBeUndefined();
      }
    });

    it(`${relative}: no unapproved dynamic t() calls in chrome namespaces`, () => {
      let match: RegExpExecArray | null;
      DYNAMIC_T_CALL.lastIndex = 0;
      while ((match = DYNAMIC_T_CALL.exec(content))) {
        const funcName = match[1];
        const prefix = match[2];
        const boundNs = bindings.get(funcName);
        if (!boundNs || boundNs === 'gameContent') continue; // gameContent dynamic lookups are the norm

        const isAllowed = ALLOWED_DYNAMIC_CHROME_PREFIXES.some((p) => prefix.endsWith(p));
        expect(isAllowed).toBe(true);
      }
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

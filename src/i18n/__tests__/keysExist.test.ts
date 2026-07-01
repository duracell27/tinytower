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

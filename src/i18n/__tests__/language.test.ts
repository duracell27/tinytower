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

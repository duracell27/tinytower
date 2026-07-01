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

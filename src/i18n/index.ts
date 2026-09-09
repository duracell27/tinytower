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

import ukCommon from './locales/uk/common.json';
import ukAuth from './locales/uk/auth.json';
import ukTabs from './locales/uk/tabs.json';
import ukHotel from './locales/uk/hotel.json';
import ukLobby from './locales/uk/lobby.json';
import ukGameContent from './locales/uk/gameContent.json';

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
  ns: ['common', 'auth', 'tabs', 'hotel', 'lobby', 'gameContent'],
  defaultNS: 'common',
  resources: {
    en: { common, auth, tabs, hotel, lobby, gameContent },
    uk: { common: ukCommon, auth: ukAuth, tabs: ukTabs, hotel: ukHotel, lobby: ukLobby, gameContent: ukGameContent },
  },
  interpolation: { escapeValue: false },
});

export function setAppLanguage(lang: SupportedLanguage): void {
  getLanguageStorage().set(LANGUAGE_STORAGE_KEY, lang);
  i18next.changeLanguage(lang);
}

export default i18next;

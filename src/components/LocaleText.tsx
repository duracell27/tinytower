import React, { createContext, useContext, useMemo } from 'react';
import { Text, TextProps, StyleSheet, TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

const CYRILLIC_LANGS = ['uk', 'ru', 'bg'];

type FontSet = 'geologica' | 'comfortaa' | 'nunito';

const FONT_MAPS: Record<FontSet, Record<string, string>> = {
  // Fredoka важче ніж Geologica — піднімаємо на ступінь; Nunito 1:1
  geologica: {
    Fredoka_400Regular:   'Geologica_500Medium',
    Fredoka_500Medium:    'Geologica_600SemiBold',
    Fredoka_600SemiBold:  'Geologica_700Bold',
    Fredoka_700Bold:      'Geologica_800ExtraBold',
    Nunito_400Regular:    'Geologica_400Regular',
    Nunito_600SemiBold:   'Geologica_600SemiBold',
    Nunito_700Bold:       'Geologica_700Bold',
    Nunito_800ExtraBold:  'Geologica_800ExtraBold',
  },
  // Fredoka важче ніж Nunito — піднімаємо на ступінь; Nunito 1:1
  nunito: {
    Fredoka_400Regular:   'Nunito_600SemiBold',
    Fredoka_500Medium:    'Nunito_700Bold',
    Fredoka_600SemiBold:  'Nunito_800ExtraBold',
    Fredoka_700Bold:      'Nunito_800ExtraBold',
    Nunito_400Regular:    'Nunito_400Regular',
    Nunito_600SemiBold:   'Nunito_600SemiBold',
    Nunito_700Bold:       'Nunito_700Bold',
    Nunito_800ExtraBold:  'Nunito_800ExtraBold',
  },
  // Fredoka важче ніж Comfortaa — піднімаємо на два ступені; Nunito на ступінь
  comfortaa: {
    Fredoka_400Regular:   'Comfortaa_600SemiBold',
    Fredoka_500Medium:    'Comfortaa_700Bold',
    Fredoka_600SemiBold:  'Comfortaa_700Bold',
    Fredoka_700Bold:      'Comfortaa_700Bold',
    Nunito_400Regular:    'Comfortaa_500Medium',
    Nunito_600SemiBold:   'Comfortaa_700Bold',
    Nunito_700Bold:       'Comfortaa_700Bold',
    Nunito_800ExtraBold:  'Comfortaa_700Bold',
  },
};

const FontSetContext = createContext<FontSet>('nunito');

export function FontSetProvider({ fontSet, children }: { fontSet: FontSet; children: React.ReactNode }) {
  return <FontSetContext.Provider value={fontSet}>{children}</FontSetContext.Provider>;
}

export default function LocaleText({ style, ...props }: TextProps) {
  const { i18n } = useTranslation();
  const fontSet = useContext(FontSetContext);
  const isCyrillic = CYRILLIC_LANGS.includes(i18n.language);

  const mappedStyle = useMemo(() => {
    if (!isCyrillic || !style) return style;
    const flat = StyleSheet.flatten(style) as TextStyle | undefined;
    if (!flat?.fontFamily) return style;
    const mapped = FONT_MAPS[fontSet][flat.fontFamily];
    if (!mapped) return style;
    const result: TextStyle = { ...flat, fontFamily: mapped };
    // Comfortaa max weight is 700 — subtle same-color shadow simulates extra stroke weight
    if (fontSet === 'comfortaa') {
      const color = flat.color as string | undefined;
      result.textShadowColor = color ?? '#000';
      result.textShadowOffset = { width: 0.4, height: 0 };
      result.textShadowRadius = 0.4;
    }
    return result;
  }, [style, isCyrillic, fontSet]);

  return <Text style={mappedStyle} {...props} />;
}

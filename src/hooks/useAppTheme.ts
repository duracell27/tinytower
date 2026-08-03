import { useColorScheme } from 'react-native';

export interface AppTheme {
  isDark: boolean;
  surface: string;
  surfaceSub: string;
  surfaceDanger: string;
  text: string;
  textMuted: string;
  divider: string;
  topBarBg: string;
  topBarBorder: string;
}

const LIGHT: AppTheme = {
  isDark: false,
  surface: '#ffffff',
  surfaceSub: '#F5F3EC',
  surfaceDanger: '#FEF1EE',
  text: '#27331F',
  textMuted: '#7C8A6E',
  divider: '#E4E1D3',
  topBarBg: 'rgba(238,248,230,0.80)',
  topBarBorder: 'rgba(255,255,255,0.70)',
};

const DARK: AppTheme = {
  isDark: true,
  surface: 'rgba(28,34,24,0.93)',
  surfaceSub: 'rgba(255,255,255,0.07)',
  surfaceDanger: 'rgba(220,50,30,0.15)',
  text: '#DDE8D8',
  textMuted: '#8A9A80',
  divider: 'rgba(255,255,255,0.10)',
  topBarBg: 'rgba(18,24,16,0.88)',
  topBarBorder: 'rgba(255,255,255,0.12)',
};

export function useAppTheme(): AppTheme {
  return useColorScheme() === 'dark' ? DARK : LIGHT;
}

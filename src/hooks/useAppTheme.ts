import { useColorScheme } from 'react-native';

export interface AppTheme {
  isDark: boolean;
  surface: string;
  surfaceElevated: string;  // badges/pills that sit on top of a dark panel
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
  surfaceElevated: '#ffffff',
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
  surface: 'rgba(52,55,52,0.97)',
  surfaceElevated: 'rgba(255,255,255,0.13)',
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

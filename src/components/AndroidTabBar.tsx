import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Svg, { Path } from 'react-native-svg';
import LocaleText from './LocaleText';
import { useAppTheme } from '../hooks/useAppTheme';
import { useTranslation } from 'react-i18next';

const TAB_COLORS: Record<string, string> = {
  game:    '#5E8F42',
  city:    '#2E6EC9',
  menu:    '#E7A52B',
  shop:    '#9A6FD0',
  profile: '#E05050',
};

const ICONS: Record<string, string> = {
  game:    'M17 11h2v2h-2zm0 4h2v2h-2zm-4-4h2v2h-2zm0 4h2v2h-2zM1 21h22V7h-8V1H1v20zm8-18h10v16H9V3zM3 9h4v2H3zm0 4h4v2H3zm0 4h4v2H3z',
  city:    'M15 11V5l-3-3-3 3v2H3v14h18V11h-6zm-8 8H5v-2h2v2zm0-4H5v-2h2v2zm0-4H5V9h2v2zm6 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V9h2v2zm0-4h-2V5h2v2zm6 12h-2v-2h2v2zm0-4h-2v-2h2v2z',
  menu:    'M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z',
  shop:    'M18 6h-2c0-2.21-1.79-4-4-4S8 3.79 8 6H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-8 4c0 .55-.45 1-1 1s-1-.45-1-1V8h2v2zm2-6c1.1 0 2 .9 2 2h-4c0-1.1.9-2 2-2zm4 6c0 .55-.45 1-1 1s-1-.45-1-1V8h2v2z',
  profile: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
};

const LABELS: Record<string, string> = {
  game:    'labels.tower',
  city:    'labels.city',
  menu:    'labels.menu',
  shop:    'labels.shop',
  profile: 'labels.profile',
};

const VISIBLE = new Set(['game', 'city', 'menu', 'shop', 'profile']);

interface Props extends BottomTabBarProps {
  isOnboarding: boolean;
}

export default function AndroidTabBar({ state, navigation, isOnboarding }: Props) {
  const theme = useAppTheme();
  const { t } = useTranslation('tabs');
  const { bottom: bottomInset } = useSafeAreaInsets();

  if (isOnboarding) return null;

  const bg = theme.isDark ? 'rgba(18,22,34,0.96)' : 'rgba(255,255,255,0.97)';
  const borderColor = theme.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const inactiveColor = theme.isDark ? 'rgba(255,255,255,0.30)' : 'rgba(0,0,0,0.28)';

  const visibleRoutes = state.routes.filter(r => VISIBLE.has(r.name));

  return (
    <View style={[styles.wrapper, { paddingBottom: 8 + bottomInset }]}>
      <View style={[styles.bar, { backgroundColor: bg, borderColor }]}>
        {visibleRoutes.map((route) => {
          const globalIndex = state.routes.indexOf(route);
          const isFocused = state.index === globalIndex;
          const color = TAB_COLORS[route.name] ?? '#888';
          const activeBg = theme.isDark ? 'rgba(255,255,255,0.09)' : `${color}18`;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              android_ripple={{ color: `${color}30`, borderless: false, radius: 40 }}
              style={[styles.tab, isFocused && { backgroundColor: activeBg }]}
            >
              <Svg viewBox="0 0 24 24" width={22} height={22}>
                <Path d={ICONS[route.name] ?? ''} fill={isFocused ? color : inactiveColor} />
              </Svg>
              <LocaleText style={[styles.label, { color: isFocused ? color : inactiveColor }]}>
                {t(LABELS[route.name] ?? route.name)}
              </LocaleText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 12,
    paddingTop: 4,
    backgroundColor: 'transparent',
  },
  bar: {
    flexDirection: 'row',
    borderRadius: 20,
    height: 56,
    padding: 4,
    gap: 2,
    borderWidth: 1,
    elevation: 12,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: 16,
    paddingVertical: 4,
  },
  label: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 9.5,
    lineHeight: 11,
  },
});

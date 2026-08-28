import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { formatNum } from '../utils/format';
import type { QuickActionMode, FloorActionInfo } from '../utils/quickAction';
import { GemIcon, CoinIcon } from './CurrencyIcons';
import { useAppTheme } from '../hooks/useAppTheme';

interface Props {
  mode: QuickActionMode;
  info: FloorActionInfo | null;
  visible: boolean;
  onHidden: () => void;
  onPress: () => void;
  onExit: () => void;
  onBulkAll?: () => void;
}

const MODE_COLORS: Record<QuickActionMode, { colors: [string, string] }> = {
  collect: { colors: ['#72C24F', '#4A8A2E'] },
  list:    { colors: ['#F2AC40', '#C9760F'] },
  buy:     { colors: ['#4A90D9', '#2563EB'] },
  hire:    { colors: ['#D96E8A', '#B84E6A'] },
};

const BULK_LABEL: Partial<Record<QuickActionMode, string>> = {
  collect: 'All',
  list: 'All',
  buy: 'All',
};

function ModeIcon({ mode }: { mode: QuickActionMode }) {
  switch (mode) {
    case 'collect':
      return <View style={staticStyles.coinCircle} />;
    case 'list':
      return (
        <Svg viewBox="0 0 24 24" width={18} height={18}>
          <Rect x={4} y={6} width={16} height={13} rx={1.6} fill="#fff" />
          <Rect x={4} y={6} width={16} height={4} rx={1.6} fill="rgba(0,0,0,0.16)" />
          <Rect x={11} y={6} width={2} height={13} fill="rgba(0,0,0,0.13)" />
        </Svg>
      );
    case 'buy':
      return (
        <Svg viewBox="0 0 24 24" width={16} height={16}>
          <Path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth={3.2} strokeLinecap="round" />
        </Svg>
      );
    case 'hire':
      return (
        <Svg viewBox="0 0 24 24" width={20} height={18} fill="#fff">
          <Circle cx={9} cy={8} r={3.4} />
          <Path d="M3 20c0-3.3 2.7-5.4 6-5.4s6 2.1 6 5.4z" />
          <Path d="M19 7.5v6M16 10.5h6" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" />
        </Svg>
      );
  }
}

export default function QuickActionBar({ mode, info, visible, onHidden, onPress, onExit, onBulkAll }: Props) {
  const { t: tContent } = useTranslation('gameContent');
  const { colors } = MODE_COLORS[mode];
  const theme = useAppTheme();
  const styles = getStyles(theme);

  const bulkLabel = BULK_LABEL[mode];

  const slideY = useSharedValue(120);
  const firstRunRef = useRef(true);

  useEffect(() => {
    if (firstRunRef.current) {
      firstRunRef.current = false;
      // If mounted already-visible (race: stale onHidden fired during a new session),
      // still animate in so the bar doesn't stay frozen off-screen at slideY=120.
      if (visible) {
        slideY.value = withSpring(0, { damping: 14, stiffness: 160, mass: 0.9 });
      }
      return;
    }
    if (visible) {
      slideY.value = withSpring(0, { damping: 14, stiffness: 160, mass: 0.9 });
    } else {
      slideY.value = withTiming(
        350,
        { duration: 420, easing: Easing.in(Easing.poly(2)) },
        (finished) => {
          if (finished) runOnJS(onHidden)();
        },
      );
    }
  // onHidden is stable: parent wraps it in useCallback([]) — adding it to deps
  // would cause the effect to re-run and potentially cancel an in-flight animation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideY.value }],
  }));

  const collectAmount = info?.mode === 'collect' ? formatNum(info.totalCoins) : null;

  const buyInfo = info?.mode === 'buy' ? {
    name: `Buy ${tContent(`productionTypes.${info.typeId}.displayName`, { defaultValue: info.typeId })}`,
    amount: formatNum(info.buyCost),
  } : null;

  const label = (() => {
    if (!info) return '…';
    switch (info.mode) {
      case 'collect':
        return 'Collect';
      case 'list': {
        if (info.count === 1 && info.typeId) {
          const name = tContent(`productionTypes.${info.typeId}.displayName`, { defaultValue: info.typeId });
          return `Sell ${name}`;
        }
        return info.count === 1 ? 'Sell Item' : `Sell Items (${info.count})`;
      }
      case 'buy':
        return buyInfo!.name;
      case 'hire':
        return 'Find Worker';
    }
  })();

  return (
    <Animated.View style={[styles.wrapper, animatedStyle]}>
      <Pressable
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onExit(); }}
        style={({ pressed }) => [styles.exitBtn, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.exitIcon}>✕</Text>
      </Pressable>

      {onBulkAll && bulkLabel && (
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onBulkAll(); }}
          style={({ pressed }) => [styles.bulkBtn, pressed && { opacity: 0.7 }]}
        >
          <View style={styles.bulkContent}>
            <Text style={styles.bulkLabelText}>{bulkLabel}</Text>
            <GemIcon size={12} />
            <Text style={styles.bulkCostText}>1</Text>
          </View>
        </Pressable>
      )}

      <Pressable
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onPress(); }}
        style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.85 }]}
      >
        <LinearGradient colors={colors} style={styles.btnGradient}>
          <View style={styles.btnContent}>
            {mode === 'collect' ? (
              <>
                <Text style={styles.btnLabel}>{label}</Text>
                <CoinIcon size={18} />
                <Text style={styles.btnLabel}>{collectAmount ?? '…'}</Text>
              </>
            ) : mode === 'buy' && buyInfo ? (
              <>
                <Text style={[styles.btnLabel, styles.btnLabelFlex]} numberOfLines={1}>{label}</Text>
                <CoinIcon size={18} />
                <Text style={styles.btnLabel}>{buyInfo.amount}</Text>
              </>
            ) : (
              <>
                <ModeIcon mode={mode} />
                <Text style={styles.btnLabel} numberOfLines={1}>{label}</Text>
              </>
            )}
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

// Static styles that don't depend on theme (used by ModeIcon sub-component)
const staticStyles = StyleSheet.create({
  coinCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#F2B330',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
  },
});

function getStyles(theme: ReturnType<typeof useAppTheme>) {
  const { isDark } = theme;
  const pillBg = isDark ? theme.surfaceElevated : 'rgba(255,255,255,0.92)';
  const pillTextColor = isDark ? theme.text : theme.textMuted;
  return StyleSheet.create({
    wrapper: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 10,
      paddingHorizontal: 16,
      paddingBottom: 90,
      paddingTop: 8,
    },
    exitBtn: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: pillBg,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 6,
    },
    exitIcon: {
      fontFamily: 'Fredoka_700Bold',
      fontSize: 20,
      color: pillTextColor,
    },
    actionBtn: {
      flex: 1,
      borderRadius: 27,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.22,
      shadowRadius: 6,
      elevation: 8,
    },
    btnGradient: {
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 27,
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.4)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    btnLabel: {
      fontFamily: 'Fredoka_700Bold',
      fontSize: 17,
      color: '#fff',
      letterSpacing: 0.3,
    },
    btnLabelFlex: {
      flexShrink: 1,
      minWidth: 0,
    },
    bulkBtn: {
      height: 50,
      borderRadius: 25,
      backgroundColor: pillBg,
      paddingHorizontal: 12,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 6,
    },
    bulkContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    bulkCostText: {
      fontFamily: 'Fredoka_600SemiBold',
      fontSize: 17,
      color: '#2592AB',
    },
    bulkLabelText: {
      fontFamily: 'Fredoka_600SemiBold',
      fontSize: 17,
      color: pillTextColor,
    },
  });
}

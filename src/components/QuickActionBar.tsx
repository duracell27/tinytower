import React, { useEffect } from 'react';
import { Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { formatNum } from '../utils/format';
import type { QuickActionMode, FloorActionInfo } from '../utils/quickAction';

interface Props {
  mode: QuickActionMode;
  info: FloorActionInfo | null;
  visible: boolean;
  onHidden: () => void;
  onPress: () => void;
  onExit: () => void;
}

const MODE_COLORS: Record<QuickActionMode, { colors: [string, string] }> = {
  collect: { colors: ['#72C24F', '#4A8A2E'] },
  list:    { colors: ['#F2AC40', '#C9760F'] },
  buy:     { colors: ['#4A90D9', '#2563EB'] },
  hire:    { colors: ['#D96E8A', '#B84E6A'] },
};

export default function QuickActionBar({ mode, info, visible, onHidden, onPress, onExit }: Props) {
  const { t: tContent } = useTranslation('gameContent');
  const { colors } = MODE_COLORS[mode];

  const slideY = useSharedValue(120);

  useEffect(() => {
    if (visible) {
      slideY.value = withSpring(0, { damping: 14, stiffness: 160, mass: 0.9 });
    } else {
      slideY.value = withTiming(
        120,
        { duration: 280, easing: Easing.in(Easing.quad) },
        (finished) => {
          if (finished) runOnJS(onHidden)();
        },
      );
    }
  // onHidden identity is stable (wrapped in useCallback in parent)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideY.value }],
  }));

  const label = (() => {
    if (!info) return '…';
    switch (info.mode) {
      case 'collect':
        return `Зібрати монети ($${formatNum(info.totalCoins)})`;
      case 'list':
        return info.count === 1 ? 'Викласти товар' : `Викласти товар (${info.count} шт)`;
      case 'buy': {
        const productName = tContent(`productionTypes.${info.typeId}.displayName`, {
          defaultValue: info.typeId,
        });
        return `Закупити ${productName} ($${formatNum(info.buyCost)})`;
      }
      case 'hire':
        return 'Знайти робітника';
    }
  })();

  return (
    <Animated.View style={[styles.wrapper, animatedStyle]}>
      <Pressable
        onPress={onExit}
        style={({ pressed }) => [styles.exitBtn, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.exitIcon}>✕</Text>
      </Pressable>

      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.85 }]}
      >
        <LinearGradient colors={colors} style={styles.btnGradient}>
          <Text style={styles.btnLabel} numberOfLines={1}>{label}</Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: 'rgba(255,255,255,0.92)',
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
    color: '#6A7585',
  },
  actionBtn: {
    flex: 1,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 8,
  },
  btnGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
  },
  btnLabel: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 17,
    color: '#fff',
    letterSpacing: 0.3,
  },
});

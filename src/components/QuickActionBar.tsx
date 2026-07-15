import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
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

function ModeIcon({ mode }: { mode: QuickActionMode }) {
  switch (mode) {
    case 'collect':
      return <View style={styles.coinCircle} />;
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

export default function QuickActionBar({ mode, info, visible, onHidden, onPress, onExit }: Props) {
  const { t: tContent } = useTranslation('gameContent');
  const { colors } = MODE_COLORS[mode];

  const slideY = useSharedValue(120);
  const firstRunRef = useRef(true);

  useEffect(() => {
    if (firstRunRef.current) {
      firstRunRef.current = false;
      return;
    }
    if (visible) {
      slideY.value = withSpring(0, { damping: 14, stiffness: 160, mass: 0.9 });
    } else {
      slideY.value = withSpring(
        120,
        { damping: 30, stiffness: 300, mass: 0.8 },
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

  const label = (() => {
    if (!info) return '…';
    switch (info.mode) {
      case 'collect':
        return `Collect ($${formatNum(info.totalCoins)})`;
      case 'list':
        return info.count === 1 ? 'List Item' : `List Items (${info.count})`;
      case 'buy': {
        const productName = tContent(`productionTypes.${info.typeId}.displayName`, {
          defaultValue: info.typeId,
        });
        return `Buy ${productName} ($${formatNum(info.buyCost)})`;
      }
      case 'hire':
        return 'Find Worker';
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
          <View style={styles.btnContent}>
            <ModeIcon mode={mode} />
            <Text style={styles.btnLabel} numberOfLines={1}>{label}</Text>
          </View>
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
  coinCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#F2B330',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
  },
});

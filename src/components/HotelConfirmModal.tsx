import React, { useEffect } from 'react';
import { View, Pressable, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, Easing,
} from 'react-native-reanimated';
import LocaleText from './LocaleText';
import { GemIcon } from './CurrencyIcons';
import { useAppTheme } from '../hooks/useAppTheme';

const { width: SCREEN_W } = Dimensions.get('window');

interface Props {
  visible: boolean;
  icon: number;
  title: string;
  subtitle: string;
  costLabel: string;
  cost: number;
  confirmText: string;
  cancelText: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function HotelConfirmModal({
  visible, icon, title, subtitle, costLabel, cost,
  confirmText, cancelText, danger, onConfirm, onCancel,
}: Props) {
  const theme = useAppTheme();
  const { isDark } = theme;
  const scale   = useSharedValue(0.5);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 });
      scale.value   = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
    } else {
      opacity.value = withTiming(0, { duration: 160 });
      scale.value   = withTiming(0.5, { duration: 160 });
    }
  }, [visible]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const cardStyle  = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  const confirmColors: [string, string] = danger
    ? ['#E54030', '#C42A20']
    : ['#74D44F', '#5BA63C'];

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />

      <Animated.View style={[styles.card, cardStyle]}>
        <LinearGradient
          colors={isDark ? ['#1E2026', '#252930'] : ['#F0F4FA', '#E4EAF2']}
          style={styles.cardGradient}
        >
          <View style={[styles.iconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#EEF1F6' }]}>
            <Image source={icon} style={styles.icon} contentFit="contain" />
          </View>

          <LocaleText style={[styles.title, { color: theme.text }]}>{title}</LocaleText>
          <LocaleText style={[styles.subtitle, { color: isDark ? '#6B7585' : '#9BA3B0' }]}>{subtitle}</LocaleText>

          <View style={[styles.priceCard, { backgroundColor: theme.surface }]}>
            <LocaleText style={[styles.priceLabel, { color: isDark ? '#6B7585' : '#9BA3B0' }]}>{costLabel}</LocaleText>
            <View style={styles.priceRow}>
              <GemIcon size={26} />
              <LocaleText style={[styles.priceValue, styles.gemText]}>{cost}</LocaleText>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.btn, pressed && { opacity: 0.88 }]}
            onPress={onConfirm}
          >
            <LinearGradient colors={confirmColors} style={styles.btnGradient}>
              <LocaleText style={styles.btnText}>{confirmText}</LocaleText>
            </LinearGradient>
            <View style={[styles.btnShadow, { backgroundColor: danger ? 'rgba(100,0,0,0.3)' : 'rgba(20,60,0,0.3)' }]} />
          </Pressable>

          <Pressable onPress={onCancel} style={styles.cancelBtn} hitSlop={8}>
            <LocaleText style={[styles.cancelText, { color: isDark ? '#5A6472' : '#9BA3B0' }]}>{cancelText}</LocaleText>
          </Pressable>
        </LinearGradient>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  card: {
    width: SCREEN_W * 0.82,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: 'rgba(30,50,80,1)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 30,
    elevation: 12,
  },
  cardGradient: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 22,
    gap: 12,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  icon: { width: 44, height: 44 },
  title: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 22,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 14,
    textAlign: 'center',
    marginTop: -4,
  },
  priceCard: {
    width: '100%',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 6,
    shadowColor: 'rgba(40,60,90,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  priceLabel: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 12,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceValue: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 26,
  },
  gemText: { color: '#2592AB' },
  btn: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  btnGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    zIndex: 1,
  },
  btnText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 17,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  btnShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  cancelBtn: { paddingVertical: 4 },
  cancelText: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 14,
  },
});

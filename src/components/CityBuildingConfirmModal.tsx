import React, { useEffect } from 'react';
import { View, Pressable, StyleSheet, Dimensions } from 'react-native';
import LocaleText from './LocaleText';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { formatNum } from '../utils/format';
import { useAppTheme } from '../hooks/useAppTheme';

const { width: SCREEN_W } = Dimensions.get('window');

const COIN_ICON = require('../../assets/img/coin.png');
const GEM_ICON  = require('../../assets/img/diamond.png');

export interface CityBuildingConfirmPayload {
  title: string;
  confirmText: string;
  currency: 'gems' | 'coins';
  amount: number;
  onConfirm: () => void;
}

interface Props {
  payload: CityBuildingConfirmPayload | null;
  onClose: () => void;
  accent: string;
}

export default function CityBuildingConfirmModal({ payload, onClose, accent }: Props) {
  const { t }   = useTranslation('tabs');
  const theme   = useAppTheme();
  const { isDark } = theme;

  const visible = payload !== null;
  const scale   = useSharedValue(0.5);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 });
      scale.value   = withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) });
    } else {
      opacity.value = 0;
      scale.value   = 0.5;
    }
  }, [visible]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const cardStyle  = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity:   opacity.value,
  }));

  if (!visible || !payload) return null;

  const isGems   = payload.currency === 'gems';
  const icon     = isGems ? GEM_ICON : COIN_ICON;
  const valColor = isGems ? '#2592AB' : '#C28A22';

  return (
    <Animated.View style={[styles.scrim, scrimStyle]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

      <Animated.View style={[styles.card, cardStyle]}>
        <LinearGradient
          colors={isDark ? [theme.surface, '#252930'] : ['#F0F4FA', '#E4EAF2']}
          style={styles.cardGradient}
        >
          {/* Accent bar */}
          <View style={[styles.accentBar, { backgroundColor: accent }]} />

          {/* Title */}
          <LocaleText style={[styles.title, { color: accent }]}>
            {payload.title}
          </LocaleText>

          {/* Cost box */}
          <View style={[styles.costBox, { backgroundColor: theme.surface }]}>
            <LocaleText style={[styles.costLabel, { color: isDark ? '#6B7585' : '#9BA3B0' }]}>
              {t('city.buildings.detail.fromBudget')}
            </LocaleText>
            <View style={styles.costRow}>
              <Image source={icon} style={styles.costIcon} contentFit="contain" />
              <LocaleText style={[styles.costAmount, { color: valColor }]}>
                {formatNum(payload.amount)}
              </LocaleText>
            </View>
          </View>

          {/* Buttons */}
          <View style={[styles.btnRow, { borderTopColor: isDark ? '#2A3A50' : '#E0E8F0' }]}>
            <Pressable
              style={({ pressed }) => [styles.btn, styles.btnCancel, pressed && { opacity: 0.7 }]}
              onPress={onClose}
            >
              <LocaleText style={[styles.btnCancelText, { color: isDark ? '#6B7585' : '#9BA3B0' }]}>
                {t('city.buildings.detail.confirmNo')}
              </LocaleText>
            </Pressable>

            <View style={[styles.btnDivider, { backgroundColor: isDark ? '#2A3A50' : '#E0E8F0' }]} />

            <Pressable
              style={({ pressed }) => [styles.btn, styles.btnConfirm, pressed && { opacity: 0.85 }]}
              onPress={() => { payload.onConfirm(); onClose(); }}
            >
              <LinearGradient
                colors={[accent, accent + 'CC']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.btnConfirmGradient}
              >
                <LocaleText style={styles.btnConfirmText}>
                  {payload.confirmText}
                </LocaleText>
              </LinearGradient>
            </Pressable>
          </View>
        </LinearGradient>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
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
    paddingBottom: 0,
    gap: 14,
    overflow: 'hidden',
  },
  accentBar: { height: 5, width: '100%' },
  title: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 22,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 22,
  },
  costBox: {
    width: '100%',
    marginHorizontal: 22,
    alignSelf: 'stretch',
    marginLeft: 22,
    marginRight: 22,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 8,
    shadowColor: 'rgba(40,60,90,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
    marginBottom: 4,
  },
  costLabel: { fontFamily: 'Fredoka_500Medium', fontSize: 13 },
  costRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  costIcon:  { width: 28, height: 28 },
  costAmount: { fontFamily: 'Fredoka_700Bold', fontSize: 28 },

  btnRow: {
    flexDirection: 'row',
    width: '100%',
    borderTopWidth: 1,
    marginTop: 4,
  },
  btn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  btnDivider: { width: 1 },
  btnCancel: { paddingVertical: 16 },
  btnCancelText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 16 },
  btnConfirm: { overflow: 'hidden' },
  btnConfirmGradient: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  btnConfirmText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 16,
    color: '#FFFFFF',
  },
});

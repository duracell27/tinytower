import React, { useEffect } from 'react';
import { View, Pressable, Modal, StyleSheet, Dimensions } from 'react-native';
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

interface Props {
  payload: { currency: 'gems' | 'coins'; need: number; have: number } | null;
  onClose: () => void;
}

export default function CityBudgetInsufficientModal({ payload, onClose }: Props) {
  const { t } = useTranslation('tabs');
  const theme = useAppTheme();
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

  const isGems  = payload.currency === 'gems';
  const deficit = payload.need - payload.have;
  const icon    = isGems ? GEM_ICON : COIN_ICON;
  const valColor = isGems ? '#2592AB' : '#C28A22';

  const title = isGems
    ? t('city.buildings.detail.insufficientTitle') + ' 💎'
    : t('city.buildings.detail.insufficientTitle') + ' 🪙';

  return (
    <Modal transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.scrim, scrimStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <Animated.View style={[styles.card, cardStyle]}>
          <LinearGradient
            colors={isDark ? [theme.surface, '#252930'] : ['#F0F4FA', '#E4EAF2']}
            style={styles.cardGradient}
          >
            {/* Icon */}
            <View style={[styles.iconWrap, { backgroundColor: isDark ? theme.divider : theme.surfaceSub }]}>
              <Image source={icon} style={styles.iconLarge} contentFit="contain" />
            </View>

            {/* Title */}
            <LocaleText style={[styles.title, { color: theme.text }]}>
              {t('city.buildings.detail.insufficientTitle')}
            </LocaleText>

            {/* Deficit card */}
            <View style={[styles.deficitCard, { backgroundColor: theme.surface }]}>
              <View style={styles.deficitRow}>
                <View style={styles.deficitCell}>
                  <LocaleText style={[styles.deficitLabel, { color: isDark ? '#6B7585' : '#9BA3B0' }]}>
                    {t('city.buildings.detail.insufficientHave')}
                  </LocaleText>
                  <View style={styles.deficitValueRow}>
                    <Image source={icon} style={styles.valueIcon} contentFit="contain" />
                    <LocaleText style={[styles.deficitValue, { color: valColor }]}>
                      {formatNum(payload.have)}
                    </LocaleText>
                  </View>
                </View>

                <LocaleText style={[styles.arrow, { color: isDark ? '#4A5060' : '#C5CAD4' }]}>→</LocaleText>

                <View style={styles.deficitCell}>
                  <LocaleText style={[styles.deficitLabel, { color: isDark ? '#6B7585' : '#9BA3B0' }]}>
                    {t('city.buildings.detail.insufficientNeed')}
                  </LocaleText>
                  <View style={styles.deficitValueRow}>
                    <Image source={icon} style={styles.valueIcon} contentFit="contain" />
                    <LocaleText style={[styles.deficitValue, { color: valColor }]}>
                      {formatNum(payload.need)}
                    </LocaleText>
                  </View>
                </View>
              </View>

              <View style={[styles.missingRow, { backgroundColor: theme.surfaceDanger }]}>
                <LocaleText style={styles.missingLabel}>
                  {t('city.buildings.detail.insufficientMissing')}:
                </LocaleText>
                <View style={styles.deficitValueRow}>
                  <Image source={icon} style={styles.valueIcon} contentFit="contain" />
                  <LocaleText style={styles.missingValue}>{formatNum(deficit)}</LocaleText>
                </View>
              </View>
            </View>

            {/* Close */}
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <LocaleText style={[styles.closeBtnText, { color: isDark ? '#5A6472' : '#9BA3B0' }]}>
                OK
              </LocaleText>
            </Pressable>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
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
  iconLarge: { width: 48, height: 48 },

  title: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 22,
    textAlign: 'center',
  },

  deficitCard: {
    width: '100%',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 10,
    shadowColor: 'rgba(40,60,90,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  deficitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deficitCell: { alignItems: 'center', gap: 4, flex: 1 },
  deficitLabel: { fontFamily: 'Fredoka_500Medium', fontSize: 12 },
  deficitValueRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  deficitValue: { fontFamily: 'Fredoka_700Bold', fontSize: 18 },
  valueIcon: { width: 16, height: 16 },
  arrow: { fontFamily: 'Fredoka_500Medium', fontSize: 18, marginHorizontal: 4 },

  missingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  missingLabel: { fontFamily: 'Fredoka_500Medium', fontSize: 13, color: '#D9534F' },
  missingValue: { fontFamily: 'Fredoka_700Bold', fontSize: 16, color: '#D9534F' },

  closeBtn: { paddingVertical: 6 },
  closeBtnText: { fontFamily: 'Fredoka_500Medium', fontSize: 14 },
});

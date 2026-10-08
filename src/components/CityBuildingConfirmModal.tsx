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

const TOOL_ICONS: Record<string, any> = {
  briks:  require('../../assets/img/tools/briks.png'),
  glass:  require('../../assets/img/tools/glass.png'),
  nails:  require('../../assets/img/tools/nails.png'),
  screw:  require('../../assets/img/tools/screw.png'),
  wood:   require('../../assets/img/tools/wood.png'),
  cement: require('../../assets/img/tools/cement.png'),
};

export interface CityBuildingConfirmPayload {
  title: string;
  confirmText: string;
  currency: 'gems' | 'coins';
  amount: number;
  tools?: { key: string; have: number; need: number }[];
  onConfirm: () => void;
}

interface Props {
  payload: CityBuildingConfirmPayload | null;
  onClose: () => void;
  accent: string;
}

export default function CityBuildingConfirmModal({ payload, onClose, accent }: Props) {
  const { t }       = useTranslation('tabs');
  const theme       = useAppTheme();
  const { isDark }  = theme;

  const visible = payload !== null;
  const scale   = useSharedValue(0.5);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 180 });
      scale.value   = withTiming(1, { duration: 320, easing: Easing.out(Easing.back(1.4)) });
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
          colors={isDark ? ['#1C2840', '#141E30'] : ['#F5F8FF', '#E8EEF8']}
          style={styles.cardGradient}
        >
          {/* Accent bar */}
          <View style={[styles.accentBar, { backgroundColor: accent }]} />

          {/* Title */}
          <LocaleText style={[styles.title, { color: isDark ? '#E8EEF8' : '#1A2540' }]}>
            {payload.title}
          </LocaleText>

          {/* Cost box */}
          <View style={[styles.costBox, { backgroundColor: isDark ? '#0F1A28' : '#FFFFFF' }]}>
            <LocaleText style={[styles.costLabel, { color: isDark ? '#5A6880' : '#8A96A8' }]}>
              {t('city.buildings.detail.fromBudget')}
            </LocaleText>
            <View style={styles.costRow}>
              <Image source={icon} style={styles.costIcon} contentFit="contain" />
              <LocaleText style={[styles.costAmount, { color: valColor }]}>
                {formatNum(payload.amount)}
              </LocaleText>
            </View>
          </View>

          {/* Tools */}
          {payload.tools && payload.tools.length > 0 && (
            <View style={[styles.toolsBox, { backgroundColor: isDark ? '#0F1A28' : '#FFFFFF' }]}>
              <LocaleText style={[styles.toolsLabel, { color: isDark ? '#5A6880' : '#8A96A8' }]}>
                {t('city.buildings.detail.toolsRequired')}
              </LocaleText>
              <View style={styles.toolsRow}>
                {payload.tools.map(({ key, have, need }) => {
                  const enough = have >= need;
                  return (
                    <View key={key} style={styles.toolItem}>
                      <Image source={TOOL_ICONS[key]} style={styles.toolIcon} contentFit="contain" />
                      <LocaleText style={[styles.toolCount, { color: enough ? '#49AA38' : '#D03030' }]}>
                        {`${have}/${need}`}
                      </LocaleText>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Buttons */}
          <View style={styles.btnArea}>
            <Pressable
              style={({ pressed }) => [
                styles.btnConfirm,
                { backgroundColor: accent, opacity: pressed ? 0.82 : 1 },
              ]}
              onPress={() => { payload.onConfirm(); onClose(); }}
            >
              <LocaleText style={styles.btnConfirmText}>
                {payload.confirmText}
              </LocaleText>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.btnCancel,
                { borderColor: isDark ? '#2A3A54' : '#D0DAE8', opacity: pressed ? 0.7 : 1 },
              ]}
              onPress={onClose}
            >
              <LocaleText style={[styles.btnCancelText, { color: isDark ? '#6B7A90' : '#8A96A8' }]}>
                {t('city.buildings.detail.confirmNo')}
              </LocaleText>
            </Pressable>
          </View>
        </LinearGradient>
      </Animated.View>
    </Animated.View>
  );
}

const CARD_W = Math.min(SCREEN_W * 0.82, 340);

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  card: {
    width: CARD_W,
    borderRadius: 26,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.35,
    shadowRadius: 32,
    elevation: 14,
  },
  cardGradient: {
    paddingBottom: 22,
    gap: 16,
  },
  accentBar: { height: 4 },
  title: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 20,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 24,
  },
  costBox: {
    marginHorizontal: 20,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  costLabel: { fontFamily: 'Fredoka_500Medium', fontSize: 13 },
  costRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  costIcon:  { width: 30, height: 30 },
  costAmount: { fontFamily: 'Fredoka_700Bold', fontSize: 30 },

  toolsBox: {
    marginHorizontal: 20,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  toolsLabel: { fontFamily: 'Fredoka_500Medium', fontSize: 12 },
  toolsRow:   { flexDirection: 'row', gap: 16, flexWrap: 'wrap', justifyContent: 'center' },
  toolItem:   { alignItems: 'center', gap: 3 },
  toolIcon:   { width: 30, height: 30 },
  toolCount:  { fontFamily: 'Fredoka_600SemiBold', fontSize: 12 },

  btnArea: { marginHorizontal: 20, gap: 10 },

  btnConfirm: {
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnConfirmText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 17,
    color: '#FFFFFF',
  },

  btnCancel: {
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancelText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 16,
  },
});

import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, Dimensions, useColorScheme } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../stores/gameStore';
import { formatNum } from '../utils/format';

const { width: SCREEN_W } = Dimensions.get('window');

type FloorType = 'green' | 'blue' | 'yellow' | 'purple' | 'red';

const TYPE_COLORS: Record<FloorType, string> = {
  green: '#3FA535', blue: '#3376E5', yellow: '#E5A72E', purple: '#9A6FD0', red: '#E05A4A',
};

const TOKEN_ICONS: Record<FloorType, ReturnType<typeof require>> = {
  green:  require('../../assets/img/tokens/tokenGreen.png'),
  blue:   require('../../assets/img/tokens/tokenBlue.png'),
  yellow: require('../../assets/img/tokens/tokenYellow.png'),
  purple: require('../../assets/img/tokens/tokenViolet.png'),
  red:    require('../../assets/img/tokens/tokenRed.png'),
};

export default function TokenInsufficientModal({ asOverlay = false }: { asOverlay?: boolean }) {
  const { t } = useTranslation('hotel');
  const isDark = useColorScheme() === 'dark';
  const payload = useGameStore((s) => s.tokenInsufficient);
  const clearTokenInsufficient = useGameStore((s) => s.clearTokenInsufficient);
  const activeSheetCount = useGameStore((s) => s.activeSheetCount);

  const scale   = useSharedValue(0.5);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (payload) {
      opacity.value = withTiming(1, { duration: 200 });
      scale.value   = withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) });
    } else {
      opacity.value = 0;
      scale.value   = 0.5;
    }
  }, [payload]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const cardStyle  = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!payload || (activeSheetCount > 0 && !asOverlay)) return null;

  const ft    = payload.floorType;
  const color = TYPE_COLORS[ft];

  const inner = (
    <Animated.View style={[styles.scrim, scrimStyle]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={clearTokenInsufficient} />
      <Animated.View style={[styles.card, cardStyle]}>
        <LinearGradient
          colors={isDark ? ['#1E2026', '#252930'] : ['#F0F4FA', '#E4EAF2']}
          style={styles.cardGradient}
        >

          <View style={[styles.iconWrap, isDark && { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
            <Image source={TOKEN_ICONS[ft]} style={styles.tokenImg} contentFit="contain" />
          </View>

          <Text style={[styles.title, isDark && { color: '#DDE8D8' }]}>{t('myBusiness.notEnoughTokens')}</Text>

          <View style={[styles.deficitCard, isDark && { backgroundColor: '#2A2F38' }]}>
            <View style={styles.deficitRow}>
              <View style={styles.deficitCell}>
                <Text style={[styles.deficitLabel, isDark && { color: '#6B7585' }]}>{t('myBusiness.have')}</Text>
                <View style={styles.deficitValueRow}>
                  <Image source={TOKEN_ICONS[ft]} style={styles.deficitIcon} contentFit="contain" />
                  <Text style={[styles.deficitValue, { color }]}>{formatNum(payload.have)}</Text>
                </View>
              </View>
              <Text style={[styles.arrow, isDark && { color: '#4A5060' }]}>→</Text>
              <View style={styles.deficitCell}>
                <Text style={[styles.deficitLabel, isDark && { color: '#6B7585' }]}>{t('myBusiness.need')}</Text>
                <View style={styles.deficitValueRow}>
                  <Image source={TOKEN_ICONS[ft]} style={styles.deficitIcon} contentFit="contain" />
                  <Text style={[styles.deficitValue, { color }]}>{formatNum(payload.need)}</Text>
                </View>
              </View>
            </View>
            <View style={[styles.missingRow, isDark && { borderTopColor: 'rgba(255,255,255,0.08)' }]}>
              <Text style={styles.missingLabel}>{t('myBusiness.missing')}:</Text>
              <View style={styles.deficitValueRow}>
                <Image source={TOKEN_ICONS[ft]} style={styles.deficitIcon} contentFit="contain" />
                <Text style={styles.missingValue}>{formatNum(payload.need - payload.have)}</Text>
              </View>
            </View>
          </View>

          <Pressable
            onPress={() => { router.replace('/shop'); clearTokenInsufficient(); }}
            style={({ pressed }) => [styles.shopBtn, pressed && { opacity: 0.85 }]}
          >
            <LinearGradient colors={['#52A6E2', '#3B8BCB']} style={styles.shopBtnGradient}>
              <Text style={styles.shopBtnText}>{t('myBusiness.goToShop')}</Text>
            </LinearGradient>
            <View style={styles.shopBtnShadow} />
          </Pressable>

          <Pressable onPress={clearTokenInsufficient} style={styles.closeBtn}>
            <Text style={[styles.closeBtnText, isDark && { color: '#5A6472' }]}>{t('myBusiness.cancel')}</Text>
          </Pressable>

        </LinearGradient>
      </Animated.View>
    </Animated.View>
  );

  if (asOverlay) return <View style={StyleSheet.absoluteFill}>{inner}</View>;

  return (
    <Modal visible transparent animationType="none" onRequestClose={clearTokenInsufficient}>
      {inner}
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
    shadowColor: 'rgba(0,0,0,1)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },
  cardGradient: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 24,
    gap: 14,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenImg: { width: 40, height: 40 },
  title: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 20,
    color: '#3D3D3D',
    textAlign: 'center',
  },
  deficitCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  deficitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  deficitCell: { alignItems: 'center', gap: 4 },
  deficitLabel: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 12,
    color: '#9BA3B0',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  deficitValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deficitIcon: { width: 18, height: 18 },
  deficitValue: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 22,
  },
  arrow: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 20,
    color: '#9BA3B0',
  },
  missingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(100,110,120,0.12)',
  },
  missingLabel: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 14,
    color: '#E05A4A',
  },
  missingValue: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 16,
    color: '#E05A4A',
  },
  shopBtn: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  shopBtnGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    zIndex: 1,
  },
  shopBtnText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 17,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  shopBtnShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  closeBtn: {
    paddingVertical: 6,
  },
  closeBtnText: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 14,
    color: '#9BA3B0',
  },
});

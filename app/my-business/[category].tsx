import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ImageBackground, Modal, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { useGameStore } from '../../src/stores/gameStore';
import { BUSINESS_UPGRADE_COSTS } from '../../shared/config/businessUpgradeCosts';
import { formatNum } from '../../src/utils/format';
import { CoinIcon, GemIcon } from '../../src/components/CurrencyIcons';
import InsufficientResourcesModal from '../../src/components/InsufficientResourcesModal';

const { width: SCREEN_W } = Dimensions.get('window');

type FloorType = 'green' | 'blue' | 'yellow' | 'purple' | 'red';
const VALID_TYPES = new Set<string>(['green', 'blue', 'yellow', 'purple', 'red']);

const TYPE_COLORS: Record<FloorType, string> = {
  green:  '#3FA535',
  blue:   '#3376E5',
  yellow: '#E5A72E',
  purple: '#9A6FD0',
  red:    '#E05A4A',
};

const TOKEN_ICONS: Record<FloorType, ReturnType<typeof require>> = {
  green:  require('../../assets/img/tokens/tokenGreen.png'),
  blue:   require('../../assets/img/tokens/tokenBlue.png'),
  yellow: require('../../assets/img/tokens/tokenYellow.png'),
  purple: require('../../assets/img/tokens/tokenViolet.png'),
  red:    require('../../assets/img/tokens/tokenRed.png'),
};

export default function BusinessCategoryScreen() {
  const { t: tHotel } = useTranslation('hotel');
  const { category } = useLocalSearchParams<{ category: string }>();
  const ft = VALID_TYPES.has(category ?? '') ? (category as FloorType) : 'green';

  const balance          = useGameStore((s) => s.balance);
  const gems             = useGameStore((s) => s.gems);
  const tokens           = useGameStore((s) => s.tokens);
  const businessUpgrades = useGameStore((s) => s.businessUpgrades);
  const upgradeBusinessCategory  = useGameStore((s) => s.upgradeBusinessCategory);
  const showInsufficientResources = useGameStore((s) => s.showInsufficientResources);

  const [tokenModal, setTokenModal] = useState<{ have: number; need: number } | null>(null);
  const tokenModalScale   = useSharedValue(0.5);
  const tokenModalOpacity = useSharedValue(0);

  useEffect(() => {
    if (tokenModal) {
      tokenModalOpacity.value = withTiming(1, { duration: 200 });
      tokenModalScale.value   = withTiming(1, { duration: 350, easing: Easing.out(Easing.back(1.4)) });
    } else {
      tokenModalOpacity.value = 0;
      tokenModalScale.value   = 0.5;
    }
  }, [tokenModal]);

  const tokenScrimStyle = useAnimatedStyle(() => ({ opacity: tokenModalOpacity.value }));
  const tokenCardStyle  = useAnimatedStyle(() => ({
    transform: [{ scale: tokenModalScale.value }],
    opacity: tokenModalOpacity.value,
  }));

  const level    = businessUpgrades?.[ft] ?? 0;
  const tokenBal = tokens?.[ft] ?? 0;
  const color    = TYPE_COLORS[ft];
  const isMaxed  = level >= 40;
  const nextCost = !isMaxed ? BUSINESS_UPGRADE_COSTS[level] : null;

  function handleUpgrade() {
    if (isMaxed) return;
    if (!nextCost) return;

    if (nextCost.kind === 'gems') {
      if (gems < nextCost.gems) {
        showInsufficientResources({ currency: 'gems', need: nextCost.gems, have: gems });
        return;
      }
    } else {
      if (balance < nextCost.coins) {
        showInsufficientResources({ currency: 'coins', need: nextCost.coins, have: balance });
        return;
      }
      if (tokenBal < nextCost.tokens) {
        setTokenModal({ have: tokenBal, need: nextCost.tokens });
        return;
      }
    }

    upgradeBusinessCategory(ft);
  }

  return (
    <ImageBackground
      source={require('../../assets/img/backgroung/bg15.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
      <View style={styles.scroll}>
        <View style={styles.header}>
          <Text style={[styles.title, { color }]}>{tHotel(`myBusiness.categories.${ft}`)}</Text>
        </View>

        {/* Level + progress */}
        <View style={styles.card}>
          <Text style={styles.levelText}>{tHotel('myBusiness.level', { level })}</Text>
          <Text style={[styles.bonusText, { color }]}>
            {isMaxed ? tHotel('myBusiness.maxLevel') : tHotel('myBusiness.profitBonus', { percent: level * 5 })}
          </Text>
          <View style={[styles.progressBg, { backgroundColor: `${color}22` }]}>
            <View style={[styles.progressFill, { width: `${(level / 40) * 100}%`, backgroundColor: color }]} />
          </View>
          <Text style={styles.progressLabel}>{level} / 40</Text>
        </View>

        {/* Balance */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceChip}>
            <CoinIcon size={16} />
            <Text style={styles.balanceCoin}>{formatNum(balance)}</Text>
          </View>
          <View style={styles.balanceDivider} />
          <View style={styles.balanceChip}>
            <GemIcon size={14} />
            <Text style={styles.balanceGem}>{formatNum(gems)}</Text>
          </View>
          <View style={styles.balanceDivider} />
          <View style={styles.balanceChip}>
            <Image source={TOKEN_ICONS[ft]} style={styles.tokenIcon} contentFit="contain" />
            <Text style={[styles.balanceToken, { color }]}>{formatNum(tokenBal)}</Text>
          </View>
        </View>

        {/* Upgrade button with cost pill inside */}
        <Pressable
          onPress={handleUpgrade}
          style={({ pressed }) => [
            styles.upgradeBtn,
            { backgroundColor: color },
            isMaxed && styles.upgradeBtnDisabled,
            pressed && !isMaxed && styles.upgradeBtnPressed,
          ]}
        >
          <Text style={styles.upgradeBtnText}>
            {isMaxed ? tHotel('myBusiness.maxLevel') : tHotel('myBusiness.upgrade')}
          </Text>
          {!isMaxed && nextCost && (
            <View style={styles.costPill}>
              {nextCost.kind === 'gems' ? (
                <>
                  <GemIcon size={14} />
                  <Text style={styles.costGems}>{formatNum(nextCost.gems)}</Text>
                </>
              ) : (
                <>
                  <CoinIcon size={14} />
                  <Text style={styles.costCoins}>{formatNum(nextCost.coins)}</Text>
                  <Text style={styles.costSep}>+</Text>
                  <Image source={TOKEN_ICONS[ft]} style={styles.costTokenIcon} contentFit="contain" />
                  <Text style={[styles.costTokens, { color }]}>{nextCost.tokens}</Text>
                </>
              )}
            </View>
          )}
        </Pressable>
      </View>

      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.closeBtnText}>✕</Text>
      </Pressable>

      {/* Token insufficient modal */}
      <Modal visible={tokenModal !== null} transparent animationType="none" onRequestClose={() => setTokenModal(null)}>
        <Animated.View style={[modal.scrim, tokenScrimStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setTokenModal(null)} />
          <Animated.View style={[modal.card, tokenCardStyle]}>
            <LinearGradient colors={['#F0F4FA', '#E4EAF2']} style={modal.cardGradient}>

              <View style={modal.iconWrap}>
                <Image source={TOKEN_ICONS[ft]} style={modal.tokenImg} contentFit="contain" />
              </View>

              <Text style={modal.title}>{tHotel('myBusiness.notEnoughTokens')}</Text>

              {tokenModal && (
                <View style={modal.deficitCard}>
                  <View style={modal.deficitRow}>
                    <View style={modal.deficitCell}>
                      <Text style={modal.deficitLabel}>{tHotel('myBusiness.have')}</Text>
                      <View style={modal.deficitValueRow}>
                        <Image source={TOKEN_ICONS[ft]} style={modal.deficitIcon} contentFit="contain" />
                        <Text style={[modal.deficitValue, { color }]}>{formatNum(tokenModal.have)}</Text>
                      </View>
                    </View>
                    <Text style={modal.arrow}>→</Text>
                    <View style={modal.deficitCell}>
                      <Text style={modal.deficitLabel}>{tHotel('myBusiness.need')}</Text>
                      <View style={modal.deficitValueRow}>
                        <Image source={TOKEN_ICONS[ft]} style={modal.deficitIcon} contentFit="contain" />
                        <Text style={[modal.deficitValue, { color }]}>{formatNum(tokenModal.need)}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={modal.missingRow}>
                    <Text style={modal.missingLabel}>{tHotel('myBusiness.missing')}:</Text>
                    <View style={modal.deficitValueRow}>
                      <Image source={TOKEN_ICONS[ft]} style={modal.deficitIcon} contentFit="contain" />
                      <Text style={modal.missingValue}>{formatNum(tokenModal.need - tokenModal.have)}</Text>
                    </View>
                  </View>
                </View>
              )}

              <Pressable
                onPress={() => { setTokenModal(null); router.replace('/shop'); }}
                style={({ pressed }) => [modal.shopBtn, pressed && { opacity: 0.85 }]}
              >
                <LinearGradient colors={['#52A6E2', '#3B8BCB']} style={modal.shopBtnGradient}>
                  <Text style={modal.shopBtnText}>{tHotel('myBusiness.goToShop')}</Text>
                </LinearGradient>
                <View style={modal.shopBtnShadow} />
              </Pressable>

              <Pressable onPress={() => setTokenModal(null)} style={modal.closeBtn}>
                <Text style={modal.closeBtnText}>{tHotel('myBusiness.cancel')}</Text>
              </Pressable>

            </LinearGradient>
          </Animated.View>
        </Animated.View>
      </Modal>
      <InsufficientResourcesModal asOverlay />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', marginTop: 60, marginHorizontal: 20, gap: 12 },
  backBtn: { padding: 4 },
  backText: { fontSize: 28, fontFamily: 'Fredoka_600SemiBold', lineHeight: 32 },
  title: { fontFamily: 'Fredoka_700Bold', fontSize: 24 },

  card: {
    margin: 20, backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', gap: 10,
    shadowColor: 'rgba(60,80,45,1)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  levelText: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: '#7C8A6E', textTransform: 'uppercase', letterSpacing: 0.5 },
  bonusText: { fontFamily: 'Fredoka_700Bold', fontSize: 32 },
  progressBg: { width: '100%', height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressLabel: { fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: '#9BA3B0' },

  balanceCard: {
    marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 16, padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 0,
    shadowColor: 'rgba(60,80,45,1)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  balanceChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14 },
  balanceDivider: { width: 1, height: 18, backgroundColor: '#E8EDE4' },
  balanceCoin: { fontFamily: 'Fredoka_700Bold', fontSize: 16, color: '#C28A22' },
  balanceGem:  { fontFamily: 'Fredoka_700Bold', fontSize: 16, color: '#2592AB' },
  balanceToken:{ fontFamily: 'Fredoka_700Bold', fontSize: 16 },
  tokenIcon:   { width: 18, height: 18 },

  upgradeBtn: {
    marginHorizontal: 20, marginTop: 16, borderRadius: 18,
    paddingVertical: 16, paddingHorizontal: 20, alignItems: 'center', gap: 10,
  },
  upgradeBtnDisabled: { opacity: 0.45 },
  upgradeBtnPressed:  { opacity: 0.85 },
  upgradeBtnText: { fontFamily: 'Fredoka_700Bold', fontSize: 20, color: '#fff' },
  costPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  costCoins:     { fontFamily: 'Fredoka_700Bold', fontSize: 14, color: '#C28A22' },
  costGems:      { fontFamily: 'Fredoka_700Bold', fontSize: 14, color: '#2592AB' },
  costTokens:    { fontFamily: 'Fredoka_700Bold', fontSize: 14 },
  costSep:       { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: '#9BA3B0' },
  costTokenIcon: { width: 15, height: 15 },
  closeBtn: { position: 'absolute', bottom: 40, alignSelf: 'center', width: 56, height: 56, borderRadius: 28, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 20, color: '#fff', lineHeight: 22 },
});

const modal = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  card: {
    width: SCREEN_W * 0.82, borderRadius: 28, overflow: 'hidden',
    shadowColor: 'rgba(30,50,80,1)', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.28, shadowRadius: 30, elevation: 12,
  },
  cardGradient: { alignItems: 'center', paddingTop: 28, paddingBottom: 20, paddingHorizontal: 22, gap: 12 },
  iconWrap: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#EEF1F6',
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  tokenImg: { width: 44, height: 44 },
  title: { fontFamily: 'Fredoka_700Bold', fontSize: 22, color: '#2A3344', textAlign: 'center' },
  deficitCard: {
    width: '100%', backgroundColor: '#fff', borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 18, gap: 10,
    shadowColor: 'rgba(40,60,90,1)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 5, elevation: 2,
  },
  deficitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  deficitCell: { alignItems: 'center', gap: 4, flex: 1 },
  deficitLabel: { fontFamily: 'Fredoka_500Medium', fontSize: 12, color: '#9BA3B0' },
  deficitValueRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  deficitIcon: { width: 16, height: 16 },
  deficitValue: { fontFamily: 'Fredoka_700Bold', fontSize: 18 },
  arrow: { fontFamily: 'Fredoka_500Medium', fontSize: 18, color: '#C5CAD4', marginHorizontal: 4 },
  missingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#FEF3F2', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14,
  },
  missingLabel: { fontFamily: 'Fredoka_500Medium', fontSize: 13, color: '#D9534F' },
  missingValue: { fontFamily: 'Fredoka_700Bold', fontSize: 16, color: '#D9534F' },
  shopBtn: { width: '100%', borderRadius: 14, overflow: 'hidden', position: 'relative' },
  shopBtnGradient: { alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: 14, zIndex: 1 },
  shopBtnText: { fontFamily: 'Fredoka_700Bold', fontSize: 16, color: '#fff', textShadowColor: 'rgba(0,0,0,0.15)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
  shopBtnShadow: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: '#2E72A8', borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },
  closeBtn: { paddingVertical: 6 },
  closeBtnText: { fontFamily: 'Fredoka_500Medium', fontSize: 14, color: '#9BA3B0' },
});

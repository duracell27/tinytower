import React from 'react';
import { View, Text, Pressable, StyleSheet, ImageBackground } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../../src/stores/gameStore';
import { BUSINESS_UPGRADE_COSTS } from '../../shared/config/businessUpgradeCosts';
import { formatNum } from '../../src/utils/format';
import { CoinIcon, GemIcon } from '../../src/components/CurrencyIcons';

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
  const showTokenInsufficient     = useGameStore((s) => s.showTokenInsufficient);

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
        showTokenInsufficient({ floorType: ft, have: tokenBal, need: nextCost.tokens });
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


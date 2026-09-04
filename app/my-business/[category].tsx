import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useAppTheme } from '../../src/hooks/useAppTheme';
import { Image } from 'expo-image';
import AppBackground from '../../src/components/AppBackground';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../../src/stores/gameStore';
import { BUSINESS_UPGRADE_COSTS } from '../../shared/config/businessUpgradeCosts';
import { gameConfig } from '../../shared/config/gameConfig';
import { getBuiltFloorCountForType } from '../../shared/engine/workerUtils';
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

const TYPE_HERO_GRADIENTS: Record<FloorType, [string, string]> = {
  green:  ['#3FA535', '#2C7A25'],
  blue:   ['#3376E5', '#1E5AC0'],
  yellow: ['#E5A72E', '#C88820'],
  purple: ['#9A6FD0', '#7448B0'],
  red:    ['#E05A4A', '#C03830'],
};

const TYPE_DARK_GRADIENTS: Record<FloorType, [string, string]> = {
  green:  ['#2E7228', '#235A1E'],
  blue:   ['#2260C0', '#1A4CA0'],
  yellow: ['#9A6A14', '#7A5210'],
  purple: ['#623CA8', '#4E2C8C'],
  red:    ['#B03838', '#8E2828'],
};

const TOKEN_ICONS: Record<FloorType, ReturnType<typeof require>> = {
  green:  require('../../assets/img/tokens/tokenGreen.png'),
  blue:   require('../../assets/img/tokens/tokenBlue.png'),
  yellow: require('../../assets/img/tokens/tokenYellow.png'),
  purple: require('../../assets/img/tokens/tokenViolet.png'),
  red:    require('../../assets/img/tokens/tokenRed.png'),
};

const TYPE_ICONS: Record<FloorType, ReturnType<typeof require>> = {
  green:  require('../../assets/img/flourTypes/products.png'),
  blue:   require('../../assets/img/flourTypes/service.png'),
  yellow: require('../../assets/img/flourTypes/rest.png'),
  purple: require('../../assets/img/flourTypes/fashion.png'),
  red:    require('../../assets/img/flourTypes/electronics.png'),
};

const MILESTONES = [0, 10, 20, 30, 40] as const;

export default function BusinessCategoryScreen() {
  const { t: tHotel } = useTranslation('hotel');
  const { category } = useLocalSearchParams<{ category: string }>();
  const ft = VALID_TYPES.has(category ?? '') ? (category as FloorType) : 'green';

  const balance          = useGameStore((s) => s.balance);
  const gems             = useGameStore((s) => s.gems);
  const tokens           = useGameStore((s) => s.tokens);
  const floors           = useGameStore((s) => s.floors);
  const openedFloorTypes = useGameStore((s) => s.openedFloorTypes);
  const businessUpgrades = useGameStore((s) => s.businessUpgrades);
  const upgradeBusinessCategory  = useGameStore((s) => s.upgradeBusinessCategory);
  const showInsufficientResources = useGameStore((s) => s.showInsufficientResources);
  const showTokenInsufficient     = useGameStore((s) => s.showTokenInsufficient);

  const theme = useAppTheme();
  const { isDark } = theme;
  const btnGradColors = isDark ? TYPE_DARK_GRADIENTS[ft] : TYPE_HERO_GRADIENTS[ft];
  const level    = businessUpgrades?.[ft] ?? 0;
  const tokenBal = tokens?.[ft] ?? 0;
  const color    = TYPE_COLORS[ft];
  const isMaxed  = level >= 40;
  const nextCost = !isMaxed ? BUSINESS_UPGRADE_COSTS[level] : null;
  const builtCount = getBuiltFloorCountForType(ft, floors, openedFloorTypes, gameConfig);
  const businesses = gameConfig.floorTypes[ft]?.businesses ?? [];

  const builtBusinessNames = React.useMemo(() => {
    const names = new Set<string>();
    for (const floor of floors) {
      const floorType =
        gameConfig.floors.find((f) => f.id === floor.id)?.floorType ??
        openedFloorTypes?.[String(floor.id)];
      if (floorType !== ft) continue;
      const typeId = floor.productions?.[0]?.typeId;
      if (!typeId) continue;
      const biz = businesses.find((b) => b.dreamJobs.includes(typeId));
      if (biz) names.add(biz.name);
    }
    return names;
  }, [floors, openedFloorTypes, ft, businesses]);

  function handleUpgrade() {
    if (isMaxed) return;
    if (!nextCost) return;
    if (nextCost.kind === 'gems') {
      if (gems < nextCost.gems) { showInsufficientResources({ currency: 'gems', need: nextCost.gems, have: gems }); return; }
    } else {
      if (balance < nextCost.coins) { showInsufficientResources({ currency: 'coins', need: nextCost.coins, have: balance }); return; }
      if (tokenBal < nextCost.tokens) { showTokenInsufficient({ floorType: ft, have: tokenBal, need: nextCost.tokens }); return; }
    }
    upgradeBusinessCategory(ft);
  }

  return (
    <AppBackground style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Header ── */}
        <Text style={[styles.categoryName, { color }]}>
          {tHotel(`myBusiness.categories.${ft}`)}
        </Text>

        {/* ── Icon left / stats right ── */}
        <View style={styles.heroRow}>
          <View style={[styles.iconRing, { backgroundColor: `${color}20`, borderColor: `${color}40` }]}>
            <Image source={TYPE_ICONS[ft]} style={styles.icon} contentFit="contain" />
          </View>
          <View style={styles.heroStats}>
            <Text style={[styles.bonusText, { color }]}>
              {isMaxed ? tHotel('myBusiness.maxLevel') : tHotel('myBusiness.profitBonus', { percent: level * 5 })}
            </Text>
            <View style={[styles.builtChip, { backgroundColor: `${color}18` }]}>
              <Image source={TYPE_ICONS[ft]} style={styles.builtIcon} contentFit="contain" />
              <Text style={[styles.builtText, { color }]}>
                {builtCount} {builtCount === 1 ? 'floor' : 'floors'} built
              </Text>
            </View>
          </View>
        </View>

        {/* ── Progress with milestone markers ── */}
        <View style={[styles.progressCard, { backgroundColor: theme.surface }]}>
          <View style={styles.progressTrackWrap}>
            <View style={[styles.progressBg, { backgroundColor: `${color}22` }]}>
              <View
                style={[styles.progressFill, {
                  width: `${(level / 40) * 100}%`,
                  backgroundColor: color,
                }]}
              />
              {[10, 20, 30].map((m) => (
                <View
                  key={m}
                  style={[styles.milestoneTick, {
                    left: `${(m / 40) * 100}%`,
                    backgroundColor: isDark ? theme.surface : '#fff',
                  }]}
                />
              ))}
            </View>
          </View>
          <View style={styles.milestoneRow}>
            {MILESTONES.map((m) => (
              <Text
                key={m}
                style={[
                  styles.milestoneLabel,
                  { color: m <= level ? color : theme.textMuted },
                  m <= level && styles.milestoneLabelActive,
                ]}
              >
                {m === 40 ? 'MAX' : m}
              </Text>
            ))}
          </View>
        </View>

        {/* ── Balance ── */}
        <View style={[styles.balanceCard, { backgroundColor: theme.surface }]}>
          <View style={styles.balanceChip}>
            <CoinIcon size={16} />
            <Text style={styles.balanceCoin}>{formatNum(balance)}</Text>
          </View>
          <View style={[styles.balanceDivider, { backgroundColor: theme.divider }]} />
          <View style={styles.balanceChip}>
            <GemIcon size={14} />
            <Text style={styles.balanceGem}>{formatNum(gems)}</Text>
          </View>
          <View style={[styles.balanceDivider, { backgroundColor: theme.divider }]} />
          <View style={styles.balanceChip}>
            <Image source={TOKEN_ICONS[ft]} style={styles.tokenIcon} contentFit="contain" />
            <Text style={[styles.balanceToken, { color }]}>{formatNum(tokenBal)}</Text>
          </View>
        </View>

        {/* ── Businesses list ── */}
        <View style={[styles.businessesCard, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
            {tHotel('myBusiness.businesses', { defaultValue: 'Businesses' })}
          </Text>
          <View style={styles.bizGrid}>
            {businesses.map((biz) => {
              const built = builtBusinessNames.has(biz.name);
              return (
                <View
                  key={biz.name}
                  style={[
                    styles.bizChip,
                    built
                      ? { backgroundColor: isDark ? `${color}30` : `${color}18`, borderColor: `${color}60` }
                      : { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' },
                  ]}
                >
                  <Text style={[styles.bizChipText, { color: built ? color : theme.textMuted }]}>
                    {biz.name}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Upgrade button ── */}
        <Pressable
          onPress={handleUpgrade}
          style={({ pressed }) => [
            styles.upgradeBtn,
            isMaxed && styles.upgradeBtnDisabled,
            pressed && !isMaxed && styles.upgradeBtnPressed,
          ]}
        >
          <LinearGradient colors={btnGradColors} style={styles.upgradeBtnGradient}>
            <Text style={styles.upgradeBtnText}>
              {isMaxed ? tHotel('myBusiness.maxLevel') : tHotel('myBusiness.upgrade')}
            </Text>
            {!isMaxed && nextCost && (
              <View style={[styles.costPill, isDark && { backgroundColor: 'rgba(0,0,0,0.35)' }]}>
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
          </LinearGradient>
        </Pressable>

      </ScrollView>

      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.closeBtnText}>✕</Text>
      </Pressable>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingTop: 60, paddingBottom: 120 },

  /* Header */
  categoryName: {
    fontFamily: 'Fredoka_700Bold', fontSize: 26,
    marginHorizontal: 20, marginBottom: 10,
  },

  /* Hero row */
  heroRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 20, gap: 16, marginBottom: 4,
  },
  iconRing: {
    width: 90, height: 90, borderRadius: 45,
    borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  icon: { width: 58, height: 58 },
  heroStats: { flex: 1, gap: 8 },
  bonusText: { fontFamily: 'Fredoka_700Bold', fontSize: 24, lineHeight: 26 },
  builtChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  builtIcon: { width: 14, height: 14 },
  builtText: { fontFamily: 'Nunito_700Bold', fontSize: 12 },

  /* Progress */
  progressCard: {
    marginHorizontal: 20, marginTop: 18, borderRadius: 16,
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12, gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  progressTrackWrap: {},
  progressBg: { height: 12, borderRadius: 6, overflow: 'hidden', position: 'relative' },
  progressFill: { height: '100%', borderRadius: 6 },
  milestoneTick: {
    position: 'absolute', top: 2, bottom: 2,
    width: 2, borderRadius: 1,
    transform: [{ translateX: -1 }],
  },
  milestoneRow: { flexDirection: 'row', justifyContent: 'space-between' },
  milestoneLabel: { fontFamily: 'Nunito_600SemiBold', fontSize: 11 },
  milestoneLabelActive: { fontFamily: 'Nunito_700Bold' },

  /* Balance */
  balanceCard: {
    marginHorizontal: 20, marginTop: 12, borderRadius: 16, padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  balanceChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14 },
  balanceDivider: { width: 1, height: 18 },
  balanceCoin:  { fontFamily: 'Fredoka_700Bold', fontSize: 16, color: '#C28A22' },
  balanceGem:   { fontFamily: 'Fredoka_700Bold', fontSize: 16, color: '#2592AB' },
  balanceToken: { fontFamily: 'Fredoka_700Bold', fontSize: 16 },
  tokenIcon:    { width: 18, height: 18 },

  /* Businesses */
  businessesCard: {
    marginHorizontal: 20, marginTop: 12, borderRadius: 16,
    padding: 16, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  sectionTitle: {
    fontFamily: 'Nunito_600SemiBold', fontSize: 11,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  bizGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bizChip: {
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  bizChipText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 13 },

  /* Upgrade button */
  upgradeBtn: { marginHorizontal: 20, marginTop: 16, borderRadius: 18, overflow: 'hidden' },
  upgradeBtnGradient: { paddingVertical: 16, paddingHorizontal: 20, alignItems: 'center', gap: 10 },
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

  /* Close */
  closeBtn: {
    position: 'absolute', bottom: 40, alignSelf: 'center',
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 20, color: '#fff', lineHeight: 22 },
});

import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ImageBackground } from 'react-native';
import { BlurView } from 'expo-blur';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../../src/stores/gameStore';
import { gameConfig } from '../../shared/config/gameConfig';
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

export default function BusinessCategoryScreen() {
  const { t: tHotel } = useTranslation('hotel');
  const { category } = useLocalSearchParams<{ category: string }>();
  const ft = VALID_TYPES.has(category ?? '') ? (category as FloorType) : 'green';

  const balance          = useGameStore((s) => s.balance);
  const gems             = useGameStore((s) => s.gems);
  const tokens           = useGameStore((s) => s.tokens);
  const businessUpgrades = useGameStore((s) => s.businessUpgrades);
  const floors           = useGameStore((s) => s.floors);
  const openedFloorTypes = useGameStore((s) => s.openedFloorTypes);
  const upgradeBusinessCategory = useGameStore((s) => s.upgradeBusinessCategory);

  const level     = businessUpgrades?.[ft] ?? 0;
  const tokenBal  = tokens?.[ft] ?? 0;
  const color     = TYPE_COLORS[ft];
  const isMaxed   = level >= 40;
  const nextCost  = !isMaxed ? BUSINESS_UPGRADE_COSTS[level] : null;

  const canAfford = !isMaxed && nextCost != null && (
    nextCost.kind === 'gems'
      ? gems >= nextCost.gems
      : balance >= nextCost.coins && tokenBal >= nextCost.tokens
  );

  function builtFloorsOfType(): { id: number; name: string }[] {
    const result: { id: number; name: string }[] = [];
    for (const floor of gameConfig.floors) {
      if (floor.floorType === ft && floors.some((f) => f.id === floor.id)) {
        const businesses = gameConfig.floorTypes[ft]?.businesses ?? [];
        const tier = gameConfig.floors
          .filter((f) => f.floorType === ft && floors.some((sf) => sf.id === f.id))
          .indexOf(floor);
        result.push({ id: floor.id, name: businesses[tier]?.name ?? `Floor ${floor.id}` });
      }
    }
    for (const [idStr, type] of Object.entries(openedFloorTypes)) {
      if (type === ft) {
        const id = Number(idStr);
        const tier = Object.entries(openedFloorTypes).filter(([, t]) => t === ft).map(([k]) => Number(k)).sort((a, b) => a - b).indexOf(id);
        const businesses = gameConfig.floorTypes[ft]?.businesses ?? [];
        result.push({ id, name: businesses[tier]?.name ?? `Floor ${id}` });
      }
    }
    return result;
  }

  const builtFloors = builtFloorsOfType();

  function renderCost() {
    if (!nextCost) return null;
    if (nextCost.kind === 'gems') {
      return (
        <View style={styles.costRow}>
          <GemIcon size={16} />
          <Text style={[styles.costText, !canAfford && styles.costInsufficient]}>
            {formatNum(nextCost.gems)} {tHotel('myBusiness.costGems', { gems: '' }).trim()}
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.costRow}>
        <CoinIcon size={16} />
        <Text style={[styles.costText, balance < nextCost.coins && styles.costInsufficient]}>
          {formatNum(nextCost.coins)}
        </Text>
        <Text style={styles.costSep}>+</Text>
        <Text style={[styles.costText, tokenBal < nextCost.tokens && styles.costInsufficient]}>
          {nextCost.tokens} {tHotel(`myBusiness.tokenLabels.${ft}`)}
        </Text>
      </View>
    );
  }

  return (
    <ImageBackground
      source={require('../../assets/img/backgroung/bg15.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>{'‹'}</Text>
          </Pressable>
          <Text style={[styles.title, { color }]}>{tHotel(`myBusiness.categories.${ft}`)}</Text>
        </View>

        {/* Level + progress */}
        <View style={styles.card}>
          <Text style={styles.levelText}>{tHotel('myBusiness.level', { level })}</Text>
          <Text style={[styles.bonusText, { color }]}>
            {isMaxed ? tHotel('myBusiness.maxLevel') : tHotel('myBusiness.profitBonus', { percent: level * 5 })}
          </Text>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${(level / 40) * 100}%`, backgroundColor: color }]} />
          </View>
          <Text style={styles.progressLabel}>{level} / 40</Text>
        </View>

        {/* Balance */}
        <View style={styles.balanceCard}>
          <CoinIcon size={16} />
          <Text style={styles.balanceCoin}>{formatNum(balance)}</Text>
          <GemIcon size={14} />
          <Text style={styles.balanceGem}>{formatNum(gems)}</Text>
          <Text style={styles.balanceToken}>
            {tHotel(`myBusiness.tokenLabels.${ft}`)}: {formatNum(tokenBal)}
          </Text>
        </View>

        {/* Upgrade button */}
        <View style={styles.upgradeSection}>
          {renderCost()}
          <Pressable
            onPress={() => !isMaxed && canAfford && upgradeBusinessCategory(ft)}
            style={({ pressed }) => [
              styles.upgradeBtn,
              { backgroundColor: color },
              (!canAfford || isMaxed) && styles.upgradeBtnDisabled,
              pressed && canAfford && !isMaxed && styles.upgradeBtnPressed,
            ]}
            disabled={isMaxed || !canAfford}
          >
            <Text style={styles.upgradeBtnText}>
              {isMaxed ? tHotel('myBusiness.maxLevel') : tHotel('myBusiness.upgrade')}
            </Text>
          </Pressable>
        </View>

        {/* Floor list */}
        {builtFloors.length > 0 && (
          <View style={styles.floorSection}>
            <Text style={styles.floorSectionTitle}>
              {tHotel('myBusiness.floorCount', { count: builtFloors.length })}
            </Text>
            {builtFloors.map(({ id, name }) => (
              <View key={id} style={styles.floorRow}>
                <View style={[styles.floorDot, { backgroundColor: color }]} />
                <Text style={styles.floorName}>{name}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', marginTop: 60, marginHorizontal: 20, gap: 12 },
  backBtn: { padding: 4 },
  backText: { fontSize: 28, color: '#27331F', fontFamily: 'Fredoka_600SemiBold', lineHeight: 32 },
  title: { fontFamily: 'Fredoka_700Bold', fontSize: 24 },
  card: {
    margin: 20, backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', gap: 10,
    shadowColor: 'rgba(60,80,45,1)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  levelText: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: '#7C8A6E', textTransform: 'uppercase', letterSpacing: 0.5 },
  bonusText: { fontFamily: 'Fredoka_700Bold', fontSize: 32 },
  progressBg: { width: '100%', height: 8, borderRadius: 4, backgroundColor: 'rgba(60,120,40,0.12)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressLabel: { fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: '#9BA3B0' },
  balanceCard: {
    marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 16, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    shadowColor: 'rgba(60,80,45,1)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  balanceCoin: { fontFamily: 'Fredoka_600SemiBold', fontSize: 15, color: '#C28A22', marginRight: 6 },
  balanceGem:  { fontFamily: 'Fredoka_600SemiBold', fontSize: 15, color: '#2592AB', marginRight: 6 },
  balanceToken:{ fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: '#7C8A6E', flex: 1, textAlign: 'right' },
  upgradeSection: { marginHorizontal: 20, marginTop: 16, gap: 10 },
  costRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  costText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 16, color: '#27331F' },
  costInsufficient: { color: '#C0372A' },
  costSep: { fontFamily: 'Nunito_600SemiBold', fontSize: 14, color: '#7C8A6E' },
  upgradeBtn: { borderRadius: 16, padding: 16, alignItems: 'center' },
  upgradeBtnDisabled: { opacity: 0.4 },
  upgradeBtnPressed: { opacity: 0.85 },
  upgradeBtnText: { fontFamily: 'Fredoka_700Bold', fontSize: 18, color: '#fff' },
  floorSection: { marginHorizontal: 20, marginTop: 20, gap: 8 },
  floorSectionTitle: { fontFamily: 'Nunito_600SemiBold', fontSize: 11, color: '#9BA3B0', textTransform: 'uppercase', letterSpacing: 0.5 },
  floorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F0EDE5' },
  floorDot: { width: 8, height: 8, borderRadius: 4 },
  floorName: { fontFamily: 'Nunito_600SemiBold', fontSize: 15, color: '#27331F' },
});

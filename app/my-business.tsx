import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ImageBackground } from 'react-native';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../src/stores/gameStore';
import { gameConfig } from '../shared/config/gameConfig';
import { BUSINESS_UPGRADE_COSTS } from '../shared/config/businessUpgradeCosts';
import { formatNum } from '../src/utils/format';
import { CoinIcon, GemIcon } from '../src/components/CurrencyIcons';

const FLOOR_TYPES = ['green', 'blue', 'yellow', 'purple', 'red'] as const;
type FloorType = typeof FLOOR_TYPES[number];

const TYPE_COLORS: Record<FloorType, string> = {
  green:  '#3FA535',
  blue:   '#3376E5',
  yellow: '#E5A72E',
  purple: '#9A6FD0',
  red:    '#E05A4A',
};

export default function MyBusinessScreen() {
  const { t: tHotel } = useTranslation('hotel');
  const balance       = useGameStore((s) => s.balance);
  const gems          = useGameStore((s) => s.gems);
  const tokens        = useGameStore((s) => s.tokens);
  const businessUpgrades = useGameStore((s) => s.businessUpgrades);
  const floors        = useGameStore((s) => s.floors);
  const openedFloorTypes = useGameStore((s) => s.openedFloorTypes);

  function floorCountForType(ft: FloorType): number {
    const staticCount = gameConfig.floors.filter((f) => f.floorType === ft && floors.some((sf) => sf.id === f.id)).length;
    const dynamicCount = Object.entries(openedFloorTypes).filter(([, t]) => t === ft).length;
    return staticCount + dynamicCount;
  }

  return (
    <ImageBackground
      source={require('../assets/img/backgroung/bg15.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>{'‹'}</Text>
          </Pressable>
          <Text style={styles.title}>{tHotel('myBusiness.title')}</Text>
        </View>

        <Text style={styles.subtitle}>{tHotel('myBusiness.subtitle')}</Text>

        <View style={styles.balanceRow}>
          <CoinIcon size={16} />
          <Text style={styles.balanceText}>{formatNum(balance)}</Text>
          <GemIcon size={14} />
          <Text style={styles.balanceTextGem}>{formatNum(gems)}</Text>
        </View>

        {FLOOR_TYPES.map((ft) => {
          const level = businessUpgrades?.[ft] ?? 0;
          const tokenBal = tokens?.[ft] ?? 0;
          const count = floorCountForType(ft);
          const nextCost = level < 40 ? BUSINESS_UPGRADE_COSTS[level] : null;
          const color = TYPE_COLORS[ft];

          return (
            <Pressable
              key={ft}
              onPress={() => router.push(`/my-business/${ft}`)}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            >
              <View style={[styles.colorBar, { backgroundColor: color }]} />
              <View style={styles.cardContent}>
                <View style={styles.cardRow}>
                  <Text style={styles.categoryName}>{tHotel(`myBusiness.categories.${ft}`)}</Text>
                  <Text style={[styles.bonus, { color }]}>
                    {level >= 40 ? tHotel('myBusiness.maxLevel') : tHotel('myBusiness.profitBonus', { percent: level * 5 })}
                  </Text>
                </View>

                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${(level / 40) * 100}%`, backgroundColor: color }]} />
                </View>

                <View style={styles.cardRow}>
                  <Text style={styles.meta}>{tHotel('myBusiness.floorCount', { count })}</Text>
                  <Text style={styles.meta}>{tHotel('myBusiness.tokenBalance', { count: tokenBal })} {tHotel(`myBusiness.tokenLabels.${ft}`)}</Text>
                </View>
              </View>
            </Pressable>
          );
        })}
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
  title: { fontFamily: 'Fredoka_700Bold', fontSize: 24, color: '#27331F' },
  subtitle: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: '#7C8A6E', marginHorizontal: 20, marginTop: 6 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 20, marginTop: 12 },
  balanceText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 15, color: '#C28A22', marginRight: 8 },
  balanceTextGem: { fontFamily: 'Fredoka_600SemiBold', fontSize: 15, color: '#2592AB' },
  card: {
    marginHorizontal: 20, marginTop: 12, backgroundColor: '#fff', borderRadius: 18,
    flexDirection: 'row', overflow: 'hidden',
    shadowColor: 'rgba(60,80,45,1)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  cardPressed: { opacity: 0.8 },
  colorBar: { width: 6 },
  cardContent: { flex: 1, padding: 16, gap: 10 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  categoryName: { fontFamily: 'Fredoka_600SemiBold', fontSize: 18, color: '#27331F' },
  bonus: { fontFamily: 'Fredoka_600SemiBold', fontSize: 16 },
  progressBarBg: { height: 6, borderRadius: 3, backgroundColor: 'rgba(60,120,40,0.12)', overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },
  meta: { fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: '#7C8A6E' },
});

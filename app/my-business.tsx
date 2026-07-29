import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ImageBackground } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../src/stores/gameStore';
import { gameConfig } from '../shared/config/gameConfig';
import { getBuiltFloorCountForType } from '../shared/engine/workerUtils';
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

const TYPE_ICONS: Record<FloorType, ReturnType<typeof require>> = {
  green:  require('../assets/img/flourTypes/products.png'),
  blue:   require('../assets/img/flourTypes/service.png'),
  yellow: require('../assets/img/flourTypes/rest.png'),
  purple: require('../assets/img/flourTypes/fashion.png'),
  red:    require('../assets/img/flourTypes/electronics.png'),
};

const TOKEN_ICONS: Record<FloorType, ReturnType<typeof require>> = {
  green:  require('../assets/img/tokens/tokenGreen.png'),
  blue:   require('../assets/img/tokens/tokenBlue.png'),
  yellow: require('../assets/img/tokens/tokenYellow.png'),
  purple: require('../assets/img/tokens/tokenViolet.png'),
  red:    require('../assets/img/tokens/tokenRed.png'),
};

export default function MyBusinessScreen() {
  const { t: tHotel } = useTranslation('hotel');
  const balance          = useGameStore((s) => s.balance);
  const gems             = useGameStore((s) => s.gems);
  const tokens           = useGameStore((s) => s.tokens);
  const businessUpgrades = useGameStore((s) => s.businessUpgrades);
  const floors           = useGameStore((s) => s.floors);
  const openedFloorTypes = useGameStore((s) => s.openedFloorTypes);

  return (
    <ImageBackground
      source={require('../assets/img/backgroung/bg15.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <Text style={styles.title}>{tHotel('myBusiness.title')}</Text>
        </View>

        <Text style={styles.subtitle}>{tHotel('myBusiness.subtitle')}</Text>

        {/* Currency + token balances */}
        <View style={styles.balanceCard}>
          <View style={styles.currencyRow}>
            <View style={styles.currencyChip}>
              <CoinIcon size={16} />
              <Text style={styles.currencyCoins}>{formatNum(balance)}</Text>
            </View>
            <View style={styles.currencyChip}>
              <GemIcon size={14} />
              <Text style={styles.currencyGems}>{formatNum(gems)}</Text>
            </View>
          </View>
          <View style={styles.tokenRow}>
            {FLOOR_TYPES.map((ft) => (
              <View key={ft} style={styles.tokenChip}>
                <Image source={TOKEN_ICONS[ft]} style={styles.tokenIcon} contentFit="contain" />
                <Text style={[styles.tokenCount, { color: TYPE_COLORS[ft] }]}>{tokens?.[ft] ?? 0}</Text>
              </View>
            ))}
          </View>
        </View>

        {FLOOR_TYPES.map((ft) => {
          const level = businessUpgrades?.[ft] ?? 0;
          const count = getBuiltFloorCountForType(ft, floors, openedFloorTypes, gameConfig);
          const color = TYPE_COLORS[ft];
          const barBgColor = `${color}26`;

          return (
            <Pressable
              key={ft}
              onPress={() => router.push(`/my-business/${ft}`)}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            >
              <Image source={TYPE_ICONS[ft]} style={styles.categoryIcon} contentFit="contain" />
              <View style={styles.cardContent}>
                <View style={styles.cardRow}>
                  <Text style={styles.categoryName}>{tHotel(`myBusiness.categories.${ft}`)}</Text>
                  <Text style={[styles.bonus, { color }]}>
                    {level >= 40 ? tHotel('myBusiness.maxLevel') : tHotel('myBusiness.profitBonus', { percent: level * 5 })}
                  </Text>
                </View>

                <View style={[styles.progressBarBg, { backgroundColor: barBgColor }]}>
                  <View style={[styles.progressBarFill, { width: `${(level / 40) * 100}%`, backgroundColor: color }]} />
                </View>

                <Text style={styles.meta}>{tHotel('myBusiness.floorCount', { count })}</Text>
              </View>
              <View style={[styles.colorBar, { backgroundColor: color }]} />
            </Pressable>
          );
        })}
      </ScrollView>

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
  backText: { fontSize: 28, color: '#27331F', fontFamily: 'Fredoka_600SemiBold', lineHeight: 32 },
  title: { fontFamily: 'Fredoka_700Bold', fontSize: 24, color: '#27331F' },
  subtitle: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: '#7C8A6E', marginHorizontal: 20, marginTop: 6 },

  balanceCard: {
    marginHorizontal: 20, marginTop: 14, backgroundColor: '#fff', borderRadius: 18,
    paddingVertical: 14, paddingHorizontal: 16, gap: 10, alignItems: 'center',
    shadowColor: 'rgba(60,80,45,1)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  currencyRow: { flexDirection: 'row', gap: 14, justifyContent: 'center' },
  currencyChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  currencyCoins: { fontFamily: 'Fredoka_700Bold', fontSize: 16, color: '#C28A22' },
  currencyGems:  { fontFamily: 'Fredoka_700Bold', fontSize: 16, color: '#2592AB' },

  tokenRow: { flexDirection: 'row', gap: 10, justifyContent: 'center', flexWrap: 'wrap' },
  tokenChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tokenIcon: { width: 17, height: 17 },
  tokenCount: { fontFamily: 'Fredoka_700Bold', fontSize: 14 },

  card: {
    marginHorizontal: 20, marginTop: 12, backgroundColor: '#fff', borderRadius: 18,
    flexDirection: 'row', overflow: 'hidden',
    shadowColor: 'rgba(60,80,45,1)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  cardPressed: { opacity: 0.8 },
  colorBar: { width: 6 },
  cardContent: { flex: 1, padding: 16, gap: 10 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  categoryIcon: { width: 56, height: 56, marginLeft: 12, marginRight: 0, alignSelf: 'center' },
  categoryName: { fontFamily: 'Fredoka_600SemiBold', fontSize: 18, color: '#27331F' },
  bonus: { fontFamily: 'Fredoka_600SemiBold', fontSize: 16 },
  progressBarBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },
  meta: { fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: '#7C8A6E', textAlign: 'center' },
  closeBtn: { position: 'absolute', bottom: 40, alignSelf: 'center', width: 56, height: 56, borderRadius: 28, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 20, color: '#fff', lineHeight: 22 },
});

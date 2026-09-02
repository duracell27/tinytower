import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useLocalSearchParams, router } from 'expo-router';
import AppBackground from '../../src/components/AppBackground';
import { useAppTheme } from '../../src/hooks/useAppTheme';
import { useGameStore } from '../../src/stores/gameStore';
import { GemIcon } from '../../src/components/CurrencyIcons';
import { formatNum } from '../../src/utils/format';
import { VEHICLE_CONFIG } from '../../shared/config/vehicleConfig';
import type { VehicleType } from '../../shared/config/vehicleConfig';

const VEHICLE_ICONS: Record<VehicleType, ReturnType<typeof require>> = {
  taxi: require('../../assets/img/TaxiIcon.png'),
  forklift: require('../../assets/img/ForkliftIcon.png'),
  armored_truck: require('../../assets/img/ArmoredtruckIcon.png'),
  delivery_truck: require('../../assets/img/DeliverytruckIcon.png'),
  bus: require('../../assets/img/BusIcon.png'),
};

// Icons for each bonus slot [bonus1, bonus2]
const BONUS_ICONS: Record<VehicleType, [ReturnType<typeof require>, ReturnType<typeof require>]> = {
  taxi:          [require('../../assets/img/diamond.png'),  require('../../assets/img/xpIcon.png')],
  forklift:      [require('../../assets/img/speedUp.png'),  require('../../assets/img/xpIcon.png')],
  armored_truck: [require('../../assets/img/coin.png'),     require('../../assets/img/xpIcon.png')],
  delivery_truck:[require('../../assets/img/speedUp.png'),  require('../../assets/img/xpIcon.png')],
  bus:           [require('../../assets/img/BusIcon.png'),  require('../../assets/img/coin.png')],
};

const VALID_VEHICLE_KEYS: VehicleType[] = ['taxi', 'forklift', 'armored_truck', 'delivery_truck', 'bus'];

const TOKEN_ICONS: Record<string, ReturnType<typeof require>> = {
  gem:     require('../../assets/img/diamond.png'),
  xp:      require('../../assets/img/xpIcon.png'),
  coin:    require('../../assets/img/coin.png'),
  speed:   require('../../assets/img/speedUp.png'),
  visitor: require('../../assets/img/BusIcon.png'),
};

function renderDesc(text: string): React.ReactNode {
  const parts = text.split(/(\{[a-z]+\})/g);
  return parts.map((part, i) => {
    const token = part.match(/^\{([a-z]+)\}$/)?.[1];
    if (token && TOKEN_ICONS[token]) {
      return (
        <Image
          key={i}
          source={TOKEN_ICONS[token]}
          style={{ width: 14, height: 14 }}
          contentFit="contain"
        />
      );
    }
    return <Text key={i}>{part}</Text>;
  });
}

export default function VehicleDetailScreen() {
  const { vehicle } = useLocalSearchParams<{ vehicle: string }>();
  const theme = useAppTheme();
  const vehicles = useGameStore((s) => s.vehicles);
  const gems = useGameStore((s) => s.gems);
  const buyVehicle = useGameStore((s) => s.buyVehicle);
  const showInsufficientResources = useGameStore((s) => s.showInsufficientResources);
  const [feedback, setFeedback] = useState<'success' | 'error' | null>(null);

  const key = VALID_VEHICLE_KEYS.includes(vehicle as VehicleType) ? (vehicle as VehicleType) : null;
  if (!key) return null;

  const def = VEHICLE_CONFIG[key];
  const count = vehicles[key] ?? 0;
  const isMaxed = count >= 10;
  const canAfford = gems >= def.gemCost;

  const handleBuy = () => {
    if (isMaxed) return;
    if (!canAfford) {
      showInsufficientResources({ currency: 'gems', need: def.gemCost, have: gems });
      return;
    }
    buyVehicle(key);
    setFeedback('success');
    setTimeout(() => setFeedback(null), 1500);
  };

  const [icon1, icon2] = BONUS_ICONS[key];

  return (
    <AppBackground style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={[styles.heroCard, { backgroundColor: theme.surface }]}>
          <LinearGradient
            colors={theme.isDark ? ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0)'] : [`${def.accentColor}14`, `${def.accentColor}04`]}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.iconCircle, { backgroundColor: `${def.accentColor}20` }]}>
            <Image source={VEHICLE_ICONS[key]} style={styles.heroIcon} contentFit="contain" />
          </View>
          <Text style={[styles.heroName, { color: theme.text }]}>{def.name}</Text>

          {/* Dot progress */}
          <View style={styles.dotRow}>
            {Array.from({ length: 10 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: i < count ? def.accentColor : `${def.accentColor}28` },
                ]}
              />
            ))}
          </View>
          <Text style={[styles.dotCount, { color: theme.textMuted }]}>{count} / 10 owned</Text>
        </View>

        {/* Bonus cards */}
        <View style={styles.bonusGrid}>
          {([0, 1] as const).map((idx) => (
            <View key={idx} style={[styles.bonusCard, { backgroundColor: theme.surface }]}>
              <Image source={idx === 0 ? icon1 : icon2} style={styles.bonusIcon} contentFit="contain" />
              <Text style={[styles.bonusValue, { color: def.accentColor }]}>
                {idx === 0 ? def.bonus1Label(count) : def.bonus2Label(count)}
              </Text>
            </View>
          ))}
        </View>

        {/* Description */}
        <View style={[styles.descCard, { backgroundColor: theme.surface, borderLeftColor: def.accentColor }]}>
          <Text style={[styles.descLabel, { color: def.accentColor }]}>About</Text>
          <Text style={[styles.descText, { color: theme.text }]}>
            {renderDesc(def.description)}
          </Text>
        </View>

        {/* Buy button */}
        <View style={styles.buyWrap}>
          {feedback === 'success' && (
            <Text style={[styles.feedbackText, { color: '#22C55E' }]}>Purchased!</Text>
          )}
          {isMaxed ? (
            <View style={[styles.buyBtn, { backgroundColor: theme.surfaceSub }]}>
              <Text style={[styles.buyBtnText, { color: theme.textMuted }]}>Maxed out</Text>
            </View>
          ) : (
            <Pressable
              onPress={handleBuy}
              style={({ pressed }) => [styles.buyBtn, { backgroundColor: def.accentColor, opacity: pressed ? 0.82 : 1 }]}
            >
              <View style={styles.buyBtnRow}>
                <Text style={styles.buyBtnText}>Buy for </Text>
                <GemIcon size={18} />
                <Text style={styles.buyBtnText}> {formatNum(def.gemCost)}</Text>
              </View>
            </Pressable>
          )}
        </View>

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
  scroll: { paddingBottom: 120 },

  heroCard: {
    marginHorizontal: 20, marginTop: 60,
    borderRadius: 24, paddingVertical: 28, paddingHorizontal: 20,
    alignItems: 'center', gap: 10, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 3,
  },
  iconCircle: {
    width: 100, height: 100, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  heroIcon: { width: 76, height: 76 },
  heroName: { fontFamily: 'Fredoka_700Bold', fontSize: 28, marginTop: 4 },
  dotRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotCount: { fontFamily: 'Nunito_600SemiBold', fontSize: 12 },

  bonusGrid: { flexDirection: 'row', gap: 10, marginHorizontal: 20, marginTop: 12 },
  bonusCard: {
    flex: 1, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 12,
    alignItems: 'center', gap: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  bonusIcon: { width: 26, height: 26 },
  bonusValue: { fontFamily: 'Fredoka_700Bold', fontSize: 14, textAlign: 'center' },

  descCard: {
    marginHorizontal: 20, marginTop: 10,
    borderRadius: 16, padding: 14, gap: 8,
    borderLeftWidth: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  descLabel: { fontFamily: 'Nunito_700Bold', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8 },
  descText: { fontFamily: 'Nunito_400Regular', fontSize: 13, lineHeight: 20 },

  buyWrap: { marginHorizontal: 20, marginTop: 20, gap: 8 },
  feedbackText: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, textAlign: 'center' },
  buyBtn: {
    height: 58, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },
  buyBtnRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  buyBtnText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 20, color: '#fff' },

  closeBtn: { position: 'absolute', bottom: 40, alignSelf: 'center', width: 56, height: 56, borderRadius: 28, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 20, color: '#fff', lineHeight: 22 },
});

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

const VALID_VEHICLE_KEYS: VehicleType[] = ['taxi', 'forklift', 'armored_truck', 'delivery_truck', 'bus'];

export default function VehicleDetailScreen() {
  const { vehicle } = useLocalSearchParams<{ vehicle: string }>();
  const theme = useAppTheme();
  const vehicles = useGameStore((s) => s.vehicles);
  const gems = useGameStore((s) => s.gems);
  const buyVehicle = useGameStore((s) => s.buyVehicle);
  const [feedback, setFeedback] = useState<'success' | 'error' | null>(null);

  const key = VALID_VEHICLE_KEYS.includes(vehicle as VehicleType) ? (vehicle as VehicleType) : null;
  if (!key) return null;

  const def = VEHICLE_CONFIG[key];
  const count = vehicles[key] ?? 0;
  const isMaxed = count >= 10;
  const canAfford = gems >= def.gemCost;
  const canBuy = !isMaxed && canAfford;

  const handleBuy = () => {
    if (!canBuy) return;
    buyVehicle(key);
    setFeedback('success');
    setTimeout(() => setFeedback(null), 1500);
  };

  return (
    <AppBackground style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <LinearGradient
          colors={theme.isDark ? ['#1C2333', '#252D42'] : [`${def.accentColor}20`, `${def.accentColor}06`]}
          style={styles.hero}
        >
          <View style={[styles.iconCircle, { backgroundColor: `${def.accentColor}25` }]}>
            <Image source={VEHICLE_ICONS[key]} style={styles.heroIcon} contentFit="contain" />
          </View>
          <Text style={[styles.heroName, { color: theme.isDark ? '#fff' : theme.text }]}>{def.name}</Text>

          {/* Dot progress */}
          <View style={styles.dotRow}>
            {Array.from({ length: 10 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i < count
                    ? { backgroundColor: def.accentColor }
                    : { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.15)' : `${def.accentColor}30` },
                ]}
              />
            ))}
          </View>
          <Text style={[styles.dotCount, { color: theme.isDark ? 'rgba(255,255,255,0.5)' : theme.textMuted }]}>
            {count} / 10 owned
          </Text>
        </LinearGradient>

        {/* Current bonuses */}
        <View style={styles.bonusGrid}>
          <View style={[styles.bonusCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.bonusValue, { color: def.accentColor }]}>{def.bonus1Label(count)}</Text>
            <Text style={[styles.bonusHint, { color: theme.textMuted }]}>current</Text>
          </View>
          <View style={[styles.bonusCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.bonusValue, { color: def.accentColor }]}>{def.bonus2Label(count)}</Text>
            <Text style={[styles.bonusHint, { color: theme.textMuted }]}>current</Text>
          </View>
        </View>

        {/* Description */}
        <View style={[styles.descCard, { backgroundColor: theme.surface, borderLeftColor: def.accentColor }]}>
          <Text style={[styles.descLabel, { color: def.accentColor }]}>About</Text>
          <Text style={[styles.descText, { color: theme.text }]}>{def.description}</Text>
        </View>

        {/* Next purchase */}
        {!isMaxed && (
          <View style={[styles.nextCard, { backgroundColor: `${def.accentColor}12`, borderColor: `${def.accentColor}35`, borderWidth: 1 }]}>
            <Text style={[styles.nextLabel, { color: def.accentColor }]}>After next purchase</Text>
            <View style={styles.nextRow}>
              <Text style={[styles.nextValue, { color: def.accentColor }]}>{def.bonus1Label(count + 1)}</Text>
              <Text style={[styles.nextSep, { color: def.accentColor }]}>·</Text>
              <Text style={[styles.nextValue, { color: def.accentColor }]}>{def.bonus2Label(count + 1)}</Text>
            </View>
          </View>
        )}

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
              style={({ pressed }) => [
                styles.buyBtn,
                { backgroundColor: def.accentColor, opacity: pressed ? 0.82 : canAfford ? 1 : 0.55 },
              ]}
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

  hero: {
    marginHorizontal: 20, marginTop: 60,
    borderRadius: 24, paddingVertical: 28, paddingHorizontal: 20,
    alignItems: 'center', gap: 10,
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
    flex: 1, borderRadius: 16, padding: 14,
    alignItems: 'center', gap: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  bonusValue: { fontFamily: 'Fredoka_700Bold', fontSize: 15, textAlign: 'center' },
  bonusHint: { fontFamily: 'Nunito_400Regular', fontSize: 11, textAlign: 'center' },

  descCard: {
    marginHorizontal: 20, marginTop: 10,
    borderRadius: 16, padding: 14, gap: 6,
    borderLeftWidth: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  descLabel: { fontFamily: 'Nunito_700Bold', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8 },
  descText: { fontFamily: 'Nunito_400Regular', fontSize: 13, lineHeight: 19 },

  nextCard: {
    marginHorizontal: 20, marginTop: 10,
    borderRadius: 16, padding: 14, gap: 6,
  },
  nextLabel: { fontFamily: 'Nunito_700Bold', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8 },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  nextSep: { fontFamily: 'Fredoka_600SemiBold', fontSize: 16, opacity: 0.4 },
  nextValue: { fontFamily: 'Fredoka_600SemiBold', fontSize: 14 },

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

import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
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
  if (!key) {
    return null;
  }

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

  const btnBg = isMaxed
    ? theme.surfaceSub
    : canAfford
    ? def.accentColor
    : '#E87C5E';

  return (
    <AppBackground style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Back button */}
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Text style={[styles.backText, { color: theme.textMuted }]}>← Back</Text>
        </Pressable>

        {/* Banner */}
        <View style={[styles.banner, { backgroundColor: def.accentColor }]}>
          <Image source={VEHICLE_ICONS[key]} style={styles.bannerIcon} contentFit="contain" />
          <View style={styles.bannerText}>
            <Text style={styles.bannerName}>{def.name}</Text>
            <Text style={styles.bannerCount}>You bought {count} of 10</Text>
          </View>
        </View>

        {/* Description */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>About</Text>
          <Text style={[styles.description, { color: theme.text }]}>{def.description}</Text>
        </View>

        {/* Bonus cards */}
        <View style={styles.bonusGrid}>
          <View style={[styles.bonusCard, { backgroundColor: `${def.accentColor}15`, borderColor: `${def.accentColor}40`, borderWidth: 1 }]}>
            <Text style={[styles.bonusValue, { color: def.accentColor }]}>{def.bonus1Label(count)}</Text>
            <Text style={[styles.bonusHint, { color: theme.textMuted }]}>current bonus</Text>
          </View>
          <View style={[styles.bonusCard, { backgroundColor: `${def.accentColor}15`, borderColor: `${def.accentColor}40`, borderWidth: 1 }]}>
            <Text style={[styles.bonusValue, { color: def.accentColor }]}>{def.bonus2Label(count)}</Text>
            <Text style={[styles.bonusHint, { color: theme.textMuted }]}>current bonus</Text>
          </View>
        </View>

        {/* Next purchase preview */}
        {!isMaxed && (
          <View style={[styles.nextPreview, { backgroundColor: theme.surface }]}>
            <Text style={[styles.nextTitle, { color: theme.textMuted }]}>After next purchase</Text>
            <View style={styles.nextRow}>
              <Text style={[styles.nextValue, { color: def.accentColor }]}>{def.bonus1Label(count + 1)}</Text>
              <Text style={[styles.nextValue, { color: def.accentColor }]}>{def.bonus2Label(count + 1)}</Text>
            </View>
          </View>
        )}

        {/* Buy button */}
        <View style={styles.buyContainer}>
          {feedback === 'success' && (
            <Text style={[styles.feedbackText, { color: '#3FA535' }]}>Purchased!</Text>
          )}
          {!canAfford && !isMaxed && (
            <Text style={[styles.feedbackText, { color: '#E87C5E' }]}>
              Need {formatNum(def.gemCost - gems)} more gems
            </Text>
          )}
          <Pressable
            onPress={handleBuy}
            disabled={!canBuy}
            style={({ pressed }) => [
              styles.buyBtn,
              { backgroundColor: btnBg },
              pressed && canBuy && { opacity: 0.82 },
            ]}
          >
            {isMaxed ? (
              <Text style={[styles.buyBtnText, { color: theme.textMuted }]}>Maxed out</Text>
            ) : (
              <View style={styles.buyBtnRow}>
                <Text style={styles.buyBtnText}>Buy for </Text>
                <GemIcon size={16} />
                <Text style={styles.buyBtnText}> {formatNum(def.gemCost)}</Text>
              </View>
            )}
          </Pressable>
        </View>

      </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 120 },
  backBtn: { marginTop: 60, marginHorizontal: 20, marginBottom: 8, alignSelf: 'flex-start' },
  backText: { fontFamily: 'Nunito_600SemiBold', fontSize: 14 },
  banner: {
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  bannerIcon: { width: 80, height: 80, flexShrink: 0 },
  bannerText: { flex: 1, gap: 4 },
  bannerName: { fontFamily: 'Fredoka_700Bold', fontSize: 26, color: '#fff' },
  bannerCount: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  section: {
    marginHorizontal: 20, marginTop: 14, borderRadius: 16,
    padding: 16, gap: 8,
  },
  sectionTitle: {
    fontFamily: 'Nunito_600SemiBold', fontSize: 11,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  description: { fontFamily: 'Nunito_400Regular', fontSize: 14, lineHeight: 20 },
  bonusGrid: {
    flexDirection: 'row', gap: 12,
    marginHorizontal: 20, marginTop: 12,
  },
  bonusCard: {
    flex: 1, borderRadius: 14, padding: 14, gap: 4, alignItems: 'center',
  },
  bonusValue: { fontFamily: 'Fredoka_700Bold', fontSize: 16, textAlign: 'center' },
  bonusHint: { fontFamily: 'Nunito_400Regular', fontSize: 11, textAlign: 'center' },
  nextPreview: {
    marginHorizontal: 20, marginTop: 12, borderRadius: 14, padding: 14, gap: 8,
  },
  nextTitle: { fontFamily: 'Nunito_600SemiBold', fontSize: 12 },
  nextRow: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  nextValue: { fontFamily: 'Fredoka_600SemiBold', fontSize: 14 },
  buyContainer: { marginHorizontal: 20, marginTop: 20, gap: 8 },
  feedbackText: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, textAlign: 'center' },
  buyBtn: {
    height: 54, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  buyBtnRow: { flexDirection: 'row', alignItems: 'center' },
  buyBtnText: {
    fontFamily: 'Fredoka_600SemiBold', fontSize: 18, color: '#fff',
  },
});

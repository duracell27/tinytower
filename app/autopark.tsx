import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import AppBackground from '../src/components/AppBackground';
import { useAppTheme } from '../src/hooks/useAppTheme';
import { useGameStore } from '../src/stores/gameStore';
import { VEHICLE_CONFIG, VEHICLE_TYPES } from '../shared/config/vehicleConfig';
import type { VehicleType } from '../shared/config/vehicleConfig';

const VEHICLE_ICONS: Record<VehicleType, ReturnType<typeof require>> = {
  taxi: require('../assets/img/TaxiIcon.png'),
  forklift: require('../assets/img/ForkliftIcon.png'),
  armored_truck: require('../assets/img/ArmoredtruckIcon.png'),
  delivery_truck: require('../assets/img/DeliverytruckIcon.png'),
  bus: require('../assets/img/BusIcon.png'),
};

export default function AutoparkScreen() {
  const theme = useAppTheme();
  const vehicles = useGameStore((s) => s.vehicles);
  const totalOwned = VEHICLE_TYPES.reduce((sum, k) => sum + (vehicles[k] ?? 0), 0);

  return (
    <AppBackground style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>Autopark</Text>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: theme.surface }]}>
          <View style={styles.summaryTop}>
            <Text style={[styles.summaryLabel, { color: theme.text }]}>Vehicles owned</Text>
            <View style={styles.summaryCountRow}>
              <Text style={[styles.summaryCount, { color: theme.text }]}>{totalOwned}</Text>
              <Text style={[styles.summaryOf, { color: theme.textMuted }]}> / 50</Text>
            </View>
          </View>
          <Text style={[styles.tagline, { color: theme.textMuted }]}>
            Machines allow you to earn more and develop faster
          </Text>
        </View>

        {VEHICLE_TYPES.map((key: VehicleType) => {
          const def = VEHICLE_CONFIG[key];
          const count = vehicles[key] ?? 0;
          return (
            <Pressable
              key={key}
              onPress={() => router.push(`/autopark/${key}`)}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: theme.surface },
                pressed && styles.cardPressed,
              ]}
            >
              {/* Accent strip */}
              <View style={[styles.accentStrip, { backgroundColor: def.accentColor }]} />

              {/* Icon */}
              <Image source={VEHICLE_ICONS[key]} style={styles.icon} contentFit="contain" />

              {/* Info */}
              <View style={styles.info}>
                <View style={styles.nameRow}>
                  <Text style={[styles.vehicleName, { color: theme.text }]}>{def.name}</Text>
                  <View style={[styles.countBadge, { backgroundColor: `${def.accentColor}22` }]}>
                    <Text style={[styles.countBadgeText, { color: def.accentColor }]}>
                      {count} / 10
                    </Text>
                  </View>
                </View>
                <Text style={[styles.descText, { color: theme.textMuted }]} numberOfLines={2}>
                  {def.description}
                </Text>
              </View>

              {/* Progress bar */}
              <View style={[styles.progressTrack, { backgroundColor: theme.surfaceSub }]}>
                <View
                  style={[
                    styles.progressFill,
                    { backgroundColor: def.accentColor, width: `${count * 10}%` },
                  ]}
                />
              </View>
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
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 120 },
  header: { marginHorizontal: 20, marginTop: 60, marginBottom: 10 },
  title: { fontFamily: 'Fredoka_700Bold', fontSize: 28 },
  summaryCard: {
    marginHorizontal: 20, marginBottom: 14, borderRadius: 16,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, gap: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  summaryTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  summaryLabel: { fontFamily: 'Nunito_700Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryCountRow: { flexDirection: 'row', alignItems: 'baseline' },
  summaryCount: { fontFamily: 'Fredoka_700Bold', fontSize: 26 },
  summaryOf: { fontFamily: 'Nunito_600SemiBold', fontSize: 14 },
  tagline: { fontFamily: 'Nunito_400Regular', fontSize: 13, lineHeight: 18 },
  card: {
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 18,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 16,
    paddingRight: 14,
    paddingVertical: 14,
    shadowColor: 'rgba(60,80,45,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  cardPressed: { opacity: 0.75 },
  accentStrip: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 4 },
  icon: { width: 52, height: 52, flexShrink: 0 },
  info: { flex: 1, gap: 5 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  vehicleName: { fontFamily: 'Fredoka_600SemiBold', fontSize: 17 },
  countBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  countBadgeText: { fontFamily: 'Nunito_700Bold', fontSize: 12 },
  descText: { fontFamily: 'Nunito_400Regular', fontSize: 12, lineHeight: 17 },
  progressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 4,
    right: 0,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 2 },
  closeBtn: { position: 'absolute', bottom: 40, alignSelf: 'center', width: 56, height: 56, borderRadius: 28, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 20, color: '#fff', lineHeight: 22 },
});

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
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            {totalOwned} of 50 vehicles owned
          </Text>
        </View>

        <Text style={[styles.tagline, { color: theme.textMuted }]}>
          Machines allow you to earn more and develop faster
        </Text>

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
                  <Text style={[styles.countLabel, { color: theme.textMuted }]}>
                    {count} / 10
                  </Text>
                </View>
                <View style={styles.bonusRow}>
                  <View style={[styles.bonusChip, { backgroundColor: `${def.accentColor}18` }]}>
                    <Text style={[styles.bonusChipText, { color: def.accentColor }]}>
                      {def.bonus1Label(count)}
                    </Text>
                  </View>
                  <View style={[styles.bonusChip, { backgroundColor: `${def.accentColor}18` }]}>
                    <Text style={[styles.bonusChipText, { color: def.accentColor }]}>
                      {def.bonus2Label(count)}
                    </Text>
                  </View>
                </View>
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
  header: { marginHorizontal: 20, marginTop: 60, marginBottom: 4 },
  title: { fontFamily: 'Fredoka_700Bold', fontSize: 28 },
  subtitle: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, marginTop: 2 },
  tagline: { fontFamily: 'Nunito_400Regular', fontSize: 13, marginHorizontal: 20, marginBottom: 16 },
  card: {
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 18,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 20,
    paddingRight: 14,
    paddingVertical: 14,
    shadowColor: 'rgba(60,80,45,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  cardPressed: { opacity: 0.75 },
  accentStrip: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 8 },
  icon: { width: 52, height: 52, flexShrink: 0 },
  info: { flex: 1, gap: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  vehicleName: { fontFamily: 'Fredoka_600SemiBold', fontSize: 17 },
  countLabel: { fontFamily: 'Nunito_600SemiBold', fontSize: 13 },
  bonusRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  bonusChip: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  bonusChipText: { fontFamily: 'Nunito_600SemiBold', fontSize: 11 },
  progressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 8,
    right: 0,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 2 },
  closeBtn: { position: 'absolute', bottom: 40, alignSelf: 'center', width: 56, height: 56, borderRadius: 28, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 20, color: '#fff', lineHeight: 22 },
});

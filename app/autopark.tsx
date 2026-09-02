import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import AppBackground from '../src/components/AppBackground';
import { useAppTheme } from '../src/hooks/useAppTheme';
import { useGameStore } from '../src/stores/gameStore';
import { InfoSection } from '../src/components/InfoSection';
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
  const [infoVisible, setInfoVisible] = useState(false);

  return (
    <AppBackground style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>Autopark</Text>
          <Pressable onPress={() => setInfoVisible(true)} hitSlop={10}>
            <Image
              source={require('../assets/img/InformationIcon.png')}
              style={styles.infoIcon}
              contentFit="contain"
            />
          </Pressable>
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
                <Text style={[styles.descText, { color: theme.textMuted }]} numberOfLines={1}>
                  {def.shortDescription}
                </Text>
              </View>

              {/* Segmented progress bar */}
              <View style={styles.progressTrack}>
                {Array.from({ length: 10 }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.progressSegment,
                      { backgroundColor: i < count ? def.accentColor : theme.surfaceSub },
                    ]}
                  />
                ))}
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

      {infoVisible && (
        <View style={styles.infoOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setInfoVisible(false)} />
          <View style={[styles.infoCard, { backgroundColor: theme.surface }]}>
            <LinearGradient colors={['#2563EB', '#1D4ED8']} style={styles.infoCardHeader}>
              <Text style={styles.infoCardTitle}>Autopark</Text>
              <Pressable onPress={() => setInfoVisible(false)} hitSlop={10}>
                <Text style={styles.infoCardClose}>✕</Text>
              </Pressable>
            </LinearGradient>
            <View style={styles.infoCardBody}>
              <InfoSection
                icon={require('../assets/img/TrucksProfileIcon.png')}
                title="What is the Autopark?"
                text="The autopark is a fleet of vehicles that passively boost your hotel's performance. Each vehicle type provides a unique bonus — buy up to 10 of each."
                accentColor="rgba(37,99,235,0.18)"
              />
              <InfoSection
                icon={require('../assets/img/coin.png')}
                title="Armored Truck — Profit"
                text="Each armored truck increases base production profit by +5% and base XP by +10%. These bonuses apply before all other multipliers."
                accentColor="rgba(37,99,235,0.18)"
              />
              <InfoSection
                icon={require('../assets/img/speedUp.png')}
                title="Forklift & Delivery Truck — Speed"
                text="Forklifts reduce sell time by 1% each. Delivery trucks reduce delivery time by 1% each. Both also give +5,000 XP per action."
                accentColor="rgba(37,99,235,0.18)"
              />
              <InfoSection
                icon={require('../assets/img/xpIcon.png')}
                title="Taxi & Bus — Lobby"
                text="Taxis add +1 free gem exchange per day and +1,000 XP per visitor. Buses add +5 visitor slots and +5% tip income each."
                accentColor="rgba(37,99,235,0.18)"
                isLast
              />
            </View>
          </View>
        </View>
      )}
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginTop: 60, marginBottom: 10 },
  title: { fontFamily: 'Fredoka_700Bold', fontSize: 28 },
  infoIcon: { width: 22, height: 22, opacity: 0.7 },
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
    flexDirection: 'row',
    gap: 2,
  },
  progressSegment: { flex: 1, height: '100%' },
  closeBtn: { position: 'absolute', bottom: 40, alignSelf: 'center', width: 56, height: 56, borderRadius: 28, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 20, color: '#fff', lineHeight: 22 },
  infoOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(18,26,44,0.45)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  infoCard: { width: '100%', borderRadius: 20, overflow: 'hidden' },
  infoCardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 13,
  },
  infoCardTitle: { fontFamily: 'Fredoka_700Bold', fontSize: 17, color: '#fff' },
  infoCardClose: { color: 'rgba(255,255,255,0.85)', fontSize: 16, fontFamily: 'Fredoka_600SemiBold' },
  infoCardBody: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 8 },
});

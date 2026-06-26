import React from 'react';
import { View, Text, Pressable, StyleSheet, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useAuthStore } from '../src/stores/authStore';
import { useGameStore } from '../src/stores/gameStore';
import BottomNav from '../src/components/BottomNav';
import { xpForLevel } from '../shared/engine/xp';

export default function ProfileScreen() {
  const player = useAuthStore((s) => s.player);
  const logout = useAuthStore((s) => s.logout);
  const playerLevel = useGameStore((s) => s.playerLevel);
  const playerXp = useGameStore((s) => s.playerXp);
  const gems = useGameStore((s) => s.gems);
  const balance = useGameStore((s) => s.balance);
  const xpNeeded = xpForLevel(playerLevel);

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  const initial = (player?.playerName ?? 'G').charAt(0).toUpperCase();

  return (
    <ImageBackground
      source={require('../assets/welcome-bg.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
      <View style={styles.header}>
        <Text style={styles.title}>Профіль</Text>
      </View>

      <View style={styles.card}>
        <LinearGradient
          colors={['#74D3C4', '#3FA9A0']}
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>{initial}</Text>
        </LinearGradient>
        <Text style={styles.name}>{player?.playerName ?? 'Гравець'}</Text>
        <Text style={styles.email}>{player?.email ?? ''}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{playerLevel}</Text>
            <Text style={styles.statLabel}>Рівень</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItemXp}>
            <Text style={styles.statValue}>{playerXp}/{xpNeeded}</Text>
            <Text style={styles.statLabel}>Досвід</Text>
          </View>
        </View>

        <View style={styles.xpBarContainer}>
          <View style={[styles.xpBarFill, { width: `${Math.min((playerXp / xpNeeded) * 100, 100)}%` }]} />
        </View>

        <View style={styles.currencyRow}>
          <View style={styles.currencyItem}>
            <View style={styles.coinIcon} />
            <Text style={styles.currencyValue}>{balance}</Text>
          </View>
          <View style={styles.currencyItem}>
            <View style={styles.gemIcon} />
            <Text style={styles.currencyValueGem}>{gems}</Text>
          </View>
        </View>
      </View>

      <Pressable onPress={handleLogout} style={({ pressed }) => [
        styles.logoutButton,
        pressed && styles.logoutPressed,
      ]}>
        <Text style={styles.logoutText}>Вийти з акаунту</Text>
      </Pressable>

      <BottomNav />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 20,
    color: '#27331F',
  },
  card: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    shadowColor: 'rgba(60,80,45,1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: 'rgba(20,90,80,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  avatarText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 30,
    color: '#fff',
  },
  name: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 22,
    color: '#27331F',
    marginTop: 14,
  },
  email: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 14,
    color: '#7C8A6E',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 24,
    gap: 24,
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statItemXp: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 24,
    color: '#27331F',
  },
  statLabel: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 12,
    color: '#7C8A6E',
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#E4E1D3',
  },
  xpBarContainer: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(60,120,40,0.12)',
    marginTop: 18,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#3FA535',
  },
  currencyRow: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 18,
  },
  currencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  coinIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#F2B330',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  currencyValue: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 16,
    color: '#C28A22',
  },
  gemIcon: {
    width: 14,
    height: 14,
    backgroundColor: '#3FB8D6',
    borderRadius: 3,
    transform: [{ rotate: '45deg' }],
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  currencyValueGem: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 16,
    color: '#2592AB',
  },
  logoutButton: {
    marginHorizontal: 20,
    marginTop: 30,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E87C5E',
  },
  logoutPressed: {
    opacity: 0.7,
  },
  logoutText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 16,
    color: '#E87C5E',
  },
});

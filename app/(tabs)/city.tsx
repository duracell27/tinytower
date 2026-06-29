import React from 'react';
import { View, Text, StyleSheet, ImageBackground } from 'react-native';
import { BlurView } from 'expo-blur';
import TopBar from '../../src/components/TopBar';
import { useGameStore, useBalance } from '../../src/stores/gameStore';
import { useAuthStore } from '../../src/stores/authStore';

function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

function formatCoins(n: number): string {
  if (n >= 1000) {
    const str = String(n);
    const parts: string[] = [];
    for (let i = str.length; i > 0; i -= 3) {
      parts.unshift(str.slice(Math.max(0, i - 3), i));
    }
    return parts.join(' ');
  }
  return String(n);
}

export default function CityScreen() {
  const balance = useBalance();
  const playerLevel = useGameStore((s) => s.playerLevel);
  const playerXp = useGameStore((s) => s.playerXp);
  const gems = useGameStore((s) => s.gems);
  const player = useAuthStore((s) => s.player);
  const playerName = player?.playerName ?? 'Гравець';
  const initial = playerName.charAt(0).toUpperCase();

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('../../assets/welcome-bg.png')}
        style={styles.background}
        resizeMode="cover"
      >
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
        <View style={styles.content}>
          <Text style={styles.emoji}>🏙️</Text>
          <Text style={styles.title}>Місто</Text>
          <Text style={styles.subtitle}>Тут поки немає функціоналу</Text>
        </View>

        <TopBar
          name={playerName}
          level={playerLevel}
          xp={playerXp}
          xpForNextLevel={xpForLevel(playerLevel)}
          initial={initial}
          coins={formatCoins(balance)}
          gems={String(gems)}
        />
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
    backgroundColor: '#DCEFF6',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 24,
    color: '#27331F',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 15,
    color: '#7C7A6E',
    textAlign: 'center',
  },
});

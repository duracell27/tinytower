import React from 'react';
import { View, Text, StyleSheet, ImageBackground } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTranslation } from 'react-i18next';
import TopBar from '../../src/components/TopBar';
import { useGameStore, useBalance } from '../../src/stores/gameStore';
import { useAuthStore } from '../../src/stores/authStore';
import { xpForLevel } from '../../shared/engine/xp';
import { formatNum } from '../../src/utils/format';

export default function CityScreen() {
  const { t } = useTranslation('tabs');
  const balance = useBalance();
  const playerLevel = useGameStore((s) => s.playerLevel);
  const playerXp = useGameStore((s) => s.playerXp);
  const gems = useGameStore((s) => s.gems);
  const player = useAuthStore((s) => s.player);
  const playerName = player?.playerName ?? t('profile.guestFallbackName');

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
          <Text style={styles.title}>{t('city.title')}</Text>
          <Text style={styles.subtitle}>{t('city.comingSoon')}</Text>
        </View>

        <TopBar
          name={playerName}
          level={playerLevel}
          xp={playerXp}
          xpForNextLevel={xpForLevel(playerLevel)}
          coins={formatNum(balance)}
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

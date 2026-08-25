import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, useColorScheme } from 'react-native';
import AppBackground from '../../src/components/AppBackground';
import { useTranslation } from 'react-i18next';
import TopBar from '../../src/components/TopBar';
import { useGameStore, useBalance } from '../../src/stores/gameStore';
import { useAuthStore } from '../../src/stores/authStore';
import GuestWall from '../../src/components/GuestWall';
import { xpForLevel } from '../../shared/engine/xp';
import { formatNum } from '../../src/utils/format';
import { useGameClock } from '../../src/hooks/useGameClock';
import { calcRevenuePerMin } from '../../shared/engine/ratingUtils';
import { gameConfig } from '../../shared/config/gameConfig';

export default function CityScreen() {
  const { t } = useTranslation('tabs');
  const isDark = useColorScheme() === 'dark';
  const balance = useBalance();
  const playerLevel = useGameStore((s) => s.playerLevel);
  const playerXp = useGameStore((s) => s.playerXp);
  const gems = useGameStore((s) => s.gems);
  const player = useAuthStore((s) => s.player);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const playerName = player?.playerName ?? t('profile.guestFallbackName');
  const floors = useGameStore((s) => s.floors);
  const workers = useGameStore((s) => s.workers);
  const openedFloorTypes = useGameStore((s) => s.openedFloorTypes);
  const coinBonusPercent = useGameStore((s) => s.coinBonusPercent);
  const businessUpgrades = useGameStore((s) => s.businessUpgrades);
  const floorStars       = useGameStore((s) => s.floorStars);
  const now = useGameClock(60_000);
  const revenuePerMin = React.useMemo(
    () => calcRevenuePerMin(floors, workers, openedFloorTypes ?? {}, gameConfig, now, businessUpgrades, coinBonusPercent, floorStars),
    [floors, workers, openedFloorTypes, now, businessUpgrades, coinBonusPercent, floorStars],
  );

  return (
    <View style={styles.container}>
      <AppBackground style={styles.background}>
        <TopBar
          name={playerName}
          level={playerLevel}
          xp={playerXp}
          xpForNextLevel={xpForLevel(playerLevel)}
          coins={formatNum(balance)}
          gems={formatNum(gems)}
          revenuePerMin={revenuePerMin}
        />
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} style={styles.scrollView}>
          {/* Hero */}
          <View style={styles.hero}>
            <Image source={require('../../assets/img/forum/forumCatCities.png')} style={styles.heroImage} />
            <Text style={[styles.heroTagline, isDark && { color: '#DDE8D8' }]}>{t('city.tagline')}</Text>
            <Text style={[styles.heroDescription, isDark && { color: '#8A9A80' }]}>{t('city.description')}</Text>
          </View>

          {/* Bonus card */}
          <View style={[styles.card, isDark ? { backgroundColor: 'rgba(40,90,55,0.35)' } : styles.cardBonus]}>
            <Text style={styles.cardIcon}>🎁</Text>
            <View style={styles.cardBody}>
              <Text style={[styles.cardTitle, isDark && { color: '#DDE8D8' }]}>{t('city.bonusTitle')}</Text>
              <Text style={[styles.cardText, isDark && { color: '#8A9A80' }]}>{t('city.bonusDescription')}</Text>
            </View>
          </View>

          {/* Requirement card */}
          <View style={[styles.card, isDark ? { backgroundColor: 'rgba(100,75,15,0.35)' } : styles.cardRequirement]}>
            <Text style={styles.cardIcon}>🏗️</Text>
            <View style={styles.cardBody}>
              <Text style={[styles.cardTitle, isDark && { color: '#DDE8D8' }]}>{t('city.requirementTitle')}</Text>
              <Text style={[styles.cardText, isDark && { color: '#8A9A80' }]}>{t('city.requirementDescription')}</Text>
            </View>
          </View>

          {/* Join section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDark && { color: '#DDE8D8' }]}>{t('city.joinTitle')}</Text>
            <Text style={[styles.sectionText, isDark && { color: '#8A9A80' }]}>{t('city.joinDescription')}</Text>
            <TouchableOpacity style={styles.btnPrimary} disabled>
              <Text style={styles.btnPrimaryText}>{t('city.joinButton')}</Text>
            </TouchableOpacity>
          </View>

          {/* Rankings action card */}
          <TouchableOpacity style={[styles.actionCard, isDark ? { backgroundColor: 'rgba(30,70,110,0.35)' } : styles.actionCardBlue]} disabled activeOpacity={0.7}>
            <View style={[styles.actionCardLeft, isDark && { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
              <Text style={styles.actionCardEmoji}>🏆</Text>
            </View>
            <View style={styles.actionCardBody}>
              <Text style={[styles.actionCardTitle, isDark && { color: '#DDE8D8' }]}>{t('city.rankingsTitle')}</Text>
              <Text style={[styles.actionCardSubtitle, isDark && { color: '#8A9A80' }]}>{t('city.rankingsSubtitle')}</Text>
            </View>
            <Text style={[styles.actionCardChevron, isDark && { color: '#8A9A80' }]}>›</Text>
          </TouchableOpacity>

          {/* Create action card */}
          <TouchableOpacity style={[styles.actionCard, isDark ? { backgroundColor: 'rgba(30,90,55,0.35)' } : styles.actionCardGreen]} disabled activeOpacity={0.7}>
            <View style={[styles.actionCardLeft, isDark && { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
              <Text style={styles.actionCardEmoji}>🏛️</Text>
            </View>
            <View style={styles.actionCardBody}>
              <Text style={[styles.actionCardTitle, isDark && { color: '#DDE8D8' }]}>{t('city.createButton')}</Text>
              <Text style={[styles.actionCardSubtitle, isDark && { color: '#8A9A80' }]}>{t('city.createDescription')}</Text>
            </View>
            <Text style={[styles.actionCardChevron, isDark && { color: '#8A9A80' }]}>›</Text>
          </TouchableOpacity>
        </ScrollView>
      </AppBackground>
      {!isAuthenticated && (
        <GuestWall message="Create a free account to access city features" />
      )}
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
  scrollView: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 130,
    paddingBottom: 100,
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 24,
  },
  heroImage: {
    width: 120,
    height: 120,
    marginBottom: 10,
  },
  heroTagline: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 20,
    color: '#1C2C1A',
    textAlign: 'center',
    marginBottom: 6,
  },
  heroDescription: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 15,
    color: '#5A6650',
    textAlign: 'center',
  },

  // Cards
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  cardBonus: {
    backgroundColor: '#D4EDDA',
  },
  cardRequirement: {
    backgroundColor: '#FFF3CD',
  },
  cardIcon: {
    fontSize: 28,
    marginTop: 2,
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 15,
    color: '#1C2C1A',
    marginBottom: 3,
  },
  cardText: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 13,
    color: '#4A5540',
    lineHeight: 18,
  },

  // Join section
  section: {
    paddingVertical: 16,
  },
  sectionTitle: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 17,
    color: '#1C2C1A',
    marginBottom: 4,
  },
  sectionText: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 14,
    color: '#5A6650',
    marginBottom: 12,
    lineHeight: 20,
  },
  btnPrimary: {
    backgroundColor: '#4A7C59',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    opacity: 0.5,
  },
  btnPrimaryText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 16,
    color: '#FFFFFF',
  },

  // Action cards
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    gap: 14,
    opacity: 0.6,
  },
  actionCardBlue: {
    backgroundColor: '#C8E6F5',
  },
  actionCardGreen: {
    backgroundColor: '#C8EDD4',
  },
  actionCardLeft: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCardEmoji: {
    fontSize: 26,
  },
  actionCardBody: {
    flex: 1,
  },
  actionCardTitle: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 16,
    color: '#1C2C1A',
    marginBottom: 2,
  },
  actionCardSubtitle: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 13,
    color: '#4A6050',
    lineHeight: 17,
  },
  actionCardChevron: {
    fontSize: 26,
    color: '#7A9A8A',
    lineHeight: 30,
  },
});

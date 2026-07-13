import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ImageBackground, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import i18n from '../../src/i18n';
import { useAuthStore } from '../../src/stores/authStore';
import { useGameStore } from '../../src/stores/gameStore';
import { xpForLevel } from '../../shared/engine/xp';
import { ACHIEVEMENT_CATEGORIES } from '../../shared/config/achievementCategories';
import { useGameClock } from '../../src/hooks/useGameClock';
import { formatNum } from '../../src/utils/format';
import { CoinIcon, GemIcon } from '../../src/components/CurrencyIcons';

function formatSyncTime(ts: number, now: number): string {
  if (ts === 0) return i18n.t('common:relativeTime.never');
  const diff = now - ts;
  if (diff < 60_000) return i18n.t('common:relativeTime.justNow');
  if (diff < 3_600_000) return i18n.t('common:relativeTime.minutesAgo', { count: Math.floor(diff / 60_000) });
  if (diff < 86_400_000) return i18n.t('common:relativeTime.hoursAgo', { count: Math.floor(diff / 3_600_000) });
  return i18n.t('common:relativeTime.daysAgo', { count: Math.floor(diff / 86_400_000) });
}

function SyncIcon({ color }: { color: string }) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(180, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={animStyle}>
      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
        <Path
          d="M4 12a8 8 0 0 1 13.66-5.66M20 12a8 8 0 0 1-13.66 5.66"
          stroke={color}
          strokeWidth={2.2}
          strokeLinecap="round"
        />
        <Path d="M19 6.5V3M19 6.5H15.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M5 17.5V21M5 17.5H8.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Animated.View>
  );
}

export default function ProfileScreen() {
  const { t } = useTranslation('tabs');
  const player = useAuthStore((s) => s.player);
  const logout = useAuthStore((s) => s.logout);
  const playerLevel = useGameStore((s) => s.playerLevel);
  const playerXp = useGameStore((s) => s.playerXp);
  const gems = useGameStore((s) => s.gems);
  const balance = useGameStore((s) => s.balance);
  const commandQueueLength = useGameStore((s) => s.commandQueue.length);
  const lastSyncAt = useGameStore((s) => s.lastSyncAt);
  const categoryProgress = useGameStore((s) => s.categoryProgress);
  const xpNeeded = xpForLevel(playerLevel);
  const totalEarnedLevels = ACHIEVEMENT_CATEGORIES.reduce(
    (sum, cat) => sum + (categoryProgress[cat.key]?.currentLevel ?? 0),
    0,
  );
  const now = useGameClock(10_000);

  const syncStatus = commandQueueLength > 2000
    ? 'critical'
    : commandQueueLength > 0
    ? 'pending'
    : 'online';

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  const initial = (player?.playerName ?? t('profile.guestFallbackName')).charAt(0).toUpperCase();

  return (
    <ImageBackground
      source={require('../../assets/welcome-bg.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.profileRow}>
            <LinearGradient
              colors={['#74D3C4', '#3FA9A0']}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>{initial}</Text>
            </LinearGradient>
            <View style={styles.profileInfo}>
              <Text style={styles.name}>{player?.playerName ?? t('profile.guestFallbackName')}</Text>
              <Text style={styles.email}>{player?.email ?? ''}</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{playerLevel}</Text>
              <Text style={styles.statLabel}>{t('profile.stats.level')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItemXp}>
              <Text style={styles.statValue}>{formatNum(playerXp)}/{formatNum(xpNeeded)}</Text>
              <Text style={styles.statLabel}>{t('profile.stats.xp')}</Text>
            </View>
          </View>

          <View style={styles.xpBarContainer}>
            <View style={[styles.xpBarFill, { width: `${Math.min((playerXp / xpNeeded) * 100, 100)}%` }]} />
          </View>

          <View style={styles.currencyRow}>
            <View style={styles.currencyItem}>
              <CoinIcon size={18} />
              <Text style={styles.currencyValue}>{formatNum(balance)}</Text>
            </View>
            <View style={styles.currencyItem}>
              <GemIcon size={16} />
              <Text style={styles.currencyValueGem}>{formatNum(gems)}</Text>
            </View>
          </View>
        </View>

        <Pressable
          onPress={() => router.push('/achievements')}
          style={({ pressed }) => [styles.achievementsButton, pressed && styles.achievementsButtonPressed]}
        >
          <Text style={styles.achievementsButtonText}>
            Achievements ({totalEarnedLevels})
          </Text>
        </Pressable>

        <Pressable onPress={handleLogout} style={({ pressed }) => [
          styles.logoutButton,
          pressed && styles.logoutPressed,
        ]}>
          <Text style={styles.logoutText}>{t('profile.logout')}</Text>
        </Pressable>

        {/* Sync status card */}
        <View style={styles.syncCard}>
          <View style={[
            styles.syncDot,
            syncStatus === 'online' && styles.syncDotGreen,
            syncStatus === 'pending' && styles.syncDotYellow,
            syncStatus === 'critical' && styles.syncDotRed,
          ]} />
          <Text style={[
            styles.syncStatus,
            syncStatus === 'online' && styles.syncStatusGreen,
            syncStatus === 'pending' && styles.syncStatusYellow,
            syncStatus === 'critical' && styles.syncStatusRed,
          ]}>
            {syncStatus === 'online' && t('profile.sync.online')}
            {syncStatus === 'pending' && t('profile.sync.pending', { count: commandQueueLength })}
            {syncStatus === 'critical' && t('profile.sync.critical', { count: commandQueueLength })}
          </Text>
          <View style={styles.syncTimeRow}>
            <SyncIcon color="#9BA3B0" />
            <Text style={styles.syncTime}>{formatSyncTime(lastSyncAt, now)}</Text>
          </View>
        </View>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    paddingBottom: 150,
  },
  card: {
    marginHorizontal: 20,
    marginTop: 60,
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
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 16,
  },
  profileInfo: {
    flex: 1,
  },
  name: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 22,
    color: '#27331F',
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
  currencyValue: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 16,
    color: '#C28A22',
  },
  currencyValueGem: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 16,
    color: '#2592AB',
  },
  syncCard: {
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: 'rgba(60,80,45,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  syncDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    flexShrink: 0,
  },
  syncDotGreen: { backgroundColor: '#3FA535' },
  syncDotYellow: { backgroundColor: '#E5A41C' },
  syncDotRed: { backgroundColor: '#E0503A' },
  syncStatus: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    flex: 1,
  },
  syncStatusGreen: { color: '#3FA535' },
  syncStatusYellow: { color: '#C28A22' },
  syncStatusRed: { color: '#C0372A' },
  syncTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  syncTime: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 12,
    color: '#9BA3B0',
  },
  achievementsButton: {
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
  },
  achievementsButtonPressed: { opacity: 0.7 },
  achievementsButtonText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 16,
    color: '#27331F',
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

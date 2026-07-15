import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ImageBackground, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import Svg, { Path, Polyline } from 'react-native-svg';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import i18n from '../../src/i18n';
import { useAuthStore } from '../../src/stores/authStore';
import { useGameStore } from '../../src/stores/gameStore';
import type { FailedCommandEntry } from '../../src/stores/gameStore';
import { xpForLevel } from '../../shared/engine/xp';
import { ACHIEVEMENT_CATEGORIES } from '../../shared/config/achievementCategories';
import { useGameClock } from '../../src/hooks/useGameClock';
import { formatNum } from '../../src/utils/format';
import { getUserIcon } from '../../src/utils/userIcon';
import { CoinIcon, GemIcon } from '../../src/components/CurrencyIcons';
import * as Clipboard from 'expo-clipboard';
import type { Command } from '../../shared/types';

const COMMAND_LABELS: Record<string, string> = {
  buy: 'Buy product',
  list: 'List product',
  collect: 'Collect revenue',
  assign_worker: 'Assign worker',
  fire_worker: 'Fire worker',
  evict_worker: 'Evict worker',
  upgrade_to_specialist: 'Upgrade to specialist',
  fire_and_evict_worker: 'Fire & evict worker',
  spawn_visitor: 'Spawn visitor',
  lift_visitor: 'Lift visitor',
  collect_tip: 'Collect tip',
  deliver_all: 'Deliver all',
  upgrade_elevator: 'Upgrade elevator',
  upgrade_lobby: 'Upgrade lobby',
  claim_daily_reward: 'Claim daily reward',
  expand_hotel: 'Expand hotel',
  fill_lobby: 'Fill lobby',
  buy_floor: 'Buy floor',
  open_floor: 'Open floor',
  exchange_gems: 'Exchange gems',
  speed_up_construction: 'Speed up construction',
  speed_up_delivery: 'Speed up delivery',
  dev_add_gems: 'Dev: add gems',
  evict_low_level_workers: 'Evict low-level workers',
};

const FRIENDLY_ERRORS: Record<string, string> = {
  'Insufficient gems': 'Not enough gems',
  'Insufficient balance': 'Not enough coins',
  'Insufficient tools': 'Missing building tools',
  'Floor not found': 'Floor does not exist',
  'Floor not under construction': 'Floor is not being built',
  'Construction already complete': 'Building already finished',
  'Construction not complete': 'Building not finished yet',
  'Slot not found': 'Slot not found',
  'Not delivering': 'Not in delivery state',
  'No type assigned': 'No product selected',
  'Delivery already complete': 'Delivery already done',
  'Floor not available for purchase': 'Floor not available yet',
  'Floor already under construction': 'Already building this floor',
  'Floor already exists': 'Floor already built',
  'Worker not found': 'Worker not found',
  'Worker already assigned': 'Worker already busy',
  'Slot already has a worker': 'Slot already occupied',
  'Worker is not assigned': 'Worker has no assignment',
  'Cannot fire during active production': 'Production is active',
  'Cannot evict assigned worker': 'Unassign worker first',
  'No worker assigned to slot': 'No worker here',
  'Production not idle': 'Production is busy',
  'Another delivery in progress on this floor': 'Delivery in progress',
  'Cannot change production type': 'Cannot change product now',
  'Unknown production type': 'Unknown product',
  'All businesses of this type already built': 'All businesses built',
  'Unknown floor type': 'Unknown floor type',
};

function commandLabel(type: string) {
  return COMMAND_LABELS[type] ?? type;
}

function friendlyError(error: string) {
  return FRIENDLY_ERRORS[error] ?? error;
}

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

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Polyline
        points={expanded ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}
        stroke="#9BA3B0"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function groupByType(queue: Command[]): { type: string; count: number }[] {
  const map = new Map<string, number>();
  for (const cmd of queue) {
    map.set(cmd.type, (map.get(cmd.type) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([type, count]) => ({ type, count }));
}

function buildCopyText(
  queue: Command[],
  failLog: FailedCommandEntry[],
  now: number,
): string {
  const lines: string[] = ['=== TinyTower Sync Report ==='];
  lines.push(`Date: ${new Date(now).toISOString()}`);

  if (queue.length > 0) {
    lines.push('', `[Pending commands: ${queue.length}]`);
    for (const { type, count } of groupByType(queue)) {
      lines.push(`  - ${commandLabel(type)}${count > 1 ? ` ×${count}` : ''}`);
    }
  }

  if (failLog.length > 0) {
    lines.push('', `[Failed commands: ${failLog.length}]`);
    for (const entry of [...failLog].reverse()) {
      lines.push(`  - ${commandLabel(entry.type)} → ${friendlyError(entry.error)} (${formatSyncTime(entry.timestamp, now)})`);
    }
  }

  return lines.join('\n');
}

export default function ProfileScreen() {
  const { t } = useTranslation('tabs');
  const player = useAuthStore((s) => s.player);
  const logout = useAuthStore((s) => s.logout);
  const playerLevel = useGameStore((s) => s.playerLevel);
  const playerXp = useGameStore((s) => s.playerXp);
  const gems = useGameStore((s) => s.gems);
  const balance = useGameStore((s) => s.balance);
  const commandQueue = useGameStore((s) => s.commandQueue);
  const commandQueueLength = commandQueue.length;
  const lastSyncAt = useGameStore((s) => s.lastSyncAt);
  const categoryProgress = useGameStore((s) => s.categoryProgress);
  const failedCommandLog = useGameStore((s) => s.failedCommandLog);
  const clearFailedCommandLog = useGameStore((s) => s.clearFailedCommandLog);
  const xpNeeded = xpForLevel(playerLevel);
  const totalEarnedLevels = ACHIEVEMENT_CATEGORIES.reduce(
    (sum, cat) => sum + (categoryProgress[cat.key]?.currentLevel ?? 0),
    0,
  );
  const now = useGameClock(10_000);

  const [syncExpanded, setSyncExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const syncStatus = commandQueueLength > 2000
    ? 'critical'
    : commandQueueLength > 0
    ? 'pending'
    : 'online';

  const hasExpandContent = commandQueueLength > 0 || failedCommandLog.length > 0;

  useEffect(() => {
    if (!hasExpandContent) setSyncExpanded(false);
  }, [hasExpandContent]);

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  const handleCopy = async () => {
    const text = buildCopyText(commandQueue, failedCommandLog, now);
    await Clipboard.setStringAsync(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const pendingGroups = groupByType(commandQueue);
  const reversedFailLog = [...failedCommandLog].reverse();

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
            <Image
              source={getUserIcon(playerLevel)}
              style={styles.avatar}
              contentFit="cover"
            />
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
          <Image source={require('../../assets/img/profile/profileAchivments.png')} style={styles.achievementsIcon} />
          <Text style={styles.achievementsButtonText}>
            {t('profile.achievements', { count: totalEarnedLevels })}
          </Text>
        </Pressable>

        <Pressable onPress={handleLogout} style={({ pressed }) => [
          styles.logoutButton,
          pressed && styles.logoutPressed,
        ]}>
          <Text style={styles.logoutText}>{t('profile.logout')}</Text>
        </Pressable>

        {/* Sync status card */}
        <Pressable
          onPress={() => hasExpandContent && setSyncExpanded((v) => !v)}
          style={({ pressed }) => [styles.syncCard, pressed && hasExpandContent && styles.syncCardPressed]}
        >
          <View style={styles.syncRow}>
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
            {hasExpandContent && (
              <View style={styles.chevron}>
                <ChevronIcon expanded={syncExpanded} />
              </View>
            )}
          </View>

          {syncExpanded && (
            <View style={styles.syncDropdown}>

              {/* Pending commands */}
              {commandQueueLength > 0 && (
                <View style={styles.dropSection}>
                  <Text style={styles.dropSectionTitle}>
                    {t('profile.sync.pendingDetail', { count: commandQueueLength })}
                  </Text>
                  {pendingGroups.map(({ type, count }) => (
                    <View key={type} style={styles.dropRow}>
                      <Text style={styles.dropRowBullet}>•</Text>
                      <Text style={styles.dropRowText}>
                        {commandLabel(type)}{count > 1 ? ` ×${count}` : ''}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Failed command history */}
              {failedCommandLog.length > 0 && (
                <View style={styles.dropSection}>
                  <View style={styles.dropSectionHeader}>
                    <Text style={styles.dropSectionTitle}>
                      {t('profile.sync.failedCount', { count: failedCommandLog.length })}
                    </Text>
                    <View style={styles.dropActions}>
                      <Pressable
                        onPress={handleCopy}
                        style={({ pressed }) => [styles.dropActionBtn, pressed && styles.dropActionBtnPressed]}
                      >
                        <Text style={styles.dropActionText}>{copied ? t('profile.sync.copied') : t('profile.sync.copy')}</Text>
                      </Pressable>
                      <Pressable
                        onPress={clearFailedCommandLog}
                        style={({ pressed }) => [styles.dropActionBtn, styles.dropActionBtnDanger, pressed && styles.dropActionBtnPressed]}
                      >
                        <Text style={[styles.dropActionText, styles.dropActionTextDanger]}>{t('profile.sync.clear')}</Text>
                      </Pressable>
                    </View>
                  </View>
                  {reversedFailLog.map((entry) => (
                    <View key={entry.id} style={styles.dropRow}>
                      <Text style={styles.dropRowBullet}>•</Text>
                      <View style={styles.dropRowContent}>
                        <Text style={styles.dropRowText} numberOfLines={1}>
                          {commandLabel(entry.type)}
                          <Text style={styles.dropRowError}> — {friendlyError(entry.error)}</Text>
                        </Text>
                        <Text style={styles.dropRowTime}>{formatSyncTime(entry.timestamp, now)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

            </View>
          )}
        </Pressable>
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
    borderWidth: 3,
    borderColor: '#fff',
    overflow: 'hidden',
    shadowColor: 'rgba(20,90,80,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
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
    paddingTop: 13,
    paddingBottom: 13,
    shadowColor: 'rgba(60,80,45,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  syncCardPressed: {
    opacity: 0.85,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  chevron: {
    marginLeft: 4,
    flexShrink: 0,
  },
  syncDropdown: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0EDE5',
    paddingTop: 12,
    gap: 12,
  },
  dropSection: {
    gap: 6,
  },
  dropSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  dropSectionTitle: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 11,
    color: '#9BA3B0',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  dropActions: {
    flexDirection: 'row',
    gap: 6,
  },
  dropActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#F5F3EC',
  },
  dropActionBtnDanger: {
    backgroundColor: '#FEF1EE',
  },
  dropActionBtnPressed: {
    opacity: 0.7,
  },
  dropActionText: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 11,
    color: '#7C8A6E',
  },
  dropActionTextDanger: {
    color: '#C0372A',
  },
  dropRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingVertical: 1,
  },
  dropRowBullet: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 13,
    color: '#9BA3B0',
    lineHeight: 20,
  },
  dropRowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  dropRowText: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 13,
    color: '#3E4A35',
    flex: 1,
  },
  dropRowError: {
    color: '#C0372A',
    fontFamily: 'Nunito_400Regular',
  },
  dropRowTime: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: '#9BA3B0',
    flexShrink: 0,
  },
  achievementsButton: {
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  achievementsButtonPressed: { opacity: 0.7 },
  achievementsIcon: {
    width: 36,
    height: 36,
  },
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

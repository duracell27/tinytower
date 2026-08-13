import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput, Modal, KeyboardAvoidingView, Platform, ActivityIndicator, Switch, Dimensions } from 'react-native';
import { useAppTheme } from '../../src/hooks/useAppTheme';
import { Image } from 'expo-image';
import AppBackground from '../../src/components/AppBackground';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSpring, runOnJS, Easing } from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { Path, Polyline } from 'react-native-svg';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import i18n from '../../src/i18n';
import { useAuthStore } from '../../src/stores/authStore';
import { useGameStore } from '../../src/stores/gameStore';
import type { FailedCommandEntry } from '../../src/stores/gameStore';
import { xpForLevel } from '../../shared/engine/xp';
import { ACHIEVEMENT_CATEGORIES } from '../../shared/config/achievementCategories';
import { DAILY_TASKS } from '../../shared/config/dailyTasksConfig';
import { gameConfig } from '../../shared/config/gameConfig';
import { getWorkerMood } from '../../shared/engine/workerUtils';
import { calcRevenuePerMin } from '../../shared/engine/ratingUtils';
import { useGameClock } from '../../src/hooks/useGameClock';
import { formatNum, formatCompact, formatNumFull } from '../../src/utils/format';
import { BUSINESS_UPGRADE_COSTS } from '../../shared/config/businessUpgradeCosts';
import { getUserIcon } from '../../src/utils/userIcon';
import { CoinIcon, GemIcon } from '../../src/components/CurrencyIcons';
import * as Clipboard from 'expo-clipboard';
import type { Command } from '../../shared/types';
import { api, type PlayerProfile } from '../../src/services/api';
import { useFriendStore } from '../../src/stores/friendStore';
import { useMailStore } from '../../src/stores/mailStore';
import { useBlockStore } from '../../src/stores/blockStore';
import { useSettingsStore } from '../../src/stores/settingsStore';

const COIN_ICON     = require('../../assets/img/coin.png');
const BEST_RPM_ICON = require('../../assets/img/bestRPM.png');
const SAND_CLOCK    = require('../../assets/img/sandClock.png');

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

function SkeletonBox({ width, height = 18 }: { width: number; height?: number }) {
  return (
    <View style={{
      width,
      height,
      borderRadius: 6,
      backgroundColor: 'rgba(120,140,100,0.15)',
    }} />
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

const STAR_FULL  = require('../../assets/img/starFull.png');
const STAR_66    = require('../../assets/img/star66.png');
const STAR_33    = require('../../assets/img/star33.png');
const STAR_EMPTY = require('../../assets/img/starEmpty.png');

const starStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4, marginBottom: 10 },
  star: { width: 20, height: 20 },
});

const starSource = (avg: number, idx: number) => {
  const rem = avg - idx;
  if (rem >= 1)       return STAR_FULL;
  if (rem >= 2 / 3)   return STAR_66;
  if (rem >= 1 / 3)   return STAR_33;
  return STAR_EMPTY;
};

const FloorStarsRow = ({ avg }: { avg: number }) => (
  <View style={starStyles.row}>
    {[0, 1, 2, 3, 4].map((i) => (
      <Image key={i} source={starSource(avg, i)} style={starStyles.star} contentFit="contain" />
    ))}
  </View>
);

function ProfileInfoRow({
  icons, label, value, theme, noBorder, compact,
}: {
  icons: any[];
  label: string;
  value: string;
  theme: ReturnType<typeof import('../../src/hooks/useAppTheme').useAppTheme>;
  noBorder?: boolean;
  compact?: boolean;
}) {
  return (
    <View style={[
      profileInfoRowStyles.row,
      !noBorder && { borderBottomWidth: 1, borderBottomColor: theme.divider },
      compact && { paddingVertical: 6 },
    ]}>
      <View style={profileInfoRowStyles.left}>
        {icons.map((src, i) => (
          <Image key={i} source={src} style={profileInfoRowStyles.icon} contentFit="contain" />
        ))}
        <Text style={[profileInfoRowStyles.label, { color: theme.textMuted }]}>{label}</Text>
      </View>
      <Text style={[profileInfoRowStyles.value, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

const profileInfoRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    alignSelf: 'stretch',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  icon: {
    width: 18,
    height: 18,
  },
  label: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 13,
    color: '#7C8A6E',
  },
  value: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 15,
    color: '#27331F',
  },
});

export default function ProfileScreen() {
  const { t } = useTranslation('tabs');
  const { t: tHotel } = useTranslation('hotel');
  const theme = useAppTheme();
  const player = useAuthStore((s) => s.player);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const convertAccount = useAuthStore((s) => s.convertAccount);
  const isTemporary = player?.isTemporary ?? false;
  const playerLevel = useGameStore((s) => s.playerLevel);
  const playerXp = useGameStore((s) => s.playerXp);
  const gems = useGameStore((s) => s.gems);
  const balance = useGameStore((s) => s.balance);
  const isHydrated = useGameStore((s) => s.isHydrated);
  const commandQueue = useGameStore((s) => s.commandQueue);
  const commandQueueLength = commandQueue.length;
  const lastSyncAt = useGameStore((s) => s.lastSyncAt);
  const categoryProgress = useGameStore((s) => s.categoryProgress);
  const failedCommandLog = useGameStore((s) => s.failedCommandLog);
  const clearFailedCommandLog = useGameStore((s) => s.clearFailedCommandLog);
  const workers = useGameStore((s) => s.workers);
  const dailyTasks = useGameStore((s) => s.dailyTasks);
  const floors = useGameStore((s) => s.floors);
  const floorStars = useGameStore((s) => s.floorStars);
  const openedFloorTypes = useGameStore((s) => s.openedFloorTypes);
  const tokens = useGameStore((s) => s.tokens);
  const businessUpgrades = useGameStore((s) => s.businessUpgrades);
  const xpNeeded = xpForLevel(playerLevel);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const SETTINGS_SHEET_HEIGHT = Dimensions.get('window').height * 0.6;
  const settingsTranslateY = useSharedValue(SETTINGS_SHEET_HEIGHT);
  const settingsScrimOpacity = useSharedValue(0);

  useEffect(() => {
    if (settingsVisible) {
      settingsTranslateY.value = withTiming(0, { duration: 380 });
      settingsScrimOpacity.value = withTiming(1, { duration: 360 });
    } else {
      settingsTranslateY.value = withTiming(SETTINGS_SHEET_HEIGHT, { duration: 320 });
      settingsScrimOpacity.value = withTiming(0, { duration: 300 });
    }
  }, [settingsVisible]);

  const closeSettings = () => setSettingsVisible(false);

  const settingsPanGesture = Gesture.Pan()
    .enabled(settingsVisible)
    .onUpdate((e) => {
      if (e.translationY > 0) {
        settingsTranslateY.value = e.translationY;
        settingsScrimOpacity.value = 1 - e.translationY / SETTINGS_SHEET_HEIGHT;
      }
    })
    .onEnd((e) => {
      if (e.translationY > 100 || e.velocityY > 500) {
        settingsTranslateY.value = withTiming(SETTINGS_SHEET_HEIGHT, { duration: 280 });
        settingsScrimOpacity.value = withTiming(0, { duration: 260 });
        runOnJS(closeSettings)();
      } else {
        settingsTranslateY.value = withSpring(0, { damping: 20, stiffness: 200 });
        settingsScrimOpacity.value = withTiming(1, { duration: 200 });
      }
    });

  const settingsScrimStyle = useAnimatedStyle(() => ({ opacity: settingsScrimOpacity.value }));
  const settingsSheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: settingsTranslateY.value }] }));
  const liftSimplifiedRewards = useSettingsStore((s) => s.liftSimplifiedRewards);
  const setLiftSimplifiedRewards = useSettingsStore((s) => s.setLiftSimplifiedRewards);
  const totalWorkers = workers.length;
  const happyCount = workers.filter((w) => {
    if (w.assignedFloorId === null) return false;
    const staticFloor = gameConfig.floors.find((f) => f.id === w.assignedFloorId);
    const floorType = staticFloor ? staticFloor.floorType : (openedFloorTypes[String(w.assignedFloorId)] ?? '');
    const floor = floors.find((f) => f.id === w.assignedFloorId);
    const production = floor?.productions[w.assignedSlotIdx!];
    return getWorkerMood(w, floorType, production?.typeId ?? null) === 'good';
  }).length;
  const specialistCount = workers.filter((w) => w.isSpecialist).length;
  const totalEarnedLevels = ACHIEVEMENT_CATEGORIES.reduce(
    (sum, cat) => sum + (categoryProgress[cat.key]?.currentLevel ?? 0),
    0,
  );
  const now = useGameClock(10_000);

  const pendingCount = useFriendStore(s => s.pendingCount);
  const fetchIncoming = useFriendStore(s => s.fetchIncoming);

  const unreadMailCount = useMailStore(s => s.unreadCount);
  const fetchUnreadCount = useMailStore(s => s.fetchUnreadCount);
  const fetchBlocked = useBlockStore(s => s.fetchBlocked);

  const BUSINESS_TYPE_COLORS: Record<string, string> = {
    green: '#3FA535', blue: '#3376E5', yellow: '#E5A72E', purple: '#9A6FD0', red: '#E05A4A',
  };
  const BUSINESS_FLOOR_TYPES = ['green', 'blue', 'yellow', 'purple', 'red'] as const;
  const upgradeReadyTypes = BUSINESS_FLOOR_TYPES.filter((ft) => {
    const level = businessUpgrades?.[ft] ?? 0;
    if (level >= 40) return false;
    const cost = BUSINESS_UPGRADE_COSTS[level];
    if (!cost) return false;
    if (cost.kind === 'gems') return gems >= cost.gems;
    return balance >= cost.coins && (tokens?.[ft] ?? 0) >= cost.tokens;
  });

  const coinBonusPercent = useGameStore((s) => s.coinBonusPercent);

  const floorCount = floors.length;
  const totalStars = Object.values(floorStars ?? {}).reduce((s, v) => s + v, 0);
  const avgStars = floorCount > 0 ? totalStars / floorCount : 0;

  const revenuePerMin = useMemo(
    () => calcRevenuePerMin(floors, workers, openedFloorTypes ?? {}, gameConfig, now, businessUpgrades, coinBonusPercent, floorStars),
    [floors, workers, openedFloorTypes, now, businessUpgrades, coinBonusPercent, floorStars],
  );

  const [myProfile, setMyProfile] = useState<PlayerProfile | null>(null);
  useFocusEffect(useCallback(() => {
    if (!player?.id) return;
    let cancelled = false;
    api.getPlayerProfile(player.id)
      .then((p) => { if (!cancelled) setMyProfile(p); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [player?.id]));

  useFocusEffect(useCallback(() => {
    fetchIncoming();
    fetchUnreadCount();
    fetchBlocked();
  }, [fetchIncoming, fetchUnreadCount, fetchBlocked]));

  const daysInGame = myProfile
    ? Math.floor((Date.now() - new Date(myProfile.createdAt).getTime()) / 86_400_000)
    : null;

  const [syncExpanded, setSyncExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertEmail, setConvertEmail] = useState('');
  const [convertPassword, setConvertPassword] = useState('');
  const [convertName, setConvertName] = useState(player?.playerName ?? '');
  const [convertError, setConvertError] = useState('');
  const [convertLoading, setConvertLoading] = useState(false);

  const handleConvert = async () => {
    if (!convertEmail.trim() || !convertPassword.trim() || !convertName.trim()) {
      setConvertError(t('profile.convert.errorFillAll'));
      return;
    }
    if (convertPassword.length < 6) {
      setConvertError(t('profile.convert.errorPasswordShort'));
      return;
    }
    setConvertLoading(true);
    setConvertError('');
    try {
      await convertAccount(convertEmail.trim(), convertPassword, convertName.trim());
      setConvertOpen(false);
    } catch (e) {
      setConvertError(e instanceof Error ? e.message : t('profile.convert.errorGeneric'));
    } finally {
      setConvertLoading(false);
    }
  };

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
    <AppBackground style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <FloorStarsRow avg={isHydrated ? avgStars : 0} />
          <View style={styles.profileRow}>
            <Image
              source={getUserIcon(playerLevel)}
              style={styles.avatar}
              contentFit="cover"
            />
            <View style={styles.profileInfo}>
              <Text style={[styles.name, { color: theme.text }]}>{player?.playerName ?? t('profile.guestFallbackName')}</Text>
              <Text style={[styles.email, { color: theme.textMuted }]}>{player?.email ?? ''}</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <View style={styles.statValueRow}>
                {isHydrated
                  ? <Text style={[styles.levelValue, { color: theme.text }]}>{playerLevel}</Text>
                  : <SkeletonBox width={40} height={36} />}
                <Image source={require('../../assets/img/lvlIcon.png')} style={styles.statIcon} contentFit="contain" />
              </View>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.divider }]} />
            <View style={styles.statItemXp}>
              <View style={styles.statValueRow}>
                {isHydrated
                  ? <Text style={[styles.statValue, { color: theme.text }]}>{formatCompact(playerXp)} / {formatCompact(xpNeeded)}</Text>
                  : <SkeletonBox width={90} />}
                <Image source={require('../../assets/img/xpIcon.png')} style={styles.statIcon} contentFit="contain" />
              </View>
            </View>
          </View>

          <View style={styles.xpBarContainer}>
            <View style={[styles.xpBarFill, { width: isHydrated ? `${Math.min((playerXp / xpNeeded) * 100, 100)}%` : '0%' }]} />
          </View>

          {isAuthenticated && (
            <>
              <View style={styles.currencyRow}>
                <View style={styles.currencyItem}>
                  <CoinIcon size={18} />
                  {isHydrated
                    ? <Text style={styles.currencyValue}>{formatNum(balance)}</Text>
                    : <SkeletonBox width={60} />}
                </View>
                <View style={styles.currencyItem}>
                  <GemIcon size={16} />
                  {isHydrated
                    ? <Text style={styles.currencyValueGem}>{formatNum(gems)}</Text>
                    : <SkeletonBox width={40} />}
                </View>
              </View>

              <View style={[styles.workerStatsDivider, { backgroundColor: theme.divider }]} />
              <View style={styles.workerStatsRow}>
                <View style={styles.workerStatItem}>
                  <Image source={require('../../assets/img/happySmile.png')} style={styles.workerStatIcon} contentFit="contain" />
                  <View style={styles.workerStatTextCol}>
                    <Text style={[styles.workerStatLabel, { color: theme.textMuted }]}>{t('profile.stats.happy')}</Text>
                    {isHydrated
                      ? <Text style={[styles.workerStatValue, { color: theme.text }]}>{happyCount}/{totalWorkers}</Text>
                      : <SkeletonBox width={36} />}
                  </View>
                </View>
                <View style={styles.workerStatItem}>
                  <Image source={require('../../assets/img/specialistWorker.png')} style={styles.workerStatIcon} contentFit="contain" />
                  <View style={styles.workerStatTextCol}>
                    <Text style={[styles.workerStatLabel, { color: theme.textMuted }]}>{t('profile.stats.specialists')}</Text>
                    {isHydrated
                      ? <Text style={[styles.workerStatValue, { color: theme.text }]}>{specialistCount}/{totalWorkers}</Text>
                      : <SkeletonBox width={36} />}
                  </View>
                </View>
              </View>

              {isHydrated && (
                <>
                  <View style={[styles.workerStatsDivider, { backgroundColor: theme.divider }]} />
                  <View style={styles.revenueRow}>
                    <View style={styles.revenueItem}>
                      <Image source={COIN_ICON} style={styles.revenueIcon} contentFit="contain" />
                      <View style={styles.workerStatTextCol}>
                        <Text style={[styles.workerStatLabel, { color: theme.textMuted }]}>Current / min</Text>
                        <Text style={[styles.workerStatValue, { color: theme.text }]}>{formatNumFull(revenuePerMin)}</Text>
                      </View>
                    </View>
                    <View style={[styles.workerStatsDivider, { backgroundColor: theme.divider, width: 1, height: 32, marginTop: 0 }]} />
                    <View style={styles.revenueItem}>
                      <Image source={BEST_RPM_ICON} style={styles.revenueIcon} contentFit="contain" />
                      <View style={styles.workerStatTextCol}>
                        <Text style={[styles.workerStatLabel, { color: theme.textMuted }]}>Best / min</Text>
                        <Text style={[styles.workerStatValue, { color: '#3FA535' }]}>{myProfile ? formatNumFull(Math.max(myProfile.maxRevenuePerMin, revenuePerMin)) : '—'}</Text>
                      </View>
                    </View>
                  </View>
                </>
              )}
            </>
          )}
        </View>

        <Pressable
          onPress={() => router.push('/daily-tasks')}
          style={({ pressed }) => [styles.achievementsButton, { backgroundColor: theme.surface }, pressed && styles.achievementsButtonPressed]}
        >
          <Image source={require('../../assets/img/profile/dayliQuests.png')} style={styles.achievementsIcon} />
          <View style={styles.menuTextCol}>
            <Text style={[styles.menuTitle, { color: theme.text }]}>
              {tHotel('dailyTasks.title')}{' '}
              <Text style={[styles.achievementsButtonSubText, { color: theme.text }]}>
                ({dailyTasks.claimed.filter(k => DAILY_TASKS.find(t => t.key === k && !t.hidden)).length}/{DAILY_TASKS.filter(t => !t.hidden).length})
              </Text>
            </Text>
            <Text style={[styles.menuSub, { color: theme.textMuted }]}>Complete missions for rewards</Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => router.push('/my-mail')}
          style={({ pressed }) => [styles.achievementsButton, { backgroundColor: theme.surface }, pressed && styles.achievementsButtonPressed]}
        >
          <Image source={require('../../assets/img/mail.png')} style={styles.achievementsIcon} />
          <View style={styles.menuTextCol}>
            <Text style={[styles.menuTitle, { color: theme.text }]}>My Mail</Text>
            <Text style={[styles.menuSub, { color: theme.textMuted }]}>Messages from other players</Text>
          </View>
          {unreadMailCount > 0 && (
            <View style={styles.friendsBadge}>
              <Text style={styles.friendsBadgeText}>{unreadMailCount}</Text>
            </View>
          )}
        </Pressable>

        <Pressable
          onPress={() => router.push('/my-friends')}
          style={({ pressed }) => [styles.achievementsButton, { backgroundColor: theme.surface }, pressed && styles.achievementsButtonPressed]}
        >
          <Image source={require('../../assets/img/users.png')} style={styles.achievementsIcon} />
          <View style={styles.menuTextCol}>
            <Text style={[styles.menuTitle, { color: theme.text }]}>My Friends</Text>
            <Text style={[styles.menuSub, { color: theme.textMuted }]}>Manage your friend list</Text>
          </View>
          {pendingCount > 0 && (
            <View style={styles.friendsBadge}>
              <Text style={styles.friendsBadgeText}>{pendingCount}</Text>
            </View>
          )}
        </Pressable>

        <Pressable
          onPress={() => router.push('/my-business')}
          style={({ pressed }) => [styles.achievementsButton, { backgroundColor: theme.surface }, pressed && styles.achievementsButtonPressed]}
        >
          <Image source={require('../../assets/img/profile/myBusiness.png')} style={styles.achievementsIcon} />
          <View style={styles.menuTextCol}>
            <Text style={[styles.menuTitle, { color: theme.text }]}>{tHotel('myBusiness.title')}</Text>
            <Text style={[styles.menuSub, { color: theme.textMuted }]}>Upgrade your businesses</Text>
          </View>
          {isHydrated && upgradeReadyTypes.length > 0 && (
            <View style={styles.businessDotsRow}>
              {upgradeReadyTypes.map((ft) => (
                <View key={ft} style={[styles.businessDot, { backgroundColor: BUSINESS_TYPE_COLORS[ft] }]} />
              ))}
            </View>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.achievementsButton, { backgroundColor: theme.surface }, pressed && styles.achievementsButtonPressed]}
        >
          <Image source={require('../../assets/img/TrucksProfileIcon.png')} style={styles.achievementsIcon} />
          <View style={styles.menuTextCol}>
            <Text style={[styles.menuTitle, { color: theme.text }]}>Autopark</Text>
            <Text style={[styles.menuSub, { color: theme.textMuted }]}>Manage your vehicles</Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => router.push('/achievements')}
          style={({ pressed }) => [styles.achievementsButton, { backgroundColor: theme.surface }, pressed && styles.achievementsButtonPressed]}
        >
          <Image source={require('../../assets/img/profile/achivProfileIcon.png')} style={styles.achievementsIcon} />
          <View style={styles.menuTextCol}>
            <Text style={[styles.menuTitle, { color: theme.text }]}>
              {t('profile.achievements', { count: totalEarnedLevels })}
            </Text>
            <Text style={[styles.menuSub, { color: theme.textMuted }]}>Track your progress</Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => router.push('/referrals')}
          style={({ pressed }) => [styles.achievementsButton, { backgroundColor: theme.surface }, pressed && styles.achievementsButtonPressed]}
        >
          <Image source={require('../../assets/img/profile/ReferralProfileIcon.png')} style={styles.achievementsIcon} />
          <View style={styles.menuTextCol}>
            <Text style={[styles.menuTitle, { color: theme.text }]}>Referrals</Text>
            <Text style={[styles.menuSub, { color: theme.textMuted }]}>Invite friends for bonuses</Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => setSettingsVisible(true)}
          style={({ pressed }) => [styles.achievementsButton, { backgroundColor: theme.surface }, pressed && styles.achievementsButtonPressed]}
        >
          <Image source={require('../../assets/img/settingsIcon.png')} style={styles.achievementsIcon} />
          <View style={styles.menuTextCol}>
            <Text style={[styles.menuTitle, { color: theme.text }]}>{t('profile.settings.title')}</Text>
            <Text style={[styles.menuSub, { color: theme.textMuted }]}>App preferences</Text>
          </View>
        </Pressable>

        {isTemporary && (
          <Pressable
            onPress={() => setConvertOpen(true)}
            style={({ pressed }) => [styles.convertBanner, pressed && { opacity: 0.88 }]}
          >
            <Text style={styles.convertBannerTitle}>{t('profile.convert.bannerTitle')}</Text>
            <Text style={styles.convertBannerSub}>{t('profile.convert.bannerSub')}</Text>
          </Pressable>
        )}

        <Pressable onPress={handleLogout} style={({ pressed }) => [
          styles.logoutButton,
          { backgroundColor: theme.surface },
          pressed && styles.logoutPressed,
        ]}>
          <Text style={styles.logoutText}>{t('profile.logout')}</Text>
        </Pressable>

        <Modal visible={convertOpen} transparent animationType="fade" onRequestClose={() => setConvertOpen(false)}>
          <KeyboardAvoidingView style={styles.convertOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <Pressable style={styles.convertBackdrop} onPress={() => setConvertOpen(false)} />
            <View style={[styles.convertCard, { backgroundColor: theme.surface }]}>
              <Text style={[styles.convertTitle, { color: theme.text }]}>{t('profile.convert.title')}</Text>
              <Text style={[styles.convertSub, { color: theme.textMuted }]}>{t('profile.convert.subtitle')}</Text>

              {convertError ? <Text style={styles.convertErrorText}>{convertError}</Text> : null}

              <Text style={[styles.convertLabel, { color: theme.textMuted }]}>{t('profile.convert.labelName')}</Text>
              <TextInput
                style={[styles.convertInput, { borderColor: theme.divider, color: theme.text, backgroundColor: theme.surfaceSub }]}
                value={convertName}
                onChangeText={setConvertName}
                autoCapitalize="words"
                editable={!convertLoading}
              />

              <Text style={[styles.convertLabel, { color: theme.textMuted }]}>{t('profile.convert.labelEmail')}</Text>
              <TextInput
                style={[styles.convertInput, { borderColor: theme.divider, color: theme.text, backgroundColor: theme.surfaceSub }]}
                value={convertEmail}
                onChangeText={setConvertEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!convertLoading}
              />

              <Text style={[styles.convertLabel, { color: theme.textMuted }]}>{t('profile.convert.labelPassword')}</Text>
              <TextInput
                style={[styles.convertInput, { borderColor: theme.divider, color: theme.text, backgroundColor: theme.surfaceSub }]}
                value={convertPassword}
                onChangeText={setConvertPassword}
                secureTextEntry
                editable={!convertLoading}
              />

              <Pressable onPress={handleConvert} disabled={convertLoading} style={styles.convertSubmit}>
                {convertLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.convertSubmitText}>{t('profile.convert.submit')}</Text>
                }
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Settings bottom sheet */}
        <Modal
          visible={settingsVisible}
          transparent
          animationType="none"
          onRequestClose={closeSettings}
        >
          <GestureHandlerRootView style={settingsStyles.overlay}>
            <Animated.View style={[settingsStyles.scrim, settingsScrimStyle]}>
              <Pressable style={StyleSheet.absoluteFill} onPress={closeSettings} />
            </Animated.View>
            <GestureDetector gesture={settingsPanGesture}>
              <Animated.View
                style={[settingsStyles.sheet, { backgroundColor: theme.surface }, settingsSheetStyle]}
              >
                <View style={settingsStyles.handle} />
                <Text style={[settingsStyles.title, { color: theme.text }]}>{t('profile.settings.title')}</Text>

                <Text style={[settingsStyles.sectionHeader, { color: theme.textMuted }]}>
                  {t('profile.settings.liftSection')}
                </Text>

                <View style={[settingsStyles.row, { borderBottomColor: theme.divider }]}>
                  <View style={settingsStyles.rowLeft}>
                    <Text style={[settingsStyles.rowTitle, { color: theme.text }]}>
                      {t('profile.settings.simplifiedRewards')}
                    </Text>
                    <Text style={[settingsStyles.rowDesc, { color: theme.textMuted }]}>
                      {t('profile.settings.simplifiedRewardsDesc')}
                    </Text>
                  </View>
                  <Switch
                    value={liftSimplifiedRewards}
                    onValueChange={setLiftSimplifiedRewards}
                    trackColor={{ true: '#72C24F', false: undefined }}
                    thumbColor="#fff"
                  />
                </View>
              </Animated.View>
            </GestureDetector>
          </GestureHandlerRootView>
        </Modal>

        {/* Sync status card */}
        <Pressable
          onPress={() => hasExpandContent && setSyncExpanded((v) => !v)}
          style={({ pressed }) => [styles.syncCard, { backgroundColor: theme.surface }, pressed && hasExpandContent && styles.syncCardPressed]}
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
              <SyncIcon color={theme.textMuted} />
              <Text style={[styles.syncTime, { color: theme.textMuted }]}>{formatSyncTime(lastSyncAt, now)}</Text>
            </View>
            {hasExpandContent && (
              <View style={styles.chevron}>
                <ChevronIcon expanded={syncExpanded} />
              </View>
            )}
          </View>

          {daysInGame !== null && (
            <>
              <View style={[styles.syncDivider, { backgroundColor: theme.divider }]} />
              <ProfileInfoRow
                icons={[SAND_CLOCK]}
                label="Days in game"
                value={daysInGame === 0 ? '<1' : String(daysInGame)}
                theme={theme}
                noBorder
                compact
              />
            </>
          )}

          {syncExpanded && (
            <View style={[styles.syncDropdown, { borderTopColor: theme.divider }]}>

              {/* Pending commands */}
              {commandQueueLength > 0 && (
                <View style={styles.dropSection}>
                  <Text style={[styles.dropSectionTitle, { color: theme.textMuted }]}>
                    {t('profile.sync.pendingDetail', { count: commandQueueLength })}
                  </Text>
                  {pendingGroups.map(({ type, count }) => (
                    <View key={type} style={styles.dropRow}>
                      <Text style={[styles.dropRowBullet, { color: theme.textMuted }]}>•</Text>
                      <Text style={[styles.dropRowText, { color: theme.text }]}>
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
                    <Text style={[styles.dropSectionTitle, { color: theme.textMuted }]}>
                      {t('profile.sync.failedCount', { count: failedCommandLog.length })}
                    </Text>
                    <View style={styles.dropActions}>
                      <Pressable
                        onPress={handleCopy}
                        style={({ pressed }) => [styles.dropActionBtn, { backgroundColor: theme.surfaceSub }, pressed && styles.dropActionBtnPressed]}
                      >
                        <Text style={[styles.dropActionText, { color: theme.textMuted }]}>{copied ? t('profile.sync.copied') : t('profile.sync.copy')}</Text>
                      </Pressable>
                      <Pressable
                        onPress={clearFailedCommandLog}
                        style={({ pressed }) => [styles.dropActionBtn, styles.dropActionBtnDanger, { backgroundColor: theme.surfaceDanger }, pressed && styles.dropActionBtnPressed]}
                      >
                        <Text style={[styles.dropActionText, styles.dropActionTextDanger]}>{t('profile.sync.clear')}</Text>
                      </Pressable>
                    </View>
                  </View>
                  {reversedFailLog.map((entry) => (
                    <View key={entry.id} style={styles.dropRow}>
                      <Text style={[styles.dropRowBullet, { color: theme.textMuted }]}>•</Text>
                      <View style={styles.dropRowContent}>
                        <Text style={[styles.dropRowText, { color: theme.text }]} numberOfLines={1}>
                          {commandLabel(entry.type)}
                          <Text style={styles.dropRowError}> — {friendlyError(entry.error)}</Text>
                        </Text>
                        <Text style={[styles.dropRowTime, { color: theme.textMuted }]}>{formatSyncTime(entry.timestamp, now)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

            </View>
          )}
        </Pressable>
      </ScrollView>
    </AppBackground>
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
    paddingHorizontal: 15,
    paddingTop: 28,
    paddingBottom: 18,
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
    marginTop: 16,
    gap: 18,
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
  statIcon: {
    width: 28,
    height: 28,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 18,
    color: '#27331F',
  },
  levelValue: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 36,
    color: '#27331F',
    lineHeight: 36,
    marginTop: 6,
  },
  statLabel: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 12,
    color: '#7C8A6E',
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E4E1D3',
  },
  xpBarContainer: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(60,120,40,0.12)',
    marginTop: 12,
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
    marginTop: 12,
  },
  currencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  currencyValue: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 18,
    color: '#C28A22',
  },
  currencyValueGem: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 18,
    color: '#2592AB',
  },
  workerStatsDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#E4E1D3',
    marginTop: 12,
  },
  workerStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    marginTop: 10,
  },
  workerStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  workerStatIcon: {
    width: 36,
    height: 36,
  },
  workerStatTextCol: {
    gap: 2,
  },
  workerStatValue: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 18,
    color: '#27331F',
  },
  workerStatLabel: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 12,
    color: '#7C8A6E',
  },
  revenueRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    marginTop: 10,
    gap: 12,
    alignItems: 'center',
  },
  revenueItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  revenueIcon: {
    width: 30,
    height: 30,
  },
  syncDivider: {
    height: 1,
    marginTop: 8,
  },
  syncCard: {
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 14,
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
    paddingVertical: 10,
    paddingLeft: 15,
    paddingRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: 'rgba(60,80,45,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  achievementsButtonPressed: { opacity: 0.7 },
  businessDotsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 2 },
  businessDot: { width: 8, height: 8, borderRadius: 4 },
  achievementsIcon: {
    width: 38,
    height: 38,
    flexShrink: 0,
  },
  menuTextCol: {
    flex: 1,
    gap: 1,
  },
  menuTitle: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 16,
    color: '#27331F',
  },
  menuSub: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: '#7C8A6E',
  },
  achievementsButtonText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 16,
    color: '#27331F',
  },
  achievementsButtonSubText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 14,
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
  convertBanner: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#3FA535',
  },
  convertBannerTitle: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 16,
    color: '#fff',
    marginBottom: 3,
  },
  convertBannerSub: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.85)',
  },
  convertOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  convertBackdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  convertCard: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  convertTitle: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 22,
    textAlign: 'center',
    marginBottom: 4,
  },
  convertSub: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 18,
  },
  convertErrorText: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 13,
    color: '#C62828',
    textAlign: 'center',
    marginBottom: 12,
  },
  convertLabel: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 13,
    marginBottom: 5,
    marginTop: 10,
  },
  convertInput: {
    height: 48,
    borderRadius: 13,
    borderWidth: 2,
    paddingHorizontal: 14,
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 15,
  },
  convertSubmit: {
    marginTop: 20,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#3FA535',
    alignItems: 'center',
    justifyContent: 'center',
  },
  convertSubmitText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 17,
    color: '#fff',
  },
  friendsBadge: {
    backgroundColor: '#E05A4A',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  friendsBadgeText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 12,
    color: '#fff',
  },
});

const settingsStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18,26,44,0.45)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(90,100,120,0.25)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  title: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 20,
    marginBottom: 20,
  },
  sectionHeader: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  rowLeft: {
    flex: 1,
    gap: 3,
  },
  rowTitle: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
  },
  rowDesc: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 12.5,
    lineHeight: 17,
  },
});

import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, ImageBackground,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../src/stores/gameStore';
import {
  DAILY_TASKS, getCoinMultiplier, getMaterialCount, getTaskProgress,
} from '../shared/config/dailyTasksConfig';
import { formatNum } from '../src/utils/format';

const TOKEN_COLORS: Record<string, string> = {
  green: '#3FA535', blue: '#3376E5', yellow: '#E5A72E', purple: '#9A6FD0', red: '#E05A4A',
};

// TODO: replace with actual token icons once assets/img/tokens/ directory is populated
const TOKEN_ICON_PLACEHOLDER = require('../assets/img/diamond.png');
const TOKEN_ICONS: Record<string, ReturnType<typeof require>> = {
  green:  TOKEN_ICON_PLACEHOLDER,
  blue:   TOKEN_ICON_PLACEHOLDER,
  yellow: TOKEN_ICON_PLACEHOLDER,
  purple: TOKEN_ICON_PLACEHOLDER,
  red:    TOKEN_ICON_PLACEHOLDER,
};

const DIAMOND_ICON = require('../assets/img/diamond.png');
const COIN_ICON = require('../assets/img/coin.png');

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0h 0m';
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m}m`;
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(value / max, 1);
  return (
    <View style={styles.barBg}>
      <View style={[styles.barFill, { width: `${pct * 100}%` }]} />
    </View>
  );
}

export default function DailyTasksScreen() {
  const { t } = useTranslation('hotel');
  const tokens             = useGameStore((s) => s.tokens);
  const dailyTasks         = useGameStore((s) => s.dailyTasks);
  const lastDailyReset     = useGameStore((s) => s.lastDailyReset);
  const dailyGemsCollected = useGameStore((s) => s.dailyGemsCollected);
  const claimDailyTask     = useGameStore((s) => s.claimDailyTask);
  const playerLevel        = useGameStore((s) => s.playerLevel);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const resetAt = lastDailyReset + 24 * 60 * 60 * 1000;
  const msUntilReset = resetAt - now;

  const handleClaim = useCallback((taskKey: string) => {
    claimDailyTask(taskKey);
  }, [claimDailyTask]);

  const multiplier = getCoinMultiplier(playerLevel);
  const matCount = getMaterialCount(playerLevel);

  return (
    <ImageBackground
      source={require('../assets/welcome-bg.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>{t('dailyTasks.title')}</Text>

        {/* Token balance */}
        <View style={styles.tokenRow}>
          {(['green', 'blue', 'yellow', 'purple', 'red'] as const).map((color) => (
            <View key={color} style={styles.tokenChip}>
              <Image source={TOKEN_ICONS[color]} style={styles.tokenIcon} contentFit="contain" />
              <Text style={[styles.tokenCount, { color: TOKEN_COLORS[color] }]}>
                {tokens[color]}
              </Text>
            </View>
          ))}
        </View>

        {/* Timer */}
        <Text style={styles.timer}>
          {t('dailyTasks.resetsIn', { time: formatCountdown(msUntilReset) })}
        </Text>

        {/* Double reward banner */}
        {dailyTasks.doubleRewardActive && (
          <View style={styles.doubleBanner}>
            <Text style={styles.doubleBannerText}>{t('dailyTasks.doubleReward')}</Text>
          </View>
        )}

        {/* Task cards */}
        {DAILY_TASKS.filter((task) => !task.hidden).map((task) => {
          const progress = getTaskProgress({ dailyGemsCollected, dailyTasks }, task);
          const completed = progress >= task.threshold;
          const claimed = dailyTasks.claimed.includes(task.key);
          const coins = task.rewards.baseCoins * multiplier * (dailyTasks.doubleRewardActive ? 2 : 1);

          return (
            <View key={task.key} style={[styles.card, claimed && styles.cardClaimed]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, claimed && styles.cardTitleClaimed]}>
                  {task.title}
                </Text>
                {claimed && <Text style={styles.claimedCheck}>✓</Text>}
              </View>

              <ProgressBar value={progress} max={task.threshold} />

              <View style={styles.progressRow}>
                <Text style={styles.progressText}>
                  {t('dailyTasks.progress', {
                    current: Math.min(progress, task.threshold),
                    total: task.threshold,
                  })}
                </Text>
              </View>

              {!claimed && (
                <View style={styles.rewardRow}>
                  <View style={styles.rewardChip}>
                    <Image source={COIN_ICON} style={styles.rewardIcon} contentFit="contain" />
                    <Text style={styles.rewardCoins}>+{formatNum(coins)}</Text>
                  </View>
                  <View style={styles.rewardChip}>
                    <Image source={DIAMOND_ICON} style={styles.rewardIcon} contentFit="contain" />
                    <Text style={styles.rewardGems}>+{task.rewards.gems}</Text>
                  </View>
                  {task.rewards.hasMaterials && (
                    <View style={styles.rewardChip}>
                      <Text style={styles.rewardMat}>
                        +{matCount * (dailyTasks.doubleRewardActive ? 2 : 1)} 🧱
                      </Text>
                    </View>
                  )}
                  <View style={styles.rewardChip}>
                    <Text style={styles.rewardToken}>+1–5 🎲</Text>
                  </View>
                </View>
              )}

              {completed && !claimed && (
                <Pressable
                  onPress={() => handleClaim(task.key)}
                  style={({ pressed }) => [styles.collectBtn, pressed && { opacity: 0.8 }]}
                >
                  <LinearGradient colors={['#74D44F', '#5BA63C']} style={styles.collectGradient}>
                    <Text style={styles.collectText}>{t('dailyTasks.collect')}</Text>
                  </LinearGradient>
                </Pressable>
              )}
            </View>
          );
        })}
      </ScrollView>

      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.closeBtnText}>✕</Text>
      </Pressable>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingTop: 64, paddingHorizontal: 16, paddingBottom: 120, gap: 12 },
  heading: { fontFamily: 'Fredoka_700Bold', fontSize: 28, color: '#27331F', marginBottom: 4 },

  tokenRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  tokenChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  tokenIcon: { width: 18, height: 18 },
  tokenCount: { fontFamily: 'Fredoka_700Bold', fontSize: 15 },

  timer: { fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: '#9BA3B0', marginBottom: 4 },

  doubleBanner: { backgroundColor: '#FFF4D6', borderRadius: 14, padding: 10, alignItems: 'center', marginBottom: 4 },
  doubleBannerText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 14, color: '#B07A00' },

  card: { backgroundColor: '#fff', borderRadius: 20, padding: 16, gap: 10, shadowColor: 'rgba(60,80,45,1)', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  cardClaimed: { opacity: 0.55 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontFamily: 'Fredoka_600SemiBold', fontSize: 16, color: '#27331F', flex: 1 },
  cardTitleClaimed: { color: '#9BA3B0' },
  claimedCheck: { fontSize: 18, color: '#3FA535' },

  barBg: { height: 7, borderRadius: 4, backgroundColor: 'rgba(63,165,53,0.15)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, backgroundColor: '#3FA535' },

  progressRow: { alignItems: 'flex-end' },
  progressText: { fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: '#7C8A6E' },

  rewardRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  rewardChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F4F8F2', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  rewardIcon: { width: 14, height: 14 },
  rewardCoins: { fontFamily: 'Fredoka_600SemiBold', fontSize: 13, color: '#C28A22' },
  rewardGems: { fontFamily: 'Fredoka_600SemiBold', fontSize: 13, color: '#2592AB' },
  rewardMat: { fontFamily: 'Fredoka_600SemiBold', fontSize: 13, color: '#6B7A5E' },
  rewardToken: { fontFamily: 'Fredoka_600SemiBold', fontSize: 13, color: '#7A6B9E' },

  collectBtn: { borderRadius: 12, overflow: 'hidden' },
  collectGradient: { alignItems: 'center', paddingVertical: 10 },
  collectText: { fontFamily: 'Fredoka_700Bold', fontSize: 16, color: '#fff' },

  closeBtn: { position: 'absolute', bottom: 40, alignSelf: 'center', width: 56, height: 56, borderRadius: 28, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 20, color: '#fff', lineHeight: 22 },
});

import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, useColorScheme,
} from 'react-native';
import AppBackground from '../src/components/AppBackground';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { InfoSection } from '../src/components/InfoSection';
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

const TASK_ICONS: Partial<Record<string, ReturnType<typeof require>>> = {
  transporter:     require('../assets/img/daily/dailytransporter.png'),
  vip_transporter: require('../assets/img/daily/dailyvip_transporte.png'),
  wholesale:       require('../assets/img/daily/dailywholesale.png'),
  new_residents:   require('../assets/img/daily/dailynew_residents.png'),
  easy_money:      require('../assets/img/daily/dailyeasy_money.png'),
  money_collector: require('../assets/img/daily/dailymoney_collector.png'),
  build_floor:     require('../assets/img/daily/dailybuild_floor.png'),
  hasta_la_vista:  require('../assets/img/daily/dailyhasta_la_vista.png'),
  goods_to_sell:   require('../assets/img/daily/dailygoods_to_sell.png'),
  investor:        require('../assets/img/daily/dailyinvestor.png'),
  major_investor:  require('../assets/img/daily/dailymajor_investor.png'),
};

const TOKEN_ICONS: Record<string, ReturnType<typeof require>> = {
  green:  require('../assets/img/tokens/tokenGreen.png'),
  blue:   require('../assets/img/tokens/tokenBlue.png'),
  yellow: require('../assets/img/tokens/tokenYellow.png'),
  purple: require('../assets/img/tokens/tokenViolet.png'),
  red:    require('../assets/img/tokens/tokenRed.png'),
};

const DIAMOND_ICON = require('../assets/img/diamond.png');
const COIN_ICON    = require('../assets/img/coin.png');

const MATERIAL_ICONS: Record<string, ReturnType<typeof require>> = {
  briks: require('../assets/img/tools/briks.png'),
  glass: require('../assets/img/tools/glass.png'),
  nails: require('../assets/img/tools/nails.png'),
  screw: require('../assets/img/tools/screw.png'),
};

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

  const isDark = useColorScheme() === 'dark';
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const [infoVisible, setInfoVisible] = useState(false);

  const resetAt     = lastDailyReset + 24 * 60 * 60 * 1000;
  const msUntilReset = resetAt - now;

  const handleClaim = useCallback((taskKey: string, taskTitle: string) => {
    claimDailyTask(taskKey, taskTitle);
  }, [claimDailyTask]);

  const multiplier = getCoinMultiplier(playerLevel);
  const matCount   = getMaterialCount(playerLevel);

  return (
    <AppBackground style={styles.container}>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headingRow}>
          <Text style={[styles.heading, isDark && { color: '#DDE8D8' }]}>{t('dailyTasks.title')}</Text>
          <Pressable onPress={() => setInfoVisible(true)} hitSlop={10}>
            <Image
              source={require('../assets/img/InformationIcon.png')}
              style={styles.infoIcon}
            />
          </Pressable>
        </View>

        <View style={styles.tokenRow}>
          {(['green', 'blue', 'yellow', 'purple', 'red'] as const).map((color) => (
            <View key={color} style={[styles.tokenChip, isDark && { backgroundColor: 'rgba(52,55,52,0.97)' }]}>
              <Image source={TOKEN_ICONS[color]} style={styles.tokenIcon} contentFit="contain" />
              <Text style={[styles.tokenCount, { color: TOKEN_COLORS[color] }]}>
                {tokens[color]}
              </Text>
            </View>
          ))}
        </View>

        {(() => {
          const visibleTasks  = DAILY_TASKS.filter((task) => !task.hidden);
          const claimedCount  = visibleTasks.filter((t) => dailyTasks.claimed.includes(t.key)).length;
          const goalReached   = claimedCount >= 7 && !dailyTasks.doubleRewardActive;

          if (dailyTasks.doubleRewardActive) {
            return (
              <View style={[styles.doubleBanner, styles.doubleBannerActive, isDark && { backgroundColor: 'rgba(80,60,0,0.45)' }]}>
                <Text style={[styles.doubleBannerText, styles.doubleBannerTextActive]}>
                  {t('dailyTasks.doubleReward')}
                </Text>
                <View style={styles.completionBarBg}>
                  <View style={[styles.completionBarFill, { width: `${Math.min(claimedCount / 7, 1) * 100}%` }]} />
                </View>
                <Text style={styles.completionText}>
                  {t('dailyTasks.completedToday', { done: claimedCount })}
                </Text>
                {claimedCount >= 7 && (
                  <Text style={styles.doubleBannerTomorrow}>
                    {t('dailyTasks.doubleRewardTomorrow')}
                  </Text>
                )}
              </View>
            );
          }

          if (goalReached) {
            return (
              <View style={[styles.doubleBanner, styles.doubleBannerGoal, isDark && { backgroundColor: 'rgba(20,60,15,0.45)' }]}>
                <Text style={styles.doubleBannerGoalEmoji}>🎉</Text>
                <Text style={styles.doubleBannerGoalTitle}>{t('dailyTasks.goalReachedTitle')}</Text>
                <Text style={styles.doubleBannerGoalSub}>{t('dailyTasks.goalReachedSub')}</Text>
              </View>
            );
          }

          return (
            <View style={[styles.doubleBanner, isDark && { backgroundColor: 'rgba(52,55,52,0.6)' }]}>
              <Text style={styles.doubleBannerText}>{t('dailyTasks.doubleRewardHint')}</Text>
              <View style={styles.completionBarBg}>
                <View style={[styles.completionBarFill, { width: `${(claimedCount / 7) * 100}%` }]} />
              </View>
              <Text style={styles.completionText}>
                {t('dailyTasks.completedToday', { done: claimedCount })}
              </Text>
            </View>
          );
        })()}

        {[...DAILY_TASKS.filter((task) => !task.hidden)].sort((a, b) => {
          const claimedA = dailyTasks.claimed.includes(a.key);
          const claimedB = dailyTasks.claimed.includes(b.key);
          if (claimedA !== claimedB) return claimedA ? 1 : -1;
          const pctA = getTaskProgress({ dailyGemsCollected, dailyTasks }, a) / a.threshold;
          const pctB = getTaskProgress({ dailyGemsCollected, dailyTasks }, b) / b.threshold;
          return pctB - pctA;
        }).map((task) => {
          const progress  = getTaskProgress({ dailyGemsCollected, dailyTasks }, task);
          const completed = progress >= task.threshold;
          const claimed   = dailyTasks.claimed.includes(task.key);
          const coins     = task.rewards.baseCoins * multiplier * (dailyTasks.doubleRewardActive ? 2 : 1);

          return (
            <View key={task.key} style={[styles.card, isDark && { backgroundColor: 'rgba(52,55,52,0.97)' }, claimed && styles.cardClaimed]}>
              <View style={styles.cardHeader}>
                {TASK_ICONS[task.key] && (
                  <Image source={TASK_ICONS[task.key]!} style={styles.taskIcon} contentFit="contain" />
                )}
                <View style={styles.cardTitleBlock}>
                  <Text style={[styles.cardTitle, isDark && { color: '#DDE8D8' }, claimed && styles.cardTitleClaimed]}>
                    {task.title}
                  </Text>
                  <Text style={[styles.cardDesc, isDark && { color: '#8A9A80' }, claimed && styles.cardDescClaimed]}>
                    {task.description}
                  </Text>
                </View>
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
                  <View style={[styles.rewardChip, isDark && { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                    <Image source={COIN_ICON} style={styles.rewardIcon} contentFit="contain" />
                    <Text style={styles.rewardCoins}>+{formatNum(coins)}</Text>
                  </View>
                  <View style={[styles.rewardChip, isDark && { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                    <Image source={DIAMOND_ICON} style={styles.rewardIcon} contentFit="contain" />
                    <Text style={styles.rewardGems}>+{task.rewards.gems}</Text>
                  </View>
                  {task.rewards.hasMaterials && dailyTasks.dailyMaterialType && (
                    <View style={[styles.rewardChip, isDark && { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                      <Image
                        source={MATERIAL_ICONS[dailyTasks.dailyMaterialType]}
                        style={styles.rewardIcon}
                        contentFit="contain"
                      />
                      <Text style={styles.rewardMat}>
                        +{matCount * (dailyTasks.doubleRewardActive ? 2 : 1)}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {completed && !claimed && (
                <Pressable
                  onPress={() => handleClaim(task.key, task.title)}
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

        <Text style={styles.timer}>
          {t('dailyTasks.resetsIn', { time: formatCountdown(msUntilReset) })}
        </Text>
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
          <View style={[styles.infoCard, isDark && { backgroundColor: '#2A2F38' }]}>
            <LinearGradient colors={['#E5A72E', '#C48A18']} style={styles.infoCardHeader}>
              <Text style={styles.infoCardTitle}>{t('dailyTasks.title')}</Text>
              <Pressable onPress={() => setInfoVisible(false)} hitSlop={10}>
                <Text style={styles.infoCardClose}>✕</Text>
              </Pressable>
            </LinearGradient>
            <View style={styles.infoCardBody}>
              <InfoSection
                icon={require('../assets/img/daily/dailytransporter.png')}
                title="Daily Challenges"
                text="Complete 11 tasks each day: buy, list, and collect goods, lift visitors and VIPs, add residents, spend gems, purchase diamonds, and more."
                accentColor="rgba(229,167,46,0.3)"
              />
              <InfoSection
                icon={require('../assets/img/coin.png')}
                title="Rewards"
                text="Each completed task gives coins and building materials (bricks, glass, nails, screws)."
                accentColor="rgba(229,167,46,0.3)"
              />
              <InfoSection
                icon={require('../assets/img/tokens/tokenGreen.png')}
                title="Tokens"
                text="Tasks also reward coloured tokens used to upgrade your business categories in My Business."
                accentColor="rgba(229,167,46,0.3)"
              />
              <InfoSection
                icon={require('../assets/img/diamond.png')}
                title="×2 Bonus Day"
                text="Complete 7 tasks to unlock double rewards for the following day. Resets at midnight."
                accentColor="rgba(229,167,46,0.3)"
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
  scroll: { paddingTop: 64, paddingHorizontal: 16, paddingBottom: 120, gap: 12 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  heading: { fontFamily: 'Fredoka_700Bold', fontSize: 28, color: '#27331F' },
  infoIcon: { width: 20, height: 20, opacity: 0.8 },
  infoOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(18,26,44,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  infoCard: { width: '100%', backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden' },
  infoCardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 13,
  },
  infoCardTitle: { fontFamily: 'Fredoka_700Bold', fontSize: 17, color: '#fff' },
  infoCardClose: { color: 'rgba(255,255,255,0.85)', fontSize: 16, fontFamily: 'Fredoka_600SemiBold' },
  infoCardBody: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 8 },

  tokenRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4, justifyContent: 'center' },
  tokenChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  tokenIcon: { width: 18, height: 18 },
  tokenCount: { fontFamily: 'Fredoka_700Bold', fontSize: 15 },

  timer: { fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: '#9BA3B0', marginBottom: 4, textAlign: 'center' },

  completionText: { fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: '#9BA3B0', textAlign: 'center' },
  completionBarBg: { alignSelf: 'stretch', height: 6, borderRadius: 3, backgroundColor: 'rgba(63,165,53,0.2)', overflow: 'hidden' },
  completionBarFill: { height: '100%', borderRadius: 3, backgroundColor: '#3FA535' },

  doubleBanner: { backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 14, padding: 12, alignItems: 'center', gap: 8, marginBottom: 4 },
  doubleBannerActive: { backgroundColor: '#FFF4D6' },
  doubleBannerGoal:   { backgroundColor: '#E8F7E4', gap: 4 },
  doubleBannerText: { fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: '#9BA3B0', textAlign: 'center' },
  doubleBannerTextActive: { fontFamily: 'Fredoka_600SemiBold', fontSize: 14, color: '#B07A00' },
  doubleBannerTomorrow: { fontFamily: 'Fredoka_600SemiBold', fontSize: 13, color: '#B07A00', textAlign: 'center' },
  doubleBannerGoalEmoji: { fontSize: 28, lineHeight: 34 },
  doubleBannerGoalTitle: { fontFamily: 'Fredoka_700Bold', fontSize: 16, color: '#277A20', textAlign: 'center' },
  doubleBannerGoalSub:   { fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: '#4A8A43', textAlign: 'center' },

  card: { backgroundColor: '#fff', borderRadius: 20, padding: 16, gap: 10, shadowColor: 'rgba(60,80,45,1)', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  cardClaimed: { opacity: 0.55 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  taskIcon: { width: 36, height: 36, borderRadius: 8 },
  cardTitleBlock: { flex: 1, gap: 2 },
  cardTitle: { fontFamily: 'Fredoka_600SemiBold', fontSize: 16, color: '#27331F' },
  cardTitleClaimed: { color: '#9BA3B0' },
  claimedCheck: { fontSize: 18, color: '#3FA535' },
  cardDesc: { fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: '#7C8A6E' },
  cardDescClaimed: { color: '#B0B8C0' },

  barBg: { height: 7, borderRadius: 4, backgroundColor: 'rgba(63,165,53,0.15)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, backgroundColor: '#3FA535' },

  progressRow: { alignItems: 'flex-end' },
  progressText: { fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: '#7C8A6E' },

  rewardRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  rewardChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F4F8F2', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  rewardIcon: { width: 14, height: 14 },
  rewardCoins: { fontFamily: 'Fredoka_600SemiBold', fontSize: 13, color: '#C28A22' },
  rewardGems:  { fontFamily: 'Fredoka_600SemiBold', fontSize: 13, color: '#2592AB' },
  rewardMat:   { fontFamily: 'Fredoka_600SemiBold', fontSize: 13, color: '#6B7A5E' },

  collectBtn: { borderRadius: 12, overflow: 'hidden' },
  collectGradient: { alignItems: 'center', paddingVertical: 10 },
  collectText: { fontFamily: 'Fredoka_700Bold', fontSize: 16, color: '#fff' },

  closeBtn: { position: 'absolute', bottom: 40, alignSelf: 'center', width: 56, height: 56, borderRadius: 28, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 20, color: '#fff', lineHeight: 22 },
});


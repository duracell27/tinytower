import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity, Pressable,
  ActivityIndicator, useColorScheme, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import LocaleText from '../../src/components/LocaleText';
import AppBackground from '../../src/components/AppBackground';
import { useAppTheme } from '../../src/hooks/useAppTheme';
import { useCityTaskStore } from '../../src/stores/cityTaskStore';
import { useCityStore } from '../../src/stores/cityStore';
import { useAuthStore } from '../../src/stores/authStore';
import { getUserIcon } from '../../src/utils/userIcon';
import type { CityTaskSummary } from '../../src/services/api';

const PRIMARY       = '#2E6EC9';
const TASKS_ICON    = require('../../assets/img/city/cityTasks.png');
const TICKET_ICON   = require('../../assets/img/city/CityTicket.png');
const GEM_ICON      = require('../../assets/img/diamond.png');
const COIN_ICON     = require('../../assets/img/coin.png');
const TOOLS_ICON    = require('../../assets/products/tools.png');
const INFO_ICON     = require('../../assets/img/InformationIcon.png');
const CUP1_ICON     = require('../../assets/img/rating/1PlaceCup.png');
const CUP2_ICON     = require('../../assets/img/rating/2PlaceCup.png');
const CUP3_ICON     = require('../../assets/img/rating/3PlaceCup.png');

function cupIcon(rank: number) {
  if (rank <= 3) return CUP1_ICON;
  if (rank <= 6) return CUP2_ICON;
  return CUP3_ICON;
}

const TASK_GEM_REWARDS: Record<string, number> = {
  WHOLESALE_PURCHASES: 2, GOODS_ON_DISPLAY: 2, CASH_COLLECTOR: 2,
  CARRIER: 2, VIP_CARRIER: 2, EVICT_RESIDENTS: 2, NEW_RESIDENTS: 2,
  BUILD_FLOOR: 5, EASY_MONEY: 5,
};

const TASK_COINS_MULTIPLIER: Record<string, number> = {
  CASH_COLLECTOR: 3000, VIP_CARRIER: 3000, GOODS_ON_DISPLAY: 2500,
  WHOLESALE_PURCHASES: 2000, NEW_RESIDENTS: 2000, EVICT_RESIDENTS: 2000,
  BUILD_FLOOR: 2000, EASY_MONEY: 1500, CARRIER: 1500,
};

const TASK_ICONS: Record<string, any> = {
  WHOLESALE_PURCHASES: require('../../assets/img/city/CityTaskWholesalePurchases.png'),
  GOODS_ON_DISPLAY:    require('../../assets/img/city/CityTaskGoodsonDisplay.png'),
  CASH_COLLECTOR:      require('../../assets/img/city/CityTaskCashCollector.png'),
  CARRIER:             require('../../assets/img/city/CityTaskCarrier.png'),
  VIP_CARRIER:         require('../../assets/img/city/CityTaskVipCarrier.png'),
  EVICT_RESIDENTS:     require('../../assets/img/city/CityTaskGoodbyeResidents.png'),
  NEW_RESIDENTS:       require('../../assets/img/city/CityTaskNewResidents.png'),
  BUILD_FLOOR:         require('../../assets/img/city/CityTaskHigherandHigher.png'),
  EASY_MONEY:          require('../../assets/img/city/CityTaskEasyMoney.png'),
};

const LEADERSHIP_ROLES = ['MAYOR', 'ACTING_MAYOR', 'VICE_MAYOR'] as const;

function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function X2TimerBadge({ canDoubleUntil }: { canDoubleUntil: string }) {
  const [now, setNow] = useState(Date.now());

  const deadline = useMemo(() => {
    const d = new Date();
    const endOfDay = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
    return Math.min(new Date(canDoubleUntil).getTime(), endOfDay);
  }, [canDoubleUntil]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const msLeft = deadline - now;
  if (msLeft <= 0) return null;

  return (
    <View style={timerStyles.badge}>
      <View style={timerStyles.circle}>
        <LocaleText style={timerStyles.x2}>×2</LocaleText>
      </View>
      <LocaleText style={timerStyles.timerText}>{fmtCountdown(msLeft)}</LocaleText>
    </View>
  );
}

const timerStyles = StyleSheet.create({
  badge:     { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingLeft: 2, paddingRight: 10, paddingVertical: 2, backgroundColor: PRIMARY, alignSelf: 'center' },
  circle:    { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  x2:        { color: PRIMARY, fontFamily: 'Fredoka_700Bold', fontSize: 11 },
  timerText: { color: '#fff', fontFamily: 'Fredoka_700Bold', fontSize: 12 },
});

export default function CityTasksScreen() {
  const { t } = useTranslation('tabs');
  const theme = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';

  const { tasks, myActiveTaskId, cityStyleStars, isWeekend, weeklyResult, loading, fetchTasks, joinTask, collectTask, cancelTask } =
    useCityTaskStore();
  const city = useCityStore((s) => s.city);
  const cityLevel = city?.level ?? 10;
  const playerId = useAuthStore((s) => s.player?.id);

  const myRole = city?.members?.find((m) => m.playerId === playerId)?.role;
  const canModerate = myRole ? (LEADERSHIP_ROLES as readonly string[]).includes(myRole) : false;

  useFocusEffect(useCallback(() => { fetchTasks(); }, []));

  const getMember = (pid: string) => city?.members?.find((m) => m.playerId === pid);

  const [cancelPendingId, setCancelPendingId] = useState<string | null>(null);
  const [collectReward, setCollectReward]     = useState<{ finalStars: number; gemReward: number; coinsReward: number } | null>(null);
  const [showInfo, setShowInfo]               = useState(false);

  const handleJoin    = async (taskId: string) => { try { await joinTask(taskId); } catch {} };
  const handleCollect = async (taskId: string) => {
    try {
      const res = await collectTask(taskId);
      setCollectReward(res);
    } catch {}
  };
  const handleCancelConfirm = async () => {
    if (!cancelPendingId) return;
    const id = cancelPendingId;
    setCancelPendingId(null);
    try { await cancelTask(id); } catch {}
  };

  return (
    <View style={styles.container}>
      <AppBackground style={[styles.bg, isDark && styles.bgDark]}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero header ── */}
          <View style={[styles.hero, { backgroundColor: isDark ? '#1A2E3E' : '#FFFFFF' }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
              <LocaleText style={[styles.backText, { color: isDark ? '#8AAFD4' : PRIMARY }]}>‹</LocaleText>
            </TouchableOpacity>
            <View style={styles.heroCenter}>
              <Image source={TASKS_ICON} style={styles.heroIcon} contentFit="contain" />
              <View style={styles.heroTextWrap}>
                <LocaleText style={[styles.heroTitle, { color: theme.text }]}>
                  {t('cityTasks.title')}
                </LocaleText>
                <LocaleText style={[styles.heroSub, { color: theme.textMuted }]}>
                  {t('cityTasks.headerDesc')}
                </LocaleText>
              </View>
            </View>
            <Pressable onPress={() => setShowInfo(true)} hitSlop={10}>
              <Image source={INFO_ICON} style={styles.infoIcon} contentFit="contain" />
            </Pressable>
          </View>

          {/* ── City Tickets card ── */}
          <View style={[styles.starsCard, { backgroundColor: isDark ? '#1A2E3E' : '#FFFFFF' }]}>
            <Image source={TICKET_ICON} style={styles.starsIcon} contentFit="contain" />
            <View style={styles.starsText}>
              <LocaleText style={[styles.starsCount, { color: PRIMARY }]}>
                {cityStyleStars}
              </LocaleText>
              <LocaleText style={[styles.starsTitle, { color: theme.text }]}>
                {t('cityTasks.starsCardTitle')}
              </LocaleText>
              <LocaleText style={[styles.starsSub, { color: theme.textMuted }]}>
                {t('cityTasks.starsCardDesc')}
              </LocaleText>
            </View>
          </View>

          {/* ── Weekend or Tasks ── */}
          {isWeekend ? (
            <>
              <View style={[styles.weekendCard, { backgroundColor: isDark ? '#1A2E3E' : '#FFFFFF' }]}>
                <LocaleText style={[styles.weekendTitle, { color: theme.text }]}>
                  {t('cityTasks.weekendTitle')}
                </LocaleText>
                <LocaleText style={[styles.weekendDesc, { color: theme.textMuted }]}>
                  {t('cityTasks.weekendDesc')}
                </LocaleText>
              </View>
              {weeklyResult && (
                <View style={[styles.weekendResultCard, { backgroundColor: isDark ? '#1A2E3E' : '#FFFFFF' }]}>
                  <LocaleText style={[styles.weekendResultTitle, { color: PRIMARY }]}>
                    {t('cityTasks.weekendResultsTitle')}
                  </LocaleText>
                  {weeklyResult.totalTickets != null && (
                    <View style={styles.weekendResultRow}>
                      <Image source={TICKET_ICON} style={{ width: 18, height: 18 }} contentFit="contain" />
                      <LocaleText style={[styles.weekendResultStat, { color: theme.text }]}>
                        {weeklyResult.totalTickets}
                      </LocaleText>
                      {weeklyResult.rank != null && (
                        <LocaleText style={[styles.weekendResultRank, { color: PRIMARY }]}>
                          #{weeklyResult.rank}
                        </LocaleText>
                      )}
                    </View>
                  )}
                  {weeklyResult.totalReward != null && (
                    <LocaleText style={[styles.weekendResultReward, { color: '#3FA535' }]}>
                      +{weeklyResult.totalReward} 💎
                    </LocaleText>
                  )}
                  {weeklyResult.message ? (
                    <LocaleText style={[styles.weekendResultMsg, { color: theme.textMuted }]}>
                      {weeklyResult.message}
                    </LocaleText>
                  ) : null}
                </View>
              )}
            </>
          ) : loading && tasks.length === 0 ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={isDark ? '#6BAED0' : PRIMARY} />
            </View>
          ) : tasks.length === 0 ? (
            <View style={styles.center}>
              <LocaleText style={[styles.emptyText, { color: theme.textMuted }]}>
                {t('cityTasks.noTasks')}
              </LocaleText>
            </View>
          ) : (
            [...tasks].sort((a, b) => {
              const order = { COMPLETED: 0, IN_PROGRESS: 1, AVAILABLE: 2, COLLECTED: 3, EXPIRED: 3 };
              return (order[a.status as keyof typeof order] ?? 3) - (order[b.status as keyof typeof order] ?? 3);
            }).map((task) => {
              const isAvailable = task.status === 'AVAILABLE';
              const isCompleted = task.status === 'COMPLETED';
              const isCollected = task.status === 'COLLECTED';
              const isExpired   = task.status === 'EXPIRED';
              const isInProgress = task.status === 'IN_PROGRESS';
              const isDisabled  = isCollected || isExpired;

              const progressRatio = Math.min(1, task.currentProgress / Math.max(1, task.requiredCount));
              const amParticipant = task.participants.some((p) => p.playerId === playerId);
              const canJoin = (isAvailable || isInProgress)
                && !myActiveTaskId
                && task.participants.length < 2;

              const taskDescKey = `cityTasks.taskDesc.${task.taskType}` as any;
              const hasCountInDesc = task.taskType !== 'BUILD_FLOOR' && task.taskType !== 'EASY_MONEY';

              const showX2Timer = isInProgress && amParticipant && !!task.canDoubleUntil;

              return (
                <View
                  key={task.id}
                  style={[
                    styles.card,
                    { backgroundColor: isDark ? '#1A2E3E' : '#FFFFFF' },
                    isDisabled && styles.cardDisabled,
                  ]}
                >
                  {/* Status badge — expired only (at top) */}
                  {isExpired && (
                    <View style={styles.badgesRow}>
                      <LocaleText style={[styles.statusText, { color: theme.textMuted }]}>
                        {t('cityTasks.expired')}
                      </LocaleText>
                    </View>
                  )}

                  {/* Task icon left + title/desc right */}
                  <View style={styles.taskHeader}>
                    <Image source={TASK_ICONS[task.taskType]} style={styles.taskIcon} contentFit="contain" />
                    <View style={styles.taskHeaderText}>
                      <LocaleText style={[styles.taskName, { color: isDisabled ? theme.textMuted : theme.text }]}>
                        {t(`cityTasks.taskTypes.${task.taskType}` as any)}
                      </LocaleText>
                      <LocaleText style={[styles.taskDesc, { color: theme.textMuted }]}>
                        {hasCountInDesc
                          ? t(taskDescKey, { count: task.requiredCount })
                          : t(taskDescKey)}
                      </LocaleText>
                    </View>
                  </View>

                  {/* Progress bar */}
                  <View style={[styles.progressBar, { backgroundColor: theme.divider }]}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${progressRatio * 100}%`,
                          backgroundColor: isCompleted ? '#3FA535' : isDisabled ? theme.divider : PRIMARY,
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.progressLabelRow}>
                    <LocaleText style={[styles.progressLabel, { color: theme.textMuted }]}>
                      {t('cityTasks.progress')}
                    </LocaleText>
                    <LocaleText style={[styles.progressText, { color: isDisabled ? theme.textMuted : theme.text }]}>
                      {task.currentProgress} / {task.requiredCount}
                    </LocaleText>
                  </View>

                  {/* Reward preview */}
                  {!isExpired && (
                    <View style={styles.rewardPreviewRow}>
                      <View style={[styles.rewardPreviewItem, { backgroundColor: 'rgba(37,146,171,0.15)' }]}>
                        <Image source={GEM_ICON} style={styles.rewardPreviewIcon} contentFit="contain" />
                        <LocaleText style={[styles.rewardPreviewText, { color: '#2592AB' }]}>
                          {TASK_GEM_REWARDS[task.taskType] ?? 2}
                        </LocaleText>
                      </View>
                      <View style={[styles.rewardPreviewItem, { backgroundColor: 'rgba(224,169,60,0.15)' }]}>
                        <Image source={COIN_ICON} style={styles.rewardPreviewIcon} contentFit="contain" />
                        <LocaleText style={[styles.rewardPreviewText, { color: '#E0A93C' }]}>
                          {(cityLevel * (TASK_COINS_MULTIPLIER[task.taskType] ?? 2000)).toLocaleString()}
                        </LocaleText>
                      </View>
                    </View>
                  )}

                  {/* Participants + x2 badge in same wrapping row */}
                  {task.participants.length > 0 && (
                    <View style={styles.participantsRow}>
                      {task.participants.map((p, idx) => {
                        const member    = getMember(p.playerId);
                        const level     = member?.playerLevel ?? 1;
                        const name      = member?.playerName ?? p.playerId.slice(0, 8);
                        const isHelper  = idx === 1;
                        const chipBg    = isHelper ? (isDark ? '#2D1F45' : '#F0E8FF') : (isDark ? '#243547' : '#EBF3FF');
                        const nameColor = isHelper ? (isDark ? '#C4A0F0' : '#9A6FD0') : (isDark ? '#8AAFD4' : PRIMARY);
                        return (
                          <TouchableOpacity
                            key={p.playerId}
                            style={[styles.participantChip, { backgroundColor: chipBg }]}
                            onPress={() => router.push(`/user-profile/${p.playerId}` as any)}
                            activeOpacity={0.7}
                          >
                            <Image source={getUserIcon(level)} style={styles.participantAvatar} contentFit="cover" />
                            <LocaleText style={[styles.participantName, { color: nameColor }]}>
                              {name}
                            </LocaleText>
                          </TouchableOpacity>
                        );
                      })}
                      {showX2Timer && (
                        <X2TimerBadge canDoubleUntil={task.canDoubleUntil!} />
                      )}
                    </View>
                  )}

                  {/* Actions */}
                  {isCollected && (
                    <View style={[styles.completedPill, { backgroundColor: isDark ? '#334D62' : '#E2EEF5' }]}>
                      <LocaleText style={[styles.completedPillText, { color: isDark ? '#6A8FA8' : '#5A7A8E' }]}>
                        {t('cityTasks.collected')}
                      </LocaleText>
                    </View>
                  )}

                  {!isDisabled && (
                    <View style={styles.actions}>
                      {isCompleted && (
                        <View style={styles.completedPill}>
                          <LocaleText style={styles.completedPillText}>
                            {t('cityTasks.completed')}
                          </LocaleText>
                        </View>
                      )}
                      {canJoin && (
                        <TouchableOpacity
                          style={[styles.btn, { backgroundColor: isInProgress ? '#9A6FD0' : PRIMARY }]}
                          onPress={() => handleJoin(task.id)}
                          activeOpacity={0.8}
                        >
                          <LocaleText style={styles.btnText}>
                            {isInProgress ? t('cityTasks.help') : t('cityTasks.join')}
                          </LocaleText>
                        </TouchableOpacity>
                      )}
                      {(canModerate || amParticipant) && isCompleted && (
                        <TouchableOpacity
                          style={[styles.btn, { backgroundColor: '#3FA535' }]}
                          onPress={() => handleCollect(task.id)}
                          activeOpacity={0.8}
                        >
                          <LocaleText style={styles.btnText}>{t('cityTasks.collect')}</LocaleText>
                        </TouchableOpacity>
                      )}
                      {(canModerate || amParticipant) && isInProgress && (
                        <TouchableOpacity
                          style={[styles.btn, { backgroundColor: '#E53935' }]}
                          onPress={() => setCancelPendingId(task.id)}
                          activeOpacity={0.8}
                        >
                          <LocaleText style={styles.btnText}>{t('cityTasks.cancel')}</LocaleText>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}

          {/* ── Midnight note ── */}
          {!isWeekend && tasks.length > 0 && (
            <LocaleText style={[styles.midnightNote, { color: theme.textMuted }]}>
              {t('cityTasks.midnightNote')}
            </LocaleText>
          )}
        </ScrollView>
      </AppBackground>

      {/* ── Cancel confirmation modal ── */}
      <Modal
        visible={cancelPendingId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelPendingId(null)}
      >
        <View style={modalStyles.overlay}>
          <View style={[modalStyles.sheet, { backgroundColor: isDark ? '#1A2E3E' : '#FFFFFF' }]}>
            <LocaleText style={[modalStyles.title, { color: theme.text }]}>
              {t('cityTasks.cancelConfirmTitle')}
            </LocaleText>
            <LocaleText style={[modalStyles.body, { color: theme.textMuted }]}>
              {t('cityTasks.cancelConfirmBody')}
            </LocaleText>
            <View style={modalStyles.buttons}>
              <TouchableOpacity
                style={[modalStyles.btn, { backgroundColor: isDark ? '#243547' : '#EBF3FF' }]}
                onPress={() => setCancelPendingId(null)}
                activeOpacity={0.8}
              >
                <LocaleText style={[modalStyles.btnKeep, { color: isDark ? '#8AAFD4' : PRIMARY }]}>
                  {t('cityTasks.cancelConfirmKeep')}
                </LocaleText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[modalStyles.btn, { backgroundColor: '#E53935' }]}
                onPress={handleCancelConfirm}
                activeOpacity={0.8}
              >
                <LocaleText style={modalStyles.btnOk}>
                  {t('cityTasks.cancelConfirmOk')}
                </LocaleText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Collect result modal ── */}
      <Modal
        visible={collectReward !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setCollectReward(null)}
      >
        <View style={modalStyles.overlay}>
          <View style={[modalStyles.sheet, { backgroundColor: isDark ? '#1A2E3E' : '#FFFFFF' }]}>
            <LocaleText style={[modalStyles.title, { color: theme.text }]}>
              {t('cityTasks.collectResultTitle')}
            </LocaleText>
            <View style={modalStyles.rewardRow}>
              <View style={modalStyles.rewardItem}>
                <Image source={TICKET_ICON} style={modalStyles.rewardIcon} contentFit="contain" />
                <LocaleText style={[modalStyles.rewardValue, { color: PRIMARY }]}>
                  {collectReward?.finalStars}
                </LocaleText>
              </View>
              <View style={modalStyles.rewardItem}>
                <Image source={GEM_ICON} style={modalStyles.rewardIcon} contentFit="contain" />
                <LocaleText style={[modalStyles.rewardValue, { color: '#2592AB' }]}>
                  {collectReward?.gemReward}
                </LocaleText>
              </View>
              <View style={modalStyles.rewardItem}>
                <Image source={COIN_ICON} style={modalStyles.rewardIcon} contentFit="contain" />
                <LocaleText style={[modalStyles.rewardValue, { color: '#E0A93C' }]}>
                  {collectReward?.coinsReward != null
                    ? collectReward.coinsReward >= 1000
                      ? `${(collectReward.coinsReward / 1000).toFixed(1)}k`
                      : String(collectReward.coinsReward)
                    : ''}
                </LocaleText>
              </View>
            </View>
            <TouchableOpacity
              style={[modalStyles.btn, { backgroundColor: '#3FA535', alignSelf: 'stretch', flex: undefined }]}
              onPress={() => setCollectReward(null)}
              activeOpacity={0.8}
            >
              <LocaleText style={modalStyles.btnOk}>
                {t('cityTasks.collectResultBtn')}
              </LocaleText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* ── Info popup ── */}
      {showInfo && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setShowInfo(false)}
        >
          <View style={infoModal.overlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowInfo(false)} />
            <View style={[infoModal.card, { backgroundColor: isDark ? '#1A2E3E' : '#FFFFFF' }]}>

              {/* Header */}
              <LinearGradient colors={[PRIMARY, '#1A4FA0']} style={infoModal.header}>
                <LocaleText style={infoModal.headerTitle}>{t('cityTasks.infoTitle')}</LocaleText>
                <Pressable onPress={() => setShowInfo(false)} hitSlop={10}>
                  <LocaleText style={infoModal.headerClose}>✕</LocaleText>
                </Pressable>
              </LinearGradient>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={infoModal.body}
                style={{ maxHeight: 480 }}
              >
                {/* Schedule */}
                <View style={infoModal.scheduleRow}>
                  <Image source={TASKS_ICON} style={infoModal.scheduleIcon} contentFit="contain" />
                  <LocaleText style={[infoModal.scheduleText, { color: theme.textMuted }]}>
                    {t('cityTasks.infoSchedule')}
                  </LocaleText>
                </View>

                <View style={[infoModal.divider, { backgroundColor: isDark ? '#243547' : '#EEF4FA' }]} />

                {/* Base reward */}
                <View style={{ gap: 8 }}>
                  <LocaleText style={[infoModal.sectionTitle, { color: theme.text, paddingHorizontal: 4 }]}>
                    {t('cityTasks.infoBase')}
                  </LocaleText>
                  <View style={[infoModal.baseConvCard, { backgroundColor: isDark ? '#162840' : '#EEF5FF' }]}>
                    <View style={infoModal.baseConvRow}>
                      <LocaleText style={[infoModal.baseConvNum, { color: theme.text }]}>1</LocaleText>
                      <Image source={TICKET_ICON} style={infoModal.baseConvIcon} contentFit="contain" />
                      <LocaleText style={[infoModal.baseConvEq, { color: theme.textMuted }]}>=</LocaleText>
                      <LocaleText style={[infoModal.baseConvNum, { color: PRIMARY }]}>2</LocaleText>
                      <Image source={GEM_ICON} style={infoModal.baseConvIcon} contentFit="contain" />
                    </View>
                    <LocaleText style={[infoModal.baseConvLabel, { color: theme.textMuted }]}>
                      {t('cityTasks.infoBaseDiamonds')}
                    </LocaleText>
                  </View>
                </View>

                <View style={[infoModal.divider, { backgroundColor: isDark ? '#243547' : '#EEF4FA' }]} />

                {/* Top 10 */}
                <View style={{ gap: 6 }}>
                  <LocaleText style={[infoModal.sectionTitle, { color: theme.text, paddingHorizontal: 4 }]}>
                    {t('cityTasks.infoTop10')}
                  </LocaleText>
                  {([
                    [1, 2000, 100],[2, 1900, 90],[3, 1800, 80],
                    [4, 1600, 70], [5, 1500, 60],[6, 1400, 50],
                    [7, 1300, 40], [8, 1200, 30],[9, 1100, 20],[10, 1000, 10],
                  ] as [number, number, number][]).map(([rank, bonus, resources]) => {
                    const rankColor = rank <= 3 ? '#C8960A' : rank <= 6 ? '#888888' : '#A0643A';
                    return (
                      <View
                        key={rank}
                        style={[
                          infoModal.rankRow,
                          { backgroundColor: isDark
                            ? rank <= 3 ? 'rgba(218,165,32,0.15)' : rank <= 6 ? 'rgba(192,192,192,0.12)' : 'rgba(205,127,50,0.12)'
                            : rank <= 3 ? 'rgba(255,215,0,0.15)' : rank <= 6 ? 'rgba(192,192,192,0.15)' : 'rgba(205,127,50,0.13)',
                          },
                        ]}
                      >
                        <Image source={cupIcon(rank)} style={infoModal.cupIcon} contentFit="contain" />
                        <LocaleText style={[infoModal.rankNum, { color: rankColor }]}>#{rank}</LocaleText>
                        <View style={{ flex: 1 }} />
                        <LocaleText style={[infoModal.rankBonus, { color: rankColor }]}>+{bonus.toLocaleString()}</LocaleText>
                        <Image source={GEM_ICON} style={infoModal.gemSm} contentFit="contain" />
                        <View style={[infoModal.rankDivider, { backgroundColor: isDark ? '#2A3F52' : '#D8E8F5' }]} />
                        <LocaleText style={[infoModal.rankBonus, { color: '#7BAF6A' }]}>+{resources}</LocaleText>
                        <Image source={TOOLS_ICON} style={infoModal.gemSm} contentFit="contain" />
                      </View>
                    );
                  })}
                </View>

                <View style={[infoModal.divider, { backgroundColor: isDark ? '#243547' : '#EEF4FA' }]} />

                {/* Super bonuses */}
                <View style={{ gap: 8 }}>
                  <LocaleText style={[infoModal.sectionTitle, { color: theme.text, paddingHorizontal: 4 }]}>
                    {t('cityTasks.infoSuper')}
                  </LocaleText>
                  {([
                    { tickets: 250, gems: 500,  resources: 50,  descKey: 'cityTasks.infoSuper250' },
                    { tickets: 500, gems: 5000, resources: 100, descKey: 'cityTasks.infoSuper500' },
                  ]).map(({ tickets, gems, resources, descKey }) => (
                    <View key={tickets} style={[infoModal.superCard, { backgroundColor: isDark ? '#1C3048' : '#F0F7FF' }]}>
                      <View style={infoModal.superTop}>
                        <View style={infoModal.superThreshRow}>
                          <View style={infoModal.superThreshTextCol}>
                            <LocaleText style={[infoModal.superMoreThan, { color: PRIMARY }]}>more than</LocaleText>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <LocaleText style={infoModal.superThresh}>{tickets}</LocaleText>
                              <Image source={TICKET_ICON} style={infoModal.ticketMd} contentFit="contain" />
                            </View>
                          </View>
                        </View>
                        <View style={{ gap: 4, alignItems: 'flex-end' }}>
                          <View style={infoModal.superBonusRow}>
                            <LocaleText style={[infoModal.superBonus, { color: '#2592AB' }]}>+{gems.toLocaleString()}</LocaleText>
                            <Image source={GEM_ICON} style={infoModal.gemMd} contentFit="contain" />
                          </View>
                          <View style={infoModal.superBonusRow}>
                            <LocaleText style={[infoModal.superBonus, { color: '#7BAF6A' }]}>+{resources}</LocaleText>
                            <Image source={TOOLS_ICON} style={infoModal.gemMd} contentFit="contain" />
                          </View>
                        </View>
                      </View>
                      <LocaleText style={[infoModal.superDesc, { color: theme.textMuted }]}>
                        {t(descKey as any)}
                      </LocaleText>
                    </View>
                  ))}
                </View>

              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bg:        { flex: 1, backgroundColor: '#DCEFF6' },
  bgDark:    { backgroundColor: '#0D1F2D' },
  center:    { paddingVertical: 48, alignItems: 'center', padding: 32 },
  scroll:    { paddingHorizontal: 0 },

  /* Hero */
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 10,
    marginHorizontal: 14,
  },
  backBtn:      { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(46,110,201,0.15)', alignItems: 'center', justifyContent: 'center' },
  backText:     { fontSize: 26, lineHeight: 26, fontFamily: 'Fredoka_700Bold', includeFontPadding: false },
  heroCenter:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  heroIcon:     { width: 36, height: 36 },
  heroTextWrap: { gap: 1 },
  heroTitle:    { fontFamily: 'Fredoka_700Bold', fontSize: 20 },
  heroSub:      { fontFamily: 'Fredoka_400Regular', fontSize: 12 },

  /* Stars card */
  starsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginHorizontal: 14,
    marginBottom: 10,
  },
  starsIcon:  { width: 64, height: 64 },
  starsText:  { alignItems: 'center', gap: 1 },
  starsCount: { fontFamily: 'Fredoka_700Bold', fontSize: 34, lineHeight: 38 },
  starsTitle: { fontFamily: 'Fredoka_600SemiBold', fontSize: 15 },
  starsSub:   { fontFamily: 'Fredoka_400Regular', fontSize: 12 },

  /* Task card */
  card: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: 14,
    marginBottom: 10,
    gap: 8,
  },
  cardDisabled: { opacity: 0.65 },

  badgesRow:         { flexDirection: 'row', gap: 6, alignItems: 'center' },
  statusText:        { fontFamily: 'Fredoka_500Medium', fontSize: 12 },
  completedPill:     { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, backgroundColor: '#3FA535', alignSelf: 'center' },
  completedPillText: { color: '#fff', fontFamily: 'Fredoka_600SemiBold', fontSize: 13 },

  taskHeader:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  taskHeaderText: { flex: 1, gap: 2 },
  taskIcon:       { width: 54, height: 54, flexShrink: 0 },
  taskName:       { fontFamily: 'Fredoka_600SemiBold', fontSize: 17 },
  taskDesc:       { fontFamily: 'Fredoka_400Regular', fontSize: 13, lineHeight: 17 },

  progressLabelRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  progressLabel:       { fontFamily: 'Fredoka_400Regular', fontSize: 13 },
  progressText:        { fontFamily: 'Fredoka_600SemiBold', fontSize: 13 },
  progressBar:         { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill:        { height: '100%', borderRadius: 3 },
  rewardPreviewRow:    { flexDirection: 'row', gap: 8, marginTop: 8, justifyContent: 'center' },
  rewardPreviewItem:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  rewardPreviewIcon:   { width: 14, height: 14 },
  rewardPreviewText:   { fontFamily: 'Fredoka_600SemiBold', fontSize: 13 },

  /* Participants */
  participantsRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', flexWrap: 'wrap' },
  participantChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  participantAvatar: { width: 22, height: 22, borderRadius: 11 },
  participantName: { fontFamily: 'Fredoka_500Medium', fontSize: 13 },

  /* Actions */
  actions: { gap: 6, marginTop: 2 },
  btn:     { borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontFamily: 'Fredoka_600SemiBold', fontSize: 14 },

  emptyText:    { fontFamily: 'Fredoka_500Medium', fontSize: 15, textAlign: 'center' },
  midnightNote: { fontFamily: 'Fredoka_400Regular', fontSize: 12, textAlign: 'center', paddingHorizontal: 24, paddingTop: 4 },

  weekendCard:        { borderRadius: 14, padding: 20, marginHorizontal: 14, marginBottom: 10, alignItems: 'center', gap: 8 },
  weekendTitle:       { fontFamily: 'Fredoka_700Bold', fontSize: 18, textAlign: 'center' },
  weekendDesc:        { fontFamily: 'Fredoka_400Regular', fontSize: 13, textAlign: 'center', lineHeight: 18 },
  weekendResultCard:  { borderRadius: 14, padding: 20, marginHorizontal: 14, marginBottom: 10, alignItems: 'center', gap: 6 },
  weekendResultTitle: { fontFamily: 'Fredoka_700Bold', fontSize: 15, textAlign: 'center' },
  weekendResultRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  weekendResultStat:  { fontFamily: 'Fredoka_700Bold', fontSize: 22 },
  weekendResultRank:  { fontFamily: 'Fredoka_600SemiBold', fontSize: 16 },
  weekendResultReward:{ fontFamily: 'Fredoka_700Bold', fontSize: 20 },
  weekendResultMsg:   { fontFamily: 'Fredoka_400Regular', fontSize: 13, textAlign: 'center', lineHeight: 18 },

  infoIcon: { width: 22, height: 22, opacity: 0.8 },
});

const infoModal = StyleSheet.create({
  overlay:  { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(18,26,44,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card:     { width: '100%', borderRadius: 20, overflow: 'hidden' },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 13 },
  headerTitle: { fontFamily: 'Fredoka_700Bold', fontSize: 17, color: '#fff' },
  headerClose: { color: 'rgba(255,255,255,0.85)', fontSize: 16, fontFamily: 'Fredoka_600SemiBold' },

  body:         { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14, gap: 12 },
  divider:      { height: 1, marginVertical: 2 },

  scheduleRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scheduleIcon: { width: 28, height: 28 },
  scheduleText: { fontFamily: 'Nunito_400Regular', fontSize: 13, lineHeight: 19, flex: 1 },

  sectionRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  sectionIcon:  { width: 28, height: 28, marginTop: 1 },
  sectionTitle: { fontFamily: 'Fredoka_600SemiBold', fontSize: 14 },

  baseValueRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  baseEq:       { fontFamily: 'Nunito_400Regular', fontSize: 13 },
  baseNum:      { fontFamily: 'Fredoka_700Bold', fontSize: 16 },
  baseLabel:    { fontFamily: 'Nunito_400Regular', fontSize: 13 },
  gemMd:        { width: 18, height: 18 },

  baseConvCard:  { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', gap: 4 },
  baseConvRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  baseConvNum:   { fontFamily: 'Fredoka_700Bold', fontSize: 28 },
  baseConvIcon:  { width: 28, height: 28 },
  baseConvEq:    { fontFamily: 'Fredoka_600SemiBold', fontSize: 24 },
  baseConvLabel: { fontFamily: 'Nunito_400Regular', fontSize: 12 },

  rankRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  rankDivider: { width: 1, height: 14, marginHorizontal: 2 },
  cupIcon:     { width: 22, height: 22 },
  rankNum:     { fontFamily: 'Fredoka_700Bold', fontSize: 15, width: 30 },
  rankBonus:   { fontFamily: 'Fredoka_700Bold', fontSize: 15 },
  gemSm:       { width: 16, height: 16 },

  superCard:     { borderRadius: 12, padding: 12, gap: 6 },
  superTop:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  superThreshRow:{ flexDirection: 'row', alignItems: 'center', gap: 6 },
  superThresh:       { fontFamily: 'Fredoka_700Bold', fontSize: 22, color: PRIMARY },
  superThreshTextCol:{ alignItems: 'flex-start', gap: 0 },
  superMoreThan:     { fontFamily: 'Nunito_400Regular', fontSize: 11, letterSpacing: 0.3 },
  ticketMd:          { width: 22, height: 22 },
  superBonusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  superBonus:    { fontFamily: 'Fredoka_700Bold', fontSize: 22 },
  superDesc:     { fontFamily: 'Nunito_400Regular', fontSize: 13, lineHeight: 18 },
});

const modalStyles = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  sheet:       { width: '100%', borderRadius: 20, padding: 24, gap: 12, alignItems: 'center' },
  title:       { fontFamily: 'Fredoka_700Bold', fontSize: 20, textAlign: 'center' },
  body:        { fontFamily: 'Fredoka_400Regular', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  buttons:     { flexDirection: 'row', gap: 10, marginTop: 4, width: '100%' },
  btn:         { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  btnKeep:     { fontFamily: 'Fredoka_600SemiBold', fontSize: 14 },
  btnOk:       { color: '#fff', fontFamily: 'Fredoka_600SemiBold', fontSize: 14 },
  starIcon:    { width: 56, height: 56 },
  starsNumber: { fontFamily: 'Fredoka_700Bold', fontSize: 48, lineHeight: 54 },
  rewardRow:   { flexDirection: 'row', justifyContent: 'center', gap: 24, marginVertical: 8 },
  rewardItem:  { alignItems: 'center', gap: 4 },
  rewardIcon:  { width: 40, height: 40 },
  rewardValue: { fontFamily: 'Fredoka_700Bold', fontSize: 22 },
});

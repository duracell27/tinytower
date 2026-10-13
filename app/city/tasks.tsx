import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, useColorScheme, Modal,
} from 'react-native';
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

const PRIMARY    = '#2E6EC9';
const TASKS_ICON = require('../../assets/img/city/cityTasks.png');
const STAR_ICON  = require('../../assets/img/starFull.png');

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

  const { tasks, myActiveTaskId, cityStyleStars, loading, fetchTasks, joinTask, collectTask, cancelTask } =
    useCityTaskStore();
  const city = useCityStore((s) => s.city);
  const playerId = useAuthStore((s) => s.player?.id);

  const myRole = city?.members?.find((m) => m.playerId === playerId)?.role;
  const canModerate = myRole ? (LEADERSHIP_ROLES as readonly string[]).includes(myRole) : false;

  useFocusEffect(useCallback(() => { fetchTasks(); }, []));

  const getMember = (pid: string) => city?.members?.find((m) => m.playerId === pid);

  const [cancelPendingId, setCancelPendingId] = useState<string | null>(null);
  const [collectStars, setCollectStars]       = useState<number | null>(null);

  const handleJoin    = async (taskId: string) => { try { await joinTask(taskId); } catch {} };
  const handleCollect = async (taskId: string) => {
    try {
      const res = await collectTask(taskId);
      setCollectStars(res.finalStars);
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
            <View style={{ width: 36 }} />
          </View>

          {/* ── Style Stars card ── */}
          <View style={[styles.starsCard, { backgroundColor: isDark ? '#1A2E3E' : '#FFFFFF' }]}>
            <Image source={STAR_ICON} style={styles.starsIcon} contentFit="contain" />
            <View style={styles.starsText}>
              <LocaleText style={[styles.starsCount, { color: isDark ? '#F5C842' : '#C89B00' }]}>
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

          {/* ── Tasks ── */}
          {loading && tasks.length === 0 ? (
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

                  {/* Centered title + description */}
                  <LocaleText style={[styles.taskName, { color: isDisabled ? theme.textMuted : theme.text }]}>
                    {t(`cityTasks.taskTypes.${task.taskType}` as any)}
                  </LocaleText>
                  <LocaleText style={[styles.taskDesc, { color: theme.textMuted }]}>
                    {hasCountInDesc
                      ? t(taskDescKey, { count: task.requiredCount })
                      : t(taskDescKey)}
                  </LocaleText>

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

                  {/* Participants — centered with avatar + profile tap */}
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
                      {showX2Timer && (
                        <X2TimerBadge canDoubleUntil={task.canDoubleUntil!} />
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
        visible={collectStars !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setCollectStars(null)}
      >
        <View style={modalStyles.overlay}>
          <View style={[modalStyles.sheet, { backgroundColor: isDark ? '#1A2E3E' : '#FFFFFF' }]}>
            <Image source={STAR_ICON} style={modalStyles.starIcon} contentFit="contain" />
            <LocaleText style={[modalStyles.starsNumber, { color: isDark ? '#F5C842' : '#C89B00' }]}>
              {collectStars}
            </LocaleText>
            <LocaleText style={[modalStyles.title, { color: theme.text }]}>
              {t('cityTasks.collectResultTitle')}
            </LocaleText>
            <LocaleText style={[modalStyles.body, { color: theme.textMuted }]}>
              {t('cityTasks.collectResultBody', { count: collectStars ?? 0 })}
            </LocaleText>
            <TouchableOpacity
              style={[modalStyles.btn, { backgroundColor: '#3FA535' }]}
              onPress={() => setCollectStars(null)}
              activeOpacity={0.8}
            >
              <LocaleText style={modalStyles.btnOk}>
                {t('cityTasks.collectResultBtn')}
              </LocaleText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  starsIcon:  { width: 44, height: 44 },
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

  taskName: { fontFamily: 'Fredoka_600SemiBold', fontSize: 17, textAlign: 'center' },
  taskDesc: { fontFamily: 'Fredoka_400Regular', fontSize: 13, lineHeight: 17, textAlign: 'center' },

  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  progressLabel:    { fontFamily: 'Fredoka_400Regular', fontSize: 13 },
  progressText:     { fontFamily: 'Fredoka_600SemiBold', fontSize: 13 },
  progressBar:      { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill:     { height: '100%', borderRadius: 3 },

  /* Participants */
  participantsRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', flexWrap: 'wrap' },
  participantChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  participantAvatar: { width: 22, height: 22, borderRadius: 11 },
  participantName: { fontFamily: 'Fredoka_500Medium', fontSize: 13 },

  /* Actions */
  actions: { gap: 6, marginTop: 2 },
  btn:     { borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontFamily: 'Fredoka_600SemiBold', fontSize: 14 },

  emptyText: { fontFamily: 'Fredoka_500Medium', fontSize: 15, textAlign: 'center' },
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
});

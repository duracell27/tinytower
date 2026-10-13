import React, { useEffect, useCallback } from 'react';
import {
  View, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LocaleText from '../../src/components/LocaleText';
import AppBackground from '../../src/components/AppBackground';
import { useCityTaskStore } from '../../src/stores/cityTaskStore';
import { useCityStore } from '../../src/stores/cityStore';
import { useAuthStore } from '../../src/stores/authStore';
import { useAppTheme } from '../../src/hooks/useAppTheme';
import type { CityTaskSummary } from '../../src/services/api';

const LEADERSHIP_ROLES = ['MAYOR', 'ACTING_MAYOR', 'VICE_MAYOR'] as const;

export default function CityTasksScreen() {
  const { t } = useTranslation('tabs');
  const theme = useAppTheme();
  const router = useRouter();
  const { top } = useSafeAreaInsets();
  const { tasks, myActiveTaskId, cityStyleStars, loading, fetchTasks, joinTask, collectTask, cancelTask } = useCityTaskStore();
  const city = useCityStore((s) => s.city);
  const playerId = useAuthStore((s) => s.player?.id);

  const myRole = city?.members?.find((m) => m.playerId === playerId)?.role;
  const canModerate = myRole ? (LEADERSHIP_ROLES as readonly string[]).includes(myRole) : false;

  useFocusEffect(useCallback(() => { fetchTasks(); }, []));

  const isX2Active = (task: CityTaskSummary) =>
    task.takenAt != null && Date.now() < new Date(task.canDoubleUntil!).getTime();

  const renderStatus = (task: CityTaskSummary) => {
    switch (task.status) {
      case 'AVAILABLE':   return t('cityTasks.available');
      case 'IN_PROGRESS': return t('cityTasks.inProgress');
      case 'COMPLETED':   return t('cityTasks.completed');
      case 'COLLECTED':   return t('cityTasks.collected');
      case 'EXPIRED':     return t('cityTasks.expired');
    }
  };

  const handleJoin = async (taskId: string) => {
    try { await joinTask(taskId); } catch {}
  };
  const handleCollect = async (taskId: string) => {
    try { await collectTask(taskId); } catch {}
  };
  const handleCancel = async (taskId: string) => {
    try { await cancelTask(taskId); } catch {}
  };

  return (
    <AppBackground>
      <View style={[styles.header, { paddingTop: top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <LocaleText style={[styles.backText, { color: '#2592AB' }]}>←</LocaleText>
        </TouchableOpacity>
        <LocaleText style={[styles.title, { color: theme.text }]}>
          {t('cityTasks.title')}
        </LocaleText>
        <LocaleText style={[styles.stars, { color: '#2592AB' }]}>
          {t('cityTasks.styleStars', { count: cityStyleStars })}
        </LocaleText>
      </View>

      {loading && tasks.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#2592AB" />
      ) : tasks.length === 0 ? (
        <LocaleText style={[styles.empty, { color: theme.textMuted }]}>
          {t('cityTasks.noTasks')}
        </LocaleText>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {tasks.map((task) => {
            const progressRatio = Math.min(1, task.currentProgress / Math.max(1, task.requiredCount));
            const amParticipant = task.participants.some((p) => p.playerId === playerId);
            const canJoin = (task.status === 'AVAILABLE' || task.status === 'IN_PROGRESS')
              && !myActiveTaskId
              && task.participants.length < 2;

            return (
              <View key={task.id} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
                <View style={styles.cardHeader}>
                  <LocaleText style={[styles.taskName, { color: theme.text }]}>
                    {t(`cityTasks.taskTypes.${task.taskType}`)}
                  </LocaleText>
                  <View style={styles.badges}>
                    {task.canDoubleUntil && isX2Active(task) && (
                      <View style={[styles.x2Badge, { backgroundColor: '#2592AB' }]}>
                        <LocaleText style={styles.x2Text}>{t('cityTasks.doubleBonus')}</LocaleText>
                      </View>
                    )}
                    <LocaleText style={[styles.statusText, { color: task.status === 'COMPLETED' ? '#3FA535' : theme.textMuted }]}>
                      {renderStatus(task)}
                    </LocaleText>
                  </View>
                </View>

                <LocaleText style={[styles.progress, { color: theme.textMuted }]}>
                  {task.currentProgress} / {task.requiredCount}
                </LocaleText>

                <View style={[styles.progressBar, { backgroundColor: theme.divider }]}>
                  <View style={[styles.progressFill, { width: `${progressRatio * 100}%`, backgroundColor: task.status === 'COMPLETED' ? '#3FA535' : '#2592AB' }]} />
                </View>

                <LocaleText style={[styles.participantLabel, { color: theme.textMuted }]}>
                  {t('cityTasks.participants', { count: task.participants.length })}
                </LocaleText>

                <View style={styles.actions}>
                  {amParticipant && task.status === 'IN_PROGRESS' && (
                    <View style={[styles.activeBadge, { backgroundColor: '#2592AB' }]}>
                      <LocaleText style={styles.btnText}>{t('cityTasks.active')}</LocaleText>
                    </View>
                  )}
                  {canJoin && (
                    <TouchableOpacity
                      style={[styles.btn, { backgroundColor: '#2592AB' }]}
                      onPress={() => handleJoin(task.id)}
                    >
                      <LocaleText style={styles.btnText}>{t('cityTasks.join')}</LocaleText>
                    </TouchableOpacity>
                  )}
                  {canModerate && task.status === 'COMPLETED' && (
                    <TouchableOpacity
                      style={[styles.btn, { backgroundColor: '#3FA535' }]}
                      onPress={() => handleCollect(task.id)}
                    >
                      <LocaleText style={styles.btnText}>{t('cityTasks.collect')}</LocaleText>
                    </TouchableOpacity>
                  )}
                  {canModerate && (task.status === 'IN_PROGRESS' || task.status === 'COMPLETED') && (
                    <TouchableOpacity
                      style={[styles.btn, { backgroundColor: '#E53935' }]}
                      onPress={() => handleCancel(task.id)}
                    >
                      <LocaleText style={styles.btnText}>{t('cityTasks.cancel')}</LocaleText>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 4,
  },
  back: { marginBottom: 4 },
  backText: { fontSize: 18 },
  title: { fontSize: 22, fontWeight: '700' },
  stars: { fontSize: 14, fontWeight: '600' },
  empty: { textAlign: 'center', marginTop: 60, fontSize: 16 },
  list: { padding: 16, gap: 12 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  taskName: { fontSize: 15, fontWeight: '600', flex: 1, marginRight: 8 },
  badges: { alignItems: 'flex-end', gap: 4 },
  x2Badge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  x2Text: { color: '#fff', fontSize: 11, fontWeight: '700' },
  statusText: { fontSize: 12 },
  progress: { fontSize: 13 },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  participantLabel: { fontSize: 12 },
  actions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  btn: {
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  activeBadge: {
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 14,
    opacity: 0.85,
  },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});

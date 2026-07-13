import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useGameStore } from '../src/stores/gameStore';
import {
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_GEM_REWARDS,
  ACHIEVEMENT_INCOME_BONUS,
  ACHIEVEMENT_XP_BONUS,
} from '../shared/config/achievementCategories';

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(value / max, 1);
  return (
    <View style={styles.barBg}>
      <View style={[styles.barFill, { width: `${pct * 100}%` }]} />
    </View>
  );
}

export default function AchievementsScreen() {
  const categoryProgress = useGameStore(s => s.categoryProgress);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Назад</Text>
        </Pressable>
        <Text style={styles.heading}>Досягнення</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {ACHIEVEMENT_CATEGORIES.map(category => {
          const prog = categoryProgress[category.key] ?? { progress: 0, currentLevel: 0, claimedLevels: [] };
          const { progress, currentLevel } = prog;
          const isMaxed = currentLevel === 7;
          const currentLevelConfig = category.levels.find(l => l.level === currentLevel);
          const nextLevelConfig = category.levels.find(l => l.level === currentLevel + 1);

          return (
            <View key={category.key} style={styles.card}>
              <Text style={styles.categoryTitle}>{category.title}</Text>

              <Text style={styles.currentTitle}>
                {currentLevel === 0 ? 'Рівень не отримано' : currentLevelConfig?.title ?? ''}
              </Text>

              {isMaxed ? (
                <>
                  <Text style={styles.progressText}>
                    {formatNum(progress)} / {formatNum(category.levels[6].threshold)}
                  </Text>
                  <ProgressBar value={1} max={1} />
                  <Text style={styles.maxedText}>Максимальний рівень досягнуто</Text>
                </>
              ) : nextLevelConfig ? (
                <>
                  <Text style={styles.progressText}>
                    {formatNum(progress)} / {formatNum(nextLevelConfig.threshold)}
                  </Text>
                  <ProgressBar value={progress} max={nextLevelConfig.threshold} />
                  <Text style={styles.nextLabel}>
                    Наступне звання: <Text style={styles.nextTitle}>{nextLevelConfig.title}</Text>
                  </Text>
                  <View style={styles.rewardRow}>
                    <Text style={styles.rewardLabel}>Нагорода: </Text>
                    <Text style={styles.rewardValue}>
                      {ACHIEVEMENT_GEM_REWARDS[nextLevelConfig.level]} 💎
                      {ACHIEVEMENT_INCOME_BONUS[nextLevelConfig.level] > 0
                        ? `  +${ACHIEVEMENT_INCOME_BONUS[nextLevelConfig.level]}% до монет`
                        : ''}
                      {ACHIEVEMENT_XP_BONUS[nextLevelConfig.level] > 0
                        ? `  +${ACHIEVEMENT_XP_BONUS[nextLevelConfig.level]}% до досвіду`
                        : ''}
                    </Text>
                  </View>
                </>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F3EC' },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: { padding: 4 },
  backText: { fontFamily: 'Fredoka_500Medium', fontSize: 16, color: '#3FA535' },
  heading: { fontFamily: 'Fredoka_700Bold', fontSize: 24, color: '#27331F' },
  scroll: { padding: 16, paddingBottom: 120, gap: 14 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    shadowColor: 'rgba(60,80,45,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  categoryTitle: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 18,
    color: '#27331F',
    marginBottom: 4,
  },
  currentTitle: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
    color: '#7C8A6E',
    marginBottom: 10,
  },
  progressText: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 13,
    color: '#5A6652',
    marginBottom: 6,
  },
  barBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(60,120,40,0.12)',
    overflow: 'hidden',
    marginBottom: 10,
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#3FA535',
  },
  nextLabel: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 13,
    color: '#7C8A6E',
    marginBottom: 4,
  },
  nextTitle: {
    fontFamily: 'Fredoka_600SemiBold',
    color: '#27331F',
  },
  rewardRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  rewardLabel: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 13,
    color: '#7C8A6E',
  },
  rewardValue: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
    color: '#3FA535',
  },
  maxedText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    color: '#3FA535',
    marginTop: 4,
  },
});

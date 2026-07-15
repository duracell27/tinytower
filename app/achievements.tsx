import React from 'react';
import { View, Text, ScrollView, StyleSheet, ImageBackground, Image, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useGameStore } from '../src/stores/gameStore';
import {
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_GEM_REWARDS,
  ACHIEVEMENT_INCOME_BONUS,
  ACHIEVEMENT_XP_BONUS,
} from '../shared/config/achievementCategories';

const CATEGORY_IMAGES: Record<string, ReturnType<typeof require>> = {
  buy:      require('../assets/img/achivment/achivBuyCategory.png'),
  list:     require('../assets/img/achivment/achivDeliverCategory.png'),
  collect:  require('../assets/img/achivment/achivCollectcoinsCategory.png'),
  elevator: require('../assets/img/achivment/achivLiftCategory.png'),
};

const DIAMOND_ICON = require('../assets/img/diamond.png');

const TIER_IMAGES: ReturnType<typeof require>[] = [
  require('../assets/img/achivment/0TierAchive.png'),
  require('../assets/img/achivment/1TierAchive.png'),
  require('../assets/img/achivment/2TierAchive.png'),
  require('../assets/img/achivment/3TierAchive.png'),
  require('../assets/img/achivment/4TierAchive.png'),
  require('../assets/img/achivment/5TierAchive.png'),
  require('../assets/img/achivment/6TierAchive.png'),
  require('../assets/img/achivment/7TierAchive.png'),
];

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.floor(n / 1_000)}K`;
  return String(n);
}

function LevelSegments({ current }: { current: number }) {
  return (
    <View style={styles.segmentsRow}>
      {Array.from({ length: 7 }).map((_, i) => (
        <View
          key={i}
          style={[styles.segment, i < current ? styles.segmentFilled : styles.segmentEmpty]}
        />
      ))}
    </View>
  );
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
    <ImageBackground
      source={require('../assets/welcome-bg.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>Achievements</Text>

        {ACHIEVEMENT_CATEGORIES.map(category => {
          const prog = categoryProgress[category.key] ?? { progress: 0, currentLevel: 0, claimedLevels: [] };
          const { progress, currentLevel } = prog;
          const isMaxed = currentLevel === 7;
          const currentLevelConfig = category.levels.find(l => l.level === currentLevel);
          const nextLevelConfig = category.levels.find(l => l.level === currentLevel + 1);
          const nextGems = nextLevelConfig ? ACHIEVEMENT_GEM_REWARDS[nextLevelConfig.level] : 0;
          const nextIncomeBonus = nextLevelConfig ? ACHIEVEMENT_INCOME_BONUS[nextLevelConfig.level] : 0;
          const nextXpBonus = nextLevelConfig ? ACHIEVEMENT_XP_BONUS[nextLevelConfig.level] : 0;
          const currentThreshold = currentLevelConfig?.threshold ?? 0;
          const relativeProgress = Math.max(0, progress - currentThreshold);
          const relativeMax = nextLevelConfig ? nextLevelConfig.threshold : 1;

          return (
            <View key={category.key} style={styles.card}>
              <View style={styles.cardTop}>
                <Image source={CATEGORY_IMAGES[category.key]} style={styles.categoryIcon} />
                <View style={styles.cardTopText}>
                  <Text style={styles.categoryTitle}>{category.title}</Text>
                  <Text style={styles.levelLabel}>
                    {currentLevel === 0
                      ? 'No rank earned'
                      : `Rank ${currentLevel} · ${currentLevelConfig?.title ?? ''}`}
                  </Text>
                </View>
                <Image source={TIER_IMAGES[currentLevel]} style={styles.tierIcon} />
              </View>

              <LevelSegments current={currentLevel} />

              {isMaxed ? (
                <View style={styles.maxedRow}>
                  <Text style={styles.maxedText}>Max level reached 🏆</Text>
                </View>
              ) : nextLevelConfig ? (
                <View style={styles.progressSection}>
                  <View style={styles.nextRankRow}>
                    <View style={styles.inlineRow}>
                      <Text style={styles.sectionLabel}>Next rank: </Text>
                      <Text style={styles.nextTitleBold}>{nextLevelConfig.title}</Text>
                      <Image source={TIER_IMAGES[nextLevelConfig.level]} style={styles.nextTierIcon} />
                    </View>
                    <Text style={styles.progressCount}>
                      {formatCompact(relativeProgress)} / {formatCompact(relativeMax)}
                    </Text>
                  </View>
                  <ProgressBar value={relativeProgress} max={relativeMax} />
                  <View style={styles.inlineRow}>
                    <Text style={styles.sectionLabel}>Reward: </Text>
                    <View style={styles.rewardChip}>
                      <Image source={DIAMOND_ICON} style={styles.diamondIcon} />
                      <Text style={styles.rewardChipText}>{nextGems}</Text>
                    </View>
                    {nextIncomeBonus > 0 && (
                      <View style={styles.rewardChipBonus}>
                        <Text style={styles.rewardChipBonusText}>+{nextIncomeBonus}% coins</Text>
                      </View>
                    )}
                    {nextXpBonus > 0 && (
                      <View style={styles.rewardChipBonus}>
                        <Text style={styles.rewardChipBonusText}>+{nextXpBonus}% XP</Text>
                      </View>
                    )}
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
      >
        <Text style={styles.closeBtnText}>✕</Text>
      </Pressable>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 120,
    gap: 14,
  },
  heading: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 28,
    color: '#27331F',
    marginBottom: 6,
  },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    shadowColor: 'rgba(60,80,45,1)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius: 10,
    elevation: 4,
    gap: 14,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    resizeMode: 'contain',
  },
  cardTopText: {
    flex: 1,
    gap: 2,
  },
  categoryTitle: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 17,
    color: '#27331F',
  },
  levelLabel: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 13,
    color: '#7C8A6E',
  },
  sectionLabel: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 11,
    color: '#9BA3B0',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tierIcon: {
    width: 44,
    height: 44,
    resizeMode: 'contain',
  },

  // Level segments
  segmentsRow: {
    flexDirection: 'row',
    gap: 5,
  },
  segment: {
    flex: 1,
    height: 8,
    borderRadius: 4,
  },
  segmentFilled: {
    backgroundColor: '#3FA535',
  },
  segmentEmpty: {
    backgroundColor: 'rgba(63,165,53,0.15)',
  },

  // Progress
  progressSection: {
    gap: 8,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  nextRankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nextTitleBold: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    color: '#27331F',
  },
  nextTierIcon: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
  },
  progressCount: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 13,
    color: '#5A6652',
  },
  barBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(63,165,53,0.15)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#3FA535',
  },

  // Reward chips
  rewardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  rewardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF9EC',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  diamondIcon: {
    width: 14,
    height: 14,
    resizeMode: 'contain',
  },
  rewardChipText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
    color: '#27331F',
  },
  rewardChipBonus: {
    backgroundColor: '#FFF4E0',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  rewardChipBonusText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
    color: '#A06B00',
  },

  // Maxed
  maxedRow: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  maxedText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
    color: '#3FA535',
  },

  // Close button
  closeBtn: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  closeBtnPressed: {
    opacity: 0.7,
  },
  closeBtnText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 20,
    color: '#fff',
    lineHeight: 22,
  },
});

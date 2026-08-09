import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Image, Pressable, useColorScheme } from 'react-native';
import AppBackground from '../src/components/AppBackground';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { InfoSection } from '../src/components/InfoSection';
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

function formatCompactPrecise(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2).replace(/\.?0+$/, '')}K`;
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
  const isDark = useColorScheme() === 'dark';
  const [infoVisible, setInfoVisible] = useState(false);

  return (
    <AppBackground style={styles.container}>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headingRow}>
          <Text style={[styles.heading, isDark && { color: '#DDE8D8' }]}>Achievements</Text>
          <Pressable onPress={() => setInfoVisible(true)} hitSlop={10}>
            <Image
              source={require('../assets/img/InformationIcon.png')}
              style={styles.infoIcon}
            />
          </Pressable>
        </View>

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
          const relativeMax = nextLevelConfig ? nextLevelConfig.threshold - currentThreshold : 1;

          return (
            <View key={category.key} style={[styles.card, isDark && { backgroundColor: 'rgba(52,55,52,0.97)' }]}>
              <View style={styles.cardTop}>
                <Image source={CATEGORY_IMAGES[category.key]} style={styles.categoryIcon} />
                <View style={styles.cardTopText}>
                  <Text style={[styles.categoryTitle, isDark && { color: '#DDE8D8' }]}>{category.title}</Text>
                  <Text style={[styles.levelLabel, isDark && { color: '#8A9A80' }]}>
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
                      <Text style={[styles.nextTitleBold, isDark && { color: '#DDE8D8' }]}>{nextLevelConfig.title}</Text>
                      <Image source={TIER_IMAGES[nextLevelConfig.level]} style={styles.nextTierIcon} />
                    </View>
                    <Text style={[styles.progressCount, isDark && { color: '#8A9A80' }]}>
                      {formatCompactPrecise(relativeProgress)} / {formatCompact(relativeMax)}
                    </Text>
                  </View>
                  <ProgressBar value={relativeProgress} max={relativeMax} />
                  <View style={styles.inlineRow}>
                    <Text style={styles.sectionLabel}>Reward: </Text>
                    <View style={[styles.rewardChip, isDark && { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                      <Image source={DIAMOND_ICON} style={styles.diamondIcon} />
                      <Text style={[styles.rewardChipText, isDark && { color: '#DDE8D8' }]}>{nextGems}</Text>
                    </View>
                    {nextIncomeBonus > 0 && (
                      <View style={[styles.rewardChipBonus, isDark && { backgroundColor: 'rgba(160,107,0,0.2)' }]}>
                        <Text style={styles.rewardChipBonusText}>+{nextIncomeBonus}% coins</Text>
                      </View>
                    )}
                    {nextXpBonus > 0 && (
                      <View style={[styles.rewardChipBonus, isDark && { backgroundColor: 'rgba(160,107,0,0.2)' }]}>
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

      {infoVisible && (
        <View style={styles.infoOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setInfoVisible(false)} />
          <View style={[styles.infoCard, isDark && { backgroundColor: '#2A2F38' }]}>
            <LinearGradient colors={['#5B8CD6', '#3A6BB5']} style={styles.infoCardHeader}>
              <Text style={styles.infoCardTitle}>Achievements</Text>
              <Pressable onPress={() => setInfoVisible(false)} hitSlop={10}>
                <Text style={styles.infoCardClose}>✕</Text>
              </Pressable>
            </LinearGradient>
            <View style={styles.infoCardBody}>
              <InfoSection
                icon={require('../assets/img/achivment/1TierAchive.png')}
                title="Achievement Ranks"
                text="Each category has 7 ranks to unlock by reaching in-game milestones — buying goods, lifting visitors, collecting revenue, and more."
                accentColor="rgba(90,140,214,0.25)"
              />
              <InfoSection
                icon={require('../assets/img/diamond.png')}
                title="Gem Rewards"
                text="Completing each rank earns gems. Higher ranks give more gems per completion."
                accentColor="rgba(90,140,214,0.25)"
              />
              <InfoSection
                icon={require('../assets/img/greenArrowUp.png')}
                title="Income & XP Bonuses"
                text="Some ranks also grant a permanent income or XP bonus that applies to all future earnings."
                accentColor="rgba(90,140,214,0.25)"
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
  scroll: {
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 120,
    gap: 14,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  heading: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 28,
    color: '#27331F',
  },
  infoIcon: {
    width: 20,
    height: 20,
    opacity: 0.8,
  },
  infoOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(18,26,44,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  infoCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  infoCardTitle: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 17,
    color: '#fff',
  },
  infoCardClose: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 16,
    fontFamily: 'Fredoka_600SemiBold',
  },
  infoCardBody: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 8,
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

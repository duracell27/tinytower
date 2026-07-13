import React, { useCallback } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Dimensions, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../stores/gameStore';
import { GemIcon } from './CurrencyIcons';
import { ACHIEVEMENT_CATEGORIES } from '../../shared/config/achievementCategories';

const TIER_IMAGES: Record<number, ReturnType<typeof require>> = {
  1: require('../../assets/img/achivment/1TierAchive.png'),
  2: require('../../assets/img/achivment/2TierAchive.png'),
  3: require('../../assets/img/achivment/3TierAchive.png'),
  4: require('../../assets/img/achivment/4TierAchive.png'),
  5: require('../../assets/img/achivment/5TierAchive.png'),
  6: require('../../assets/img/achivment/6TierAchive.png'),
  7: require('../../assets/img/achivment/7TierAchive.png'),
};

const CATEGORY_IMAGES: Record<string, ReturnType<typeof require>> = {
  buy:      require('../../assets/img/achivment/achivBuyCategory.png'),
  list:     require('../../assets/img/achivment/achivDeliverCategory.png'),
  collect:  require('../../assets/img/achivment/achivCollectcoinsCategory.png'),
  elevator: require('../../assets/img/achivment/achivLiftCategory.png'),
};

const { width: SCREEN_W } = Dimensions.get('window');

export default function AchievementModal() {
  const { t } = useTranslation('hotel');
  const grant = useGameStore((s) => s.achievementQueue[0] ?? null);
  const dismiss = useGameStore((s) => s.dismissAchievement);

  const scale = useSharedValue(0.5);
  const rewardsOpacity = useSharedValue(0);
  const rewardsY = useSharedValue(20);

  const triggerAnimations = useCallback(() => {
    scale.value = 0.5;
    rewardsOpacity.value = 0;
    rewardsY.value = 20;
    scale.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.back(1.4)) });
    rewardsOpacity.value = withDelay(250, withTiming(1, { duration: 250 }));
    rewardsY.value = withDelay(250, withTiming(0, { duration: 300, easing: Easing.out(Easing.back(1.3)) }));
  }, []);

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const rewardsStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: rewardsY.value }],
    opacity: rewardsOpacity.value,
  }));

  return (
    <Modal
      visible={!!grant}
      transparent
      animationType="fade"
      onRequestClose={dismiss}
      onShow={triggerAnimations}
    >
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />

        {grant && (() => {
          const threshold = ACHIEVEMENT_CATEGORIES
            .find(c => c.key === grant.categoryKey)
            ?.levels.find(l => l.level === grant.level)
            ?.threshold;
          const categoryImg = CATEGORY_IMAGES[grant.categoryKey];
          const tierImg = TIER_IMAGES[grant.level];
          return (
            <Animated.View style={[styles.card, cardStyle]}>
              <LinearGradient colors={['#E8F4FF', '#D0E8FF']} style={styles.cardGradient}>
                {tierImg && <Image source={tierImg} style={styles.tierImage} resizeMode="contain" />}
                <View style={styles.categoryRow}>
                  {categoryImg && <Image source={categoryImg} style={styles.categoryIcon} resizeMode="contain" />}
                  <Text style={styles.tierBadge}>{grant.categoryTitle}</Text>
                </View>
                {threshold != null && (
                  <Text style={styles.thresholdText}>
                    {threshold >= 1_000_000
                      ? `${(threshold / 1_000_000).toFixed(threshold % 1_000_000 === 0 ? 0 : 1)}M`
                      : threshold >= 1_000
                      ? `${(threshold / 1_000).toFixed(threshold % 1_000 === 0 ? 0 : 1)}K`
                      : threshold} дій
                  </Text>
                )}
                <Text style={styles.title}>{grant.title}</Text>

                <Animated.View style={[styles.rewardsContainer, rewardsStyle]}>
                  {grant.gems > 0 && (
                    <View style={styles.rewardRow}>
                      <GemIcon size={16} />
                      <Text style={styles.rewardTextGem}>+{grant.gems}</Text>
                    </View>
                  )}
                  {grant.incomeBonus > 0 && (
                    <View style={styles.rewardRow}>
                      <Text style={styles.rewardText}>+{grant.incomeBonus}% до монет</Text>
                    </View>
                  )}
                  {grant.xpBonus > 0 && (
                    <View style={styles.rewardRow}>
                      <Text style={styles.rewardText}>+{grant.xpBonus}% до досвіду</Text>
                    </View>
                  )}
                </Animated.View>

                <Pressable
                  onPress={dismiss}
                  style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                >
                  <LinearGradient colors={['#4A9FE0', '#2F7BC0']} style={styles.buttonGradient}>
                    <Text style={styles.buttonText}>{t('achievement.claim')}</Text>
                  </LinearGradient>
                  <View style={styles.buttonShadow} />
                </Pressable>
              </LinearGradient>
            </Animated.View>
          );
        })()}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: SCREEN_W * 0.78,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: 'rgba(20,60,120,1)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 12,
  },
  cardGradient: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  tierImage: {
    width: 80,
    height: 80,
    marginBottom: 10,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  categoryIcon: {
    width: 20,
    height: 20,
  },
  tierBadge: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
    color: '#5A8AB0',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  thresholdText: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 12,
    color: '#8AAECF',
    marginBottom: 6,
  },
  title: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 22,
    color: '#1A3D6B',
    marginBottom: 18,
    textAlign: 'center',
  },
  rewardsContainer: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 22,
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingVertical: 6,
    paddingLeft: 8,
    paddingRight: 14,
    borderRadius: 14,
    shadowColor: 'rgba(30,60,120,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  coinIcon: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#F2B330',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)',
  },
  rewardText: {
    fontFamily: 'Fredoka_700Bold', fontSize: 16, color: '#C28A22',
  },
  gemIcon: {
    width: 16, height: 16,
    backgroundColor: '#3FB8D6',
    borderRadius: 3,
    transform: [{ rotate: '45deg' }],
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)',
  },
  rewardTextGem: {
    fontFamily: 'Fredoka_700Bold', fontSize: 16, color: '#2592AB',
  },
  button: {
    width: '100%', borderRadius: 14, overflow: 'hidden',
  },
  buttonPressed: { opacity: 0.85 },
  buttonGradient: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, zIndex: 1,
  },
  buttonText: {
    fontFamily: 'Fredoka_700Bold', fontSize: 18, color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  buttonShadow: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 3, backgroundColor: 'rgba(20,60,100,0.35)',
  },
});

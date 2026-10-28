import React, { useCallback } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Dimensions } from 'react-native';
import LocaleText from './LocaleText';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../stores/gameStore';
import { useOnboardingStore } from '../stores/onboardingStore';
import { CoinIcon, GemIcon } from './CurrencyIcons';
import { formatNum } from '../utils/format';
import { useAppTheme } from '../hooks/useAppTheme';
import { useModalBreadcrumb } from '../hooks/useModalBreadcrumb';
import { useModalQueue } from '../hooks/useModalQueue';

const { width: SCREEN_W } = Dimensions.get('window');

const TOOL_IMAGES: Record<string, ReturnType<typeof require>> = {
  briks:  require('../../assets/img/tools/briks.png'),
  glass:  require('../../assets/img/tools/glass.png'),
  nails:  require('../../assets/img/tools/nails.png'),
  screw:  require('../../assets/img/tools/screw.png'),
  wood:   require('../../assets/img/tools/wood.png'),
  cement: require('../../assets/img/tools/cement.png'),
};
const ALL_TOOLS_IMG  = require('../../assets/img/tools/allTools.png');
const ALL_TOKENS_IMG = require('../../assets/img/tokens/tokens.png');
const MARKETING_IMG  = require('../../assets/img/MarketingIcon.png');
const PR_IMG         = require('../../assets/img/PRIcon.png');

export default function DailyLoginRewardModal() {
  const { t } = useTranslation('hotel');
  const theme = useAppTheme();
  const { isDark } = theme;
  const reward = useGameStore((s) => s.pendingDailyLoginReward);
  const dismiss = useGameStore((s) => s.dismissDailyLoginReward);
  const activeSheetCount = useGameStore((s) => s.activeSheetCount);
  const isOnboarding = useOnboardingStore((s) => s.isActive);

  const isQueued = useModalQueue('DailyLoginReward', !!reward && !isOnboarding);
  const visible = isQueued && activeSheetCount === 0;
  useModalBreadcrumb('DailyLoginReward', visible);

  const scale = useSharedValue(0.5);

  const triggerAnimations = useCallback(() => {
    scale.value = 0.5;
    scale.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) });
  }, []);

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const bg    = isDark ? '#1E2A3A' : '#FFF9E6';
  const bgGrad: [string, string] = isDark ? ['#1E2A3A', '#141E2E'] : ['#FFF9E6', '#FFF3CC'];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={dismiss}
      onShow={triggerAnimations}
    >
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />

        {reward && (
          <Animated.View style={[styles.card, cardStyle, { backgroundColor: bg }]}>
            <LinearGradient colors={bgGrad} style={styles.cardGradient}>

              {/* Day badge + streak dots */}
              <View style={[styles.dayBadge, { backgroundColor: isDark ? '#2A3F5A' : '#FFF0C0' }]}>
                <LocaleText style={[styles.dayBadgeText, isDark && { color: '#F5C842' }]}>
                  {t('dailyLoginReward.dayLabel', { day: reward.day })}
                </LocaleText>
              </View>

              <View style={styles.dotsRow}>
                {Array.from({ length: 7 }, (_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      i < reward.day
                        ? styles.dotFilled
                        : { backgroundColor: isDark ? '#2A3F5A' : '#E8D9A0' },
                    ]}
                  />
                ))}
              </View>

              <LocaleText style={[styles.title, isDark && { color: theme.text }]}>
                {t('dailyLoginReward.title')}
              </LocaleText>

              {/* Today's rewards */}
              <View style={styles.rewardsContainer}>
                <View style={[styles.rewardRow, { backgroundColor: isDark ? theme.surfaceCard : '#fff' }]}>
                  <CoinIcon size={20} />
                  <LocaleText style={[styles.rewardText, isDark && { color: '#F5C842' }]}>
                    +{formatNum(reward.coins)}
                  </LocaleText>
                </View>

                <View style={[styles.rewardRow, { backgroundColor: isDark ? theme.surfaceCard : '#fff' }]}>
                  <GemIcon size={16} />
                  <LocaleText style={[styles.rewardTextGem, isDark && { color: '#4DC8E0' }]}>
                    +{reward.gems}
                  </LocaleText>
                </View>

                {reward.tools && reward.tools.length > 0 && (
                  <View style={[styles.rewardRow, { backgroundColor: isDark ? theme.surfaceCard : '#fff' }]}>
                    {reward.tools.length === 1 ? (
                      <Image source={TOOL_IMAGES[reward.tools[0]]} style={styles.rewardImg} contentFit="contain" />
                    ) : (
                      <Image source={ALL_TOOLS_IMG} style={styles.rewardImg} contentFit="contain" />
                    )}
                    <LocaleText style={[styles.rewardText, isDark && { color: theme.text }]}>
                      {t('dailyLoginReward.toolReward', { count: reward.tools.length })}
                    </LocaleText>
                  </View>
                )}

                {reward.tokens && reward.tokens.length > 0 && (
                  <View style={[styles.rewardRow, { backgroundColor: isDark ? theme.surfaceCard : '#fff' }]}>
                    <Image source={ALL_TOKENS_IMG} style={styles.rewardImg} contentFit="contain" />
                    <LocaleText style={[styles.rewardText, isDark && { color: theme.text }]}>
                      {t('dailyLoginReward.tokenReward', { count: reward.tokens.length })}
                    </LocaleText>
                  </View>
                )}

                {reward.boost && (
                  <View style={[styles.rewardRow, { backgroundColor: isDark ? theme.surfaceCard : '#fff' }]}>
                    <Image
                      source={reward.boost.type === 'coin' ? MARKETING_IMG : PR_IMG}
                      style={styles.rewardImg}
                      contentFit="contain"
                    />
                    <LocaleText style={[styles.rewardText, isDark && { color: theme.text }]}>
                      {reward.boost.extended
                        ? t('dailyLoginReward.boostExtended', {
                            type: reward.boost.type === 'coin'
                              ? t('dailyLoginReward.boostTypeCoin')
                              : t('dailyLoginReward.boostTypeXp'),
                          })
                        : t('dailyLoginReward.boostNew', {
                            percent: reward.boost.percent,
                            type: reward.boost.type === 'coin'
                              ? t('dailyLoginReward.boostTypeCoin')
                              : t('dailyLoginReward.boostTypeXp'),
                          })}
                    </LocaleText>
                  </View>
                )}
              </View>

              {/* Claim button */}
              <Pressable
                onPress={dismiss}
                style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
              >
                <LinearGradient colors={['#74D44F', '#5BA63C']} style={styles.buttonGradient}>
                  <LocaleText style={styles.buttonText}>{t('dailyLoginReward.claim')}</LocaleText>
                </LinearGradient>
                <View style={styles.buttonShadow} />
              </Pressable>

              {/* Tomorrow preview — hidden on day 7 */}
              {reward.day < 7 && <View style={[styles.tomorrow, { backgroundColor: isDark ? '#141E2E' : '#EDE0B0' }]}>
                <LocaleText style={[styles.tomorrowLabel, isDark && { color: theme.textMuted }]}>
                  {t('dailyLoginReward.tomorrow')}
                </LocaleText>
                <View style={styles.tomorrowRow}>
                  <CoinIcon size={15} />
                  <LocaleText style={[styles.tomorrowValue, isDark && { color: theme.text }]}>
                    {formatNum(reward.tomorrowReward.coins)}
                  </LocaleText>
                  <GemIcon size={13} />
                  <LocaleText style={[styles.tomorrowValue, isDark && { color: theme.text }]}>
                    {reward.tomorrowReward.gems}
                  </LocaleText>

                  {reward.tomorrowReward.extra?.type === 'tool' && (
                    <View style={styles.tomorrowExtra}>
                      <Image source={ALL_TOOLS_IMG} style={styles.tomorrowImg} contentFit="contain" />
                      <LocaleText style={[styles.tomorrowExtraText, isDark && { color: theme.text }]}>
                        ×{reward.tomorrowReward.extra.count}
                      </LocaleText>
                    </View>
                  )}

                  {reward.tomorrowReward.extra?.type === 'token' && (
                    <View style={styles.tomorrowExtra}>
                      <Image source={ALL_TOKENS_IMG} style={styles.tomorrowImg} contentFit="contain" />
                      <LocaleText style={[styles.tomorrowExtraText, isDark && { color: theme.text }]}>
                        ×{reward.tomorrowReward.extra.count}
                      </LocaleText>
                    </View>
                  )}

                  {(reward.tomorrowReward.extra?.type === 'coinBoost' || reward.tomorrowReward.extra?.type === 'xpBoost') && (
                    <View style={styles.tomorrowExtra}>
                      <Image
                        source={reward.tomorrowReward.extra.type === 'coinBoost' ? MARKETING_IMG : PR_IMG}
                        style={styles.tomorrowImg}
                        contentFit="contain"
                      />
                      <LocaleText style={[styles.tomorrowExtraText, isDark && { color: theme.text }]}>
                        +{reward.tomorrowReward.extra.percent}%
                      </LocaleText>
                    </View>
                  )}
                </View>
              </View>}

            </LinearGradient>
          </Animated.View>
        )}
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
    width: SCREEN_W * 0.82,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: 'rgba(120,100,20,1)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 12,
  },
  cardGradient: {
    alignItems: 'center',
    paddingTop: 22,
    paddingBottom: 22,
    paddingHorizontal: 22,
  },

  // Day badge
  dayBadge: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 10,
  },
  dayBadgeText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 20,
    color: '#C28A22',
    letterSpacing: 0.5,
  },

  // Streak dots
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotFilled: {
    backgroundColor: '#F2B330',
  },

  title: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 16,
    color: '#5A7A35',
    marginBottom: 16,
  },

  // Reward rows
  rewardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 18,
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingLeft: 8,
    paddingRight: 12,
    borderRadius: 14,
    shadowColor: 'rgba(100,90,40,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  rewardText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 16,
    color: '#C28A22',
  },
  rewardTextGem: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 16,
    color: '#2592AB',
  },
  rewardImg: {
    width: 22,
    height: 22,
  },

  // Button
  button: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
  },
  buttonPressed: { opacity: 0.85 },
  buttonGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    zIndex: 1,
  },
  buttonText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 18,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  buttonShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(40,90,25,0.35)',
  },

  // Tomorrow
  tomorrow: {
    width: '100%',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 6,
  },
  tomorrowLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
    color: '#7C9A5E',
  },
  tomorrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tomorrowValue: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 15,
    color: '#5A7A35',
  },
  tomorrowExtra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 4,
  },
  tomorrowImg: {
    width: 22,
    height: 22,
  },
  tomorrowExtraText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 14,
    color: '#5A7A35',
  },
});

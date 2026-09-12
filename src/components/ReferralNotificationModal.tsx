import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Dimensions, ActivityIndicator, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../stores/gameStore';
import { useOnboardingStore } from '../stores/onboardingStore';
import { CoinIcon, GemIcon } from './CurrencyIcons';
import { api } from '../services/api';
import { syncService } from '../services/sync';
import { useAppTheme } from '../hooks/useAppTheme';

const { width: SCREEN_W } = Dimensions.get('window');

export default function ReferralNotificationModal() {
  const { t } = useTranslation('tabs');
  const theme = useAppTheme();
  const styles = getStyles(theme);
  const notification = useGameStore((s) => s.pendingReferralNotifications[0] ?? null);
  const dismiss = useGameStore((s) => s.dismissReferralNotification);
  const activeSheetCount = useGameStore((s) => s.activeSheetCount);
  const isOnboarding = useOnboardingStore((s) => s.isActive);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const scale = useSharedValue(0.5);
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const triggerAnimation = useCallback(() => {
    scale.value = 0.5;
    scale.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) });
    setError('');
    setLoading(false);
  }, []);

  const handleClaim = async () => {
    if (notification?.type !== 'claim') return;
    setLoading(true);
    setError('');
    try {
      await api.post('/referrals/claim', {
        referralId: notification.referralId,
        milestone: notification.milestone,
      });
      dismiss();
      // Delay so the server has time to commit the claim before we sync state
      setTimeout(() => syncService.triggerSync(), 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const isClaimModal = notification?.type === 'claim';
  const isPurchaseModal = notification?.type === 'purchase_bonus';
  const isReferredBonusModal = notification?.type === 'referred_bonus';

  return (
    <Modal
      visible={!!notification && activeSheetCount === 0 && !isOnboarding}
      transparent
      animationType="none"
      onRequestClose={isClaimModal ? undefined : dismiss}
      onShow={triggerAnimation}
    >
      <View style={styles.scrim}>
        {!isClaimModal && <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />}

        {notification && (
          <Animated.View style={[styles.card, cardStyle]}>
            <LinearGradient
              colors={
                theme.isDark
                  ? (isReferredBonusModal ? ['#1A3326', '#0F2219'] : ['#162340', '#0E1829'])
                  : (isReferredBonusModal ? ['#E8FFF0', '#D0F5DC'] : ['#E8F4FF', '#D0E8FF'])
              }
              style={styles.cardGradient}
            >

              {isClaimModal && (
                <>
                  <Image source={require('../../assets/img/confetti.png')} style={styles.headerIcon} resizeMode="contain" />
                  <Text style={styles.title}>{t('referralModal.rewardTitle')}</Text>
                  <Text style={styles.body}>
                    {notification.referredName}{' '}
                    {notification.milestone === 'registered'
                      ? t('referralModal.joinedViaLink')
                      : notification.milestone === 'level10'
                      ? t('referralModal.reachedLevel10')
                      : t('referralModal.reachedLevel30')}
                  </Text>
                  <View style={styles.rewardRow}>
                    {notification.milestone === 'registered' ? (
                      <>
                        <Image
                          source={require('../../assets/img/coin.png')}
                          style={{ width: 18, height: 18 }}
                        />
                        <Text style={styles.rewardText}>+{notification.coins.toLocaleString()}</Text>
                      </>
                    ) : (
                      <>
                        <GemIcon size={18} />
                        <Text style={styles.rewardText}>+{notification.gems}</Text>
                      </>
                    )}
                  </View>
                  {error ? <Text style={styles.errorText}>{error}</Text> : null}
                  <Pressable
                    onPress={handleClaim}
                    disabled={loading}
                    style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                  >
                    <LinearGradient colors={['#4A9FE0', '#2F7BC0']} style={styles.buttonGradient}>
                      {loading ? (
                        <ActivityIndicator color="#fff" />
                      ) : notification.milestone === 'registered' ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.buttonText}>{t('referralModal.claimCoins', { coins: notification.coins.toLocaleString() })}</Text>
                          <CoinIcon size={18} />
                        </View>
                      ) : notification.milestone === 'level10' ? (
                        <Text style={styles.buttonText}>{t('referralModal.claimGems', { gems: notification.gems })}</Text>
                      ) : (
                        <Text style={styles.buttonText}>{t('referralModal.claimGems', { gems: notification.gems })}</Text>
                      )}
                    </LinearGradient>
                    <View style={styles.buttonShadow} />
                  </Pressable>
                </>
              )}

              {isPurchaseModal && (
                <>
                  <Image source={require('../../assets/img/diamond+percent.png')} style={styles.purchaseIllustration} resizeMode="contain" />
                  <Text style={styles.title}>{t('referralModal.bonusTitle')}</Text>
                  <Text style={styles.body}>
                    {notification.names.length === 1
                      ? t('referralModal.madeAPurchase', { name: notification.names[0] })
                      : t('referralModal.madeAPurchasePlural', { name: notification.names[0], count: notification.names.length - 1 })}
                  </Text>
                  <View style={styles.rewardRow}>
                    <GemIcon size={18} />
                    <Text style={styles.rewardText}>+{notification.totalBonus}</Text>
                  </View>
                  <Pressable
                    onPress={dismiss}
                    style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                  >
                    <LinearGradient colors={['#4A9FE0', '#2F7BC0']} style={styles.buttonGradient}>
                      <Text style={styles.buttonText}>{t('referralModal.awesome')}</Text>
                    </LinearGradient>
                    <View style={styles.buttonShadow} />
                  </Pressable>
                </>
              )}

              {notification?.type === 'referred_bonus' && (
                <>
                  <Image
                    source={require('../../assets/img/confetti.png')}
                    style={styles.confettiIcon}
                    resizeMode="contain"
                  />
                  <Text style={[styles.title, styles.titleGreen]}>{t('referralModal.welcomeTitle')}</Text>
                  <Text style={[styles.body, styles.bodyGreen]}>{t('referralModal.usedReferralCode')}</Text>
                  <View style={styles.referredRewardRow}>
                    <View style={styles.rewardRow}>
                      <Image
                        source={require('../../assets/img/coin.png')}
                        style={{ width: 18, height: 18 }}
                      />
                      <Text style={styles.rewardText}>+{notification.coins.toLocaleString()}</Text>
                    </View>
                    <View style={styles.rewardRow}>
                      <GemIcon size={18} />
                      <Text style={styles.rewardText}>+{notification.gems}</Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={dismiss}
                    style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                  >
                    <LinearGradient colors={['#3FA535', '#2D7A25']} style={styles.buttonGradient}>
                      <Text style={styles.buttonText}>{t('referralModal.awesome')}</Text>
                    </LinearGradient>
                    <View style={styles.buttonShadow} />
                  </Pressable>
                </>
              )}

            </LinearGradient>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

function getStyles(theme: ReturnType<typeof useAppTheme>) {
  const { isDark } = theme;
  return StyleSheet.create({
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
      paddingTop: 28,
      paddingBottom: 24,
      paddingHorizontal: 24,
      gap: 12,
    },
    headerIcon: {
      width: 72,
      height: 72,
    },
    purchaseIllustration: {
      width: 72,
      height: 72,
    },
    confettiIcon: {
      width: 72,
      height: 72,
    }, // kept for referredBonusModal which uses its own image
    referredRewardRow: {
      flexDirection: 'row',
      gap: 10,
    },
    title: {
      fontFamily: 'Fredoka_700Bold',
      fontSize: 22,
      color: isDark ? '#C8E8FF' : '#1A3D6B',
      textAlign: 'center',
    },
    titleGreen: {
      color: isDark ? '#A8E8C0' : '#1A4D2E',
    },
    body: {
      fontFamily: 'Nunito_600SemiBold',
      fontSize: 15,
      color: isDark ? '#8AAFD4' : '#3E5A80',
      textAlign: 'center',
    },
    bodyGreen: {
      color: isDark ? '#6ABDA0' : '#2A5A40',
    },
    rewardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : theme.surface,
      borderWidth: isDark ? 1 : 0,
      borderColor: 'rgba(255,255,255,0.12)',
      paddingVertical: 8,
      paddingHorizontal: 18,
      borderRadius: 14,
      shadowColor: 'rgba(30,60,120,1)',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0 : 0.12,
      shadowRadius: 4,
      elevation: isDark ? 0 : 2,
      marginVertical: 4,
    },
    rewardText: {
      fontFamily: 'Fredoka_700Bold',
      fontSize: 20,
      color: isDark ? '#7DD4E8' : '#2592AB',
    },
    errorText: {
      fontFamily: 'Nunito_400Regular',
      fontSize: 13,
      color: '#C0372A',
      textAlign: 'center',
    },
    button: {
      width: '100%',
      borderRadius: 14,
      overflow: 'hidden',
      marginTop: 4,
    },
    buttonPressed: { opacity: 0.85 },
    buttonGradient: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 13,
      zIndex: 1,
      minHeight: 46,
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
      backgroundColor: 'rgba(20,60,100,0.35)',
    },
  });
}

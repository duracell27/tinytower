import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions, Modal } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { CoinIcon, GemIcon } from './CurrencyIcons';
import { formatNum } from '../utils/format';
import type { DeliverAllSummary } from '../stores/gameStore';

const { width: SCREEN_W } = Dimensions.get('window');

interface DeliverAllModalProps {
  visible: boolean;
  summary: DeliverAllSummary | null;
  onDismiss: () => void;
  asOverlay?: boolean;
}


export default function DeliverAllModal({ visible, summary, onDismiss, asOverlay = false }: DeliverAllModalProps) {
  const { t } = useTranslation('hotel');
  const theme = useAppTheme();
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible && summary) {
      opacity.value = withTiming(1, { duration: 200 });
      scale.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) });
    } else {
      opacity.value = 0;
      scale.value = 0.5;
    }
  }, [visible, summary]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!visible || !summary) return null;

  const inner = (
    <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
        <Animated.View style={[styles.card, cardStyle]}>
            <LinearGradient
              colors={theme.isDark ? ['#1E2028', '#252930'] : ['#F0F4FA', '#E4EAF2']}
              style={styles.cardGradient}
            >
              <Text style={[styles.title, { color: theme.isDark ? '#8ACE6A' : '#3D6B1E' }]}>{t('deliverAll.title')}</Text>

              {summary.guestCount > 0 && (
                <View style={styles.row}>
                  <Text style={[styles.rowLabel, { color: theme.isDark ? '#B0BAC8' : '#5A6478' }]}>{t('deliverAll.rows.guests', { count: summary.guestCount })}</Text>
                </View>
              )}
              {summary.businessmanCount > 0 && (
                <View style={styles.row}>
                  <Text style={[styles.rowLabel, { color: theme.isDark ? '#B0BAC8' : '#5A6478' }]}>{t('deliverAll.rows.businessmen', { count: summary.businessmanCount })}</Text>
                </View>
              )}
              {summary.delivererCount > 0 && (
                <View style={styles.row}>
                  <Text style={[styles.rowLabel, { color: theme.isDark ? '#B0BAC8' : '#5A6478' }]}>{t('deliverAll.rows.deliverers', { count: summary.delivererCount })}</Text>
                </View>
              )}
              {summary.sellerCount > 0 && (
                <View style={styles.row}>
                  <Text style={[styles.rowLabel, { color: theme.isDark ? '#B0BAC8' : '#5A6478' }]}>{t('deliverAll.rows.sellers', { count: summary.sellerCount })}</Text>
                </View>
              )}
              {summary.builderCount > 0 && (
                <View style={styles.row}>
                  <Text style={[styles.rowLabel, { color: theme.isDark ? '#B0BAC8' : '#5A6478' }]}>{t('deliverAll.rows.builders', { count: summary.builderCount })}</Text>
                </View>
              )}
              {(['guest', 'businessman', 'deliverer', 'seller', 'builder'] as const).map((role) => {
                const count = summary.vipBreakdown[role];
                if (!count) return null;
                return (
                  <View key={role} style={styles.row}>
                    <Text style={[styles.rowLabel, { color: theme.isDark ? '#B0BAC8' : '#5A6478' }]}>{t(`deliverAll.rows.vip_${role}`, { count })}</Text>
                  </View>
                );
              })}
              {summary.newWorkers > 0 && (
                <View style={styles.row}>
                  <Text style={[styles.rowLabel, { color: theme.isDark ? '#B0BAC8' : '#5A6478' }]}>{t('deliverAll.rows.newWorkers', { count: summary.newWorkers })}</Text>
                </View>
              )}

              <View style={styles.divider} />

              <View style={styles.totalRow}>
                {summary.totalCoins > 0 && (
                  <View style={[styles.totalChip, { backgroundColor: theme.surface }]}>
                    <CoinIcon size={16} />
                    <Text style={styles.totalCoinsText}>+{formatNum(summary.totalCoins)}</Text>
                  </View>
                )}
                {summary.totalGems > 0 && (
                  <View style={[styles.totalChip, { backgroundColor: theme.surface }]}>
                    <GemIcon size={14} />
                    <Text style={styles.totalGemsText}>+{summary.totalGems}</Text>
                  </View>
                )}
              </View>

              <Pressable onPress={onDismiss} style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}>
                <LinearGradient colors={['#6C7C92', '#56657C']} style={styles.buttonGradient}>
                  <Text style={styles.buttonText}>{t('deliverAll.done')}</Text>
                </LinearGradient>
                <View style={styles.buttonShadow} />
              </Pressable>
            </LinearGradient>
          </Animated.View>
      </Animated.View>
  );

  if (asOverlay) {
    return <View style={StyleSheet.absoluteFill}>{inner}</View>;
  }
  return (
    <Modal visible transparent animationType="none" onRequestClose={onDismiss}>
      {inner}
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: SCREEN_W * 0.78,
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
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  title: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 24,
    marginBottom: 16,
  },
  row: {
    width: '100%',
    marginBottom: 8,
  },
  rowLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(100,110,120,0.2)',
    marginVertical: 14,
    width: '100%',
  },
  totalRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
    justifyContent: 'center',
  },
  totalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    shadowColor: 'rgba(100,90,40,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  totalCoinsText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 14,
    color: '#C28A22',
  },
  totalGemsText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 14,
    color: '#2592AB',
  },
  button: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
  },
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
    backgroundColor: 'rgba(40,50,60,0.35)',
  },
});

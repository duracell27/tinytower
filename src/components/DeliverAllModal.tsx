import React, { useEffect } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

const { width: SCREEN_W } = Dimensions.get('window');

export interface DeliverAllSummary {
  guestCount: number;
  businessmanCount: number;
  delivererCount: number;
  sellerCount: number;
  builderCount: number;
  totalCoins: number;
  totalGems: number;
  newWorkers: number;
}

interface DeliverAllModalProps {
  visible: boolean;
  summary: DeliverAllSummary | null;
  onDismiss: () => void;
}

function formatNumber(n: number): string {
  if (n >= 1000) {
    const str = String(n);
    const parts: string[] = [];
    for (let i = str.length; i > 0; i -= 3) {
      parts.unshift(str.slice(Math.max(0, i - 3), i));
    }
    return parts.join(' ');
  }
  return String(n);
}

export default function DeliverAllModal({ visible, summary, onDismiss }: DeliverAllModalProps) {
  if (!visible || !summary) return null;
  return <DeliverAllContent summary={summary} onDismiss={onDismiss} />;
}

function DeliverAllContent({ summary, onDismiss }: { summary: DeliverAllSummary; onDismiss: () => void }) {
  const { t } = useTranslation('hotel');
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 200 });
    scale.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.back(1.4)) });
  }, []);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Modal transparent animationType="none" onRequestClose={onDismiss}>
      <Animated.View style={[styles.scrim, scrimStyle]}>
        <Pressable style={styles.scrimPress} onPress={onDismiss} />
        <Animated.View style={[styles.card, cardStyle]}>
          <LinearGradient colors={['#F0F4FA', '#E4EAF2']} style={styles.cardGradient}>
            <Text style={styles.title}>{t('deliverAll.title')}</Text>

            {summary.guestCount > 0 && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{t('deliverAll.rows.guests', { count: summary.guestCount })}</Text>
              </View>
            )}
            {summary.businessmanCount > 0 && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{t('deliverAll.rows.businessmen', { count: summary.businessmanCount })}</Text>
              </View>
            )}
            {summary.delivererCount > 0 && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{t('deliverAll.rows.deliverers', { count: summary.delivererCount })}</Text>
              </View>
            )}
            {summary.sellerCount > 0 && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{t('deliverAll.rows.sellers', { count: summary.sellerCount })}</Text>
              </View>
            )}
            {summary.builderCount > 0 && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{t('deliverAll.rows.builders', { count: summary.builderCount })}</Text>
              </View>
            )}
            {summary.newWorkers > 0 && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{t('deliverAll.rows.newWorkers', { count: summary.newWorkers })}</Text>
              </View>
            )}

            <View style={styles.divider} />

            <View style={styles.totalRow}>
              {summary.totalCoins > 0 && (
                <View style={styles.totalChip}>
                  <View style={styles.coinDot} />
                  <Text style={styles.totalCoinsText}>+{formatNumber(summary.totalCoins)}</Text>
                </View>
              )}
              {summary.totalGems > 0 && (
                <View style={styles.totalChip}>
                  <View style={styles.gemDot} />
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
  scrimPress: {
    ...StyleSheet.absoluteFillObject,
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
    color: '#3D6B1E',
    marginBottom: 16,
  },
  row: {
    width: '100%',
    marginBottom: 8,
  },
  rowLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    color: '#5A6478',
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
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    shadowColor: 'rgba(100,90,40,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  coinDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#F2B330',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  totalCoinsText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 14,
    color: '#C28A22',
  },
  gemDot: {
    width: 12,
    height: 12,
    backgroundColor: '#3FB8D6',
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
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

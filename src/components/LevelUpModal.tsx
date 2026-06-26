import React, { useCallback } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Dimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useGameStore, type LevelUpEvent } from '../stores/gameStore';

const { width: SCREEN_W } = Dimensions.get('window');

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

export default function LevelUpModal({ suppressWhileOpen = false }: { suppressWhileOpen?: boolean }) {
  const event = useGameStore((s) => s.levelUpQueue[0] ?? null);
  const dismiss = useGameStore((s) => s.dismissLevelUp);

  const scale = useSharedValue(0.5);
  const starScale = useSharedValue(0);
  const rewardsY = useSharedValue(20);
  const rewardsOpacity = useSharedValue(0);

  const triggerAnimations = useCallback(() => {
    scale.value = 0.5;
    starScale.value = 0;
    rewardsY.value = 20;
    rewardsOpacity.value = 0;
    scale.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.back(1.4)) });
    starScale.value = withDelay(150, withTiming(1, { duration: 300, easing: Easing.out(Easing.back(1.3)) }));
    rewardsOpacity.value = withDelay(300, withTiming(1, { duration: 250 }));
    rewardsY.value = withDelay(300, withTiming(0, { duration: 300, easing: Easing.out(Easing.back(1.3)) }));
  }, []);


  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const starStyle = useAnimatedStyle(() => ({
    transform: [{ scale: starScale.value }],
  }));
  const rewardsStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: rewardsY.value }],
    opacity: rewardsOpacity.value,
  }));

  return (
    <Modal
      visible={!!event && !suppressWhileOpen}
      transparent
      animationType="fade"
      onRequestClose={dismiss}
      onShow={triggerAnimations}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.scrim}>
          <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />

          {event && (
            <Animated.View style={[styles.card, cardStyle]}>
              <LinearGradient colors={['#FFF9E6', '#FFF3CC']} style={styles.cardGradient}>
                <Animated.View style={[styles.starsRow, starStyle]}>
                  <Text style={[styles.starText, styles.starSmall]}>★</Text>
                  <Text style={[styles.starText, styles.starLarge]}>★</Text>
                  <Text style={[styles.starText, styles.starSmall]}>★</Text>
                </Animated.View>

                <View style={styles.levelCircle}>
                  <LinearGradient colors={['#74D44F', '#3FA535']} style={styles.levelCircleGradient}>
                    <Text style={styles.levelNumber}>{event.newLevel}</Text>
                  </LinearGradient>
                </View>

                <Text style={styles.title}>Новий рівень!</Text>
                <Text style={styles.subtitle}>Рівень {event.newLevel}</Text>

                <Animated.View style={[styles.rewardsContainer, rewardsStyle]}>
                  <View style={styles.rewardRow}>
                    <View style={styles.coinIcon} />
                    <Text style={styles.rewardText}>+{formatNumber(event.coinReward)}</Text>
                  </View>
                  <View style={styles.rewardRow}>
                    <View style={styles.gemIcon} />
                    <Text style={styles.rewardTextGem}>+{event.gemReward}</Text>
                  </View>
                </Animated.View>

                <Pressable
                  onPress={dismiss}
                  style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                >
                  <LinearGradient colors={['#74D44F', '#5BA63C']} style={styles.buttonGradient}>
                    <Text style={styles.buttonText}>Отримати</Text>
                  </LinearGradient>
                  <View style={styles.buttonShadow} />
                </Pressable>
              </LinearGradient>
            </Animated.View>
          )}
        </View>
      </GestureHandlerRootView>
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
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  starText: {
    color: '#F2B330',
    textShadowColor: 'rgba(180,130,30,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  starSmall: { fontSize: 22 },
  starLarge: { fontSize: 34 },
  levelCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#fff',
    overflow: 'hidden',
    shadowColor: 'rgba(40,110,30,1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
    marginBottom: 12,
  },
  levelCircleGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelNumber: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 32,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  title: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 24,
    color: '#3D6B1E',
    marginBottom: 2,
  },
  subtitle: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    color: '#7C9A5E',
    marginBottom: 18,
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
    shadowColor: 'rgba(100,90,40,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  coinIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F2B330',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  rewardText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 16,
    color: '#C28A22',
  },
  gemIcon: {
    width: 16,
    height: 16,
    backgroundColor: '#3FB8D6',
    borderRadius: 3,
    transform: [{ rotate: '45deg' }],
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  rewardTextGem: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 16,
    color: '#2592AB',
  },
  button: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
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
});

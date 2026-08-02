import React, { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay, withSpring, Easing,
} from 'react-native-reanimated';
import { useGameStore } from '../stores/gameStore';
import { formatNum } from '../utils/format';

const { width: SCREEN_W } = Dimensions.get('window');

const TOKEN_COLORS: Record<string, string> = {
  green: '#3FA535', blue: '#3376E5', yellow: '#E5A72E', purple: '#9A6FD0', red: '#E05A4A',
};

const TOKEN_ICONS: Record<string, ReturnType<typeof require>> = {
  green:  require('../../assets/img/tokens/tokenGreen.png'),
  blue:   require('../../assets/img/tokens/tokenBlue.png'),
  yellow: require('../../assets/img/tokens/tokenYellow.png'),
  purple: require('../../assets/img/tokens/tokenViolet.png'),
  red:    require('../../assets/img/tokens/tokenRed.png'),
};

const MATERIAL_ICONS: Record<string, ReturnType<typeof require>> = {
  briks: require('../../assets/img/tools/briks.png'),
  glass: require('../../assets/img/tools/glass.png'),
  nails: require('../../assets/img/tools/nails.png'),
  screw: require('../../assets/img/tools/screw.png'),
};

const COIN_ICON    = require('../../assets/img/coin.png');
const DIAMOND_ICON = require('../../assets/img/diamond.png');

export default function TaskRewardModal() {
  const reward       = useGameStore((s) => s.pendingTaskReward);
  const clearReward  = useGameStore((s) => s.clearTaskReward);
  const activeSheetCount = useGameStore((s) => s.activeSheetCount);

  const scale          = useSharedValue(0.6);
  const rewardsOpacity = useSharedValue(0);
  const rewardsY       = useSharedValue(16);

  const cardStyle    = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const rewardsStyle = useAnimatedStyle(() => ({
    opacity: rewardsOpacity.value,
    transform: [{ translateY: rewardsY.value }],
  }));

  const runIn = useCallback(() => {
    scale.value = 0.6;
    rewardsOpacity.value = 0;
    rewardsY.value = 16;
    scale.value = withSpring(1, { damping: 14, stiffness: 180 });
    rewardsOpacity.value = withDelay(220, withTiming(1, { duration: 260 }));
    rewardsY.value = withDelay(220, withTiming(0, { duration: 280, easing: Easing.out(Easing.back(1.2)) }));
  }, [scale, rewardsOpacity, rewardsY]);

  if (!reward || activeSheetCount > 0) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={clearReward} onShow={runIn}>
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={clearReward} />

        <Animated.View style={[styles.card, cardStyle]}>
          <LinearGradient colors={['#F0FBE8', '#E2F5D0']} style={styles.cardInner}>
            <View style={styles.starsRow}>
              <Text style={[styles.star, styles.starSm]}>★</Text>
              <Text style={[styles.star, styles.starLg]}>★</Text>
              <Text style={[styles.star, styles.starSm]}>★</Text>
            </View>

            <Text style={styles.title}>Task Complete!</Text>
            <Text style={styles.subtitle} numberOfLines={1}>{reward.taskTitle}</Text>

            <Animated.View style={[styles.chipsWrap, rewardsStyle]}>
              <View style={styles.chip}>
                <Image source={COIN_ICON} style={styles.chipIcon} contentFit="contain" />
                <Text style={styles.chipCoins}>+{formatNum(reward.coins)}</Text>
              </View>
              <View style={styles.chip}>
                <Image source={DIAMOND_ICON} style={styles.chipIcon} contentFit="contain" />
                <Text style={styles.chipGems}>+{reward.gems}</Text>
              </View>
              <View style={styles.chip}>
                <Image source={TOKEN_ICONS[reward.tokenColor]} style={styles.chipIcon} contentFit="contain" />
                <Text style={[styles.chipToken, { color: TOKEN_COLORS[reward.tokenColor] }]}>
                  +{reward.tokenCount}
                </Text>
              </View>
              {reward.matCount != null && reward.materialType && (
                <View style={styles.chip}>
                  <Image source={MATERIAL_ICONS[reward.materialType]} style={styles.chipIcon} contentFit="contain" />
                  <Text style={styles.chipMat}>+{reward.matCount}</Text>
                </View>
              )}
            </Animated.View>

            <Pressable
              onPress={clearReward}
              style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
            >
              <LinearGradient colors={['#74D44F', '#5BA63C']} style={styles.btnGradient}>
                <Text style={styles.btnText}>Awesome!</Text>
              </LinearGradient>
              <View style={styles.btnShadow} />
            </Pressable>
          </LinearGradient>
        </Animated.View>
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
    width: SCREEN_W * 0.80,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: 'rgba(60,120,20,1)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 28,
    elevation: 12,
  },
  cardInner: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 24,
    gap: 8,
  },
  starsRow: { flexDirection: 'row', gap: 4, marginBottom: 2 },
  star: { color: '#F5C842' },
  starSm: { fontSize: 18 },
  starLg: { fontSize: 26 },
  title: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 24,
    color: '#2E6B12',
  },
  subtitle: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 14,
    color: '#5A7A4A',
    textAlign: 'center',
    marginBottom: 4,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    shadowColor: 'rgba(60,80,20,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  chipIcon: { width: 18, height: 18 },
  chipCoins: { fontFamily: 'Fredoka_700Bold', fontSize: 16, color: '#C28A22' },
  chipGems:  { fontFamily: 'Fredoka_700Bold', fontSize: 16, color: '#2592AB' },
  chipToken: { fontFamily: 'Fredoka_700Bold', fontSize: 16 },
  chipMat:   { fontFamily: 'Fredoka_700Bold', fontSize: 16, color: '#7A6050' },
  btn: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 4,
  },
  btnGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    zIndex: 1,
  },
  btnText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 18,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  btnShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(20,60,0,0.3)',
  },
});

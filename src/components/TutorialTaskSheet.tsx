import React, { useCallback, useEffect } from 'react';
import {
  Modal, View, Text, Pressable, StyleSheet, useColorScheme,
  Dimensions, Image,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTutorialTaskStore, useGameStore } from '../stores/gameStore';
import { TUTORIAL_TASKS, FINAL_REWARD } from '../../shared/config/tutorialTasksConfig';
import { CoinIcon, GemIcon } from './CurrencyIcons';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;
const DISMISS_THRESHOLD = 80;
const SLIDE_IN  = { duration: 380, easing: Easing.bezier(0.4, 0, 0.2, 1) };
const SLIDE_OUT = { duration: 280, easing: Easing.bezier(0.4, 0, 1, 1) };

const TASK_ICONS: Record<string, ReturnType<typeof require>> = {
  collect_revenue:      require('../../assets/img/quicActions/collect.png'),
  lift_visitors:        require('../../assets/img/achivment/achivLiftCategory.png'),
  hire_workers:         require('../../assets/img/menu/myWorkers.png'),
  build_floor:          require('../../assets/img/daily/dailybuild_floor.png'),
  complete_daily_tasks: require('../../assets/img/profile/dayliQuests.png'),
  upgrade_elevator:     require('../../assets/img/speedUp.png'),
  upgrade_lobby:        require('../../assets/img/reception.png'),
  upgrade_floor:        require('../../assets/img/starFull.png'),
  invite_friend:        require('../../assets/img/addfriend.png'),
  upgrade_business:     require('../../assets/img/menu/myBusiness.png'),
};

export default function TutorialTaskSheet({ visible, onClose }: Props) {
  const isDark = useColorScheme() === 'dark';
  const bg = isDark ? '#1C2028' : '#FFFFFF';
  const textPrimary = isDark ? '#E8EDE4' : '#1A202C';
  const textSecondary = isDark ? '#8A9BAE' : '#6A7585';
  const divider = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const trackBg = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';

  const { currentTask, delta, currentIndex, isComplete, allDone, claimedFinal } = useTutorialTaskStore();
  const claimTutorialTask = useGameStore((s) => s.claimTutorialTask);
  const claimTutorialFinal = useGameStore((s) => s.claimTutorialFinal);

  // Reanimated shared value — same pattern as LobbyPanel
  const slideY = useSharedValue(SCREEN_HEIGHT);

  useEffect(() => {
    if (visible) {
      slideY.value = withTiming(0, SLIDE_IN);
    }
  }, [visible]);

  const handleAnimatedClose = useCallback(() => {
    slideY.value = withTiming(SCREEN_HEIGHT, SLIDE_OUT, () => {
      runOnJS(onClose)();
    });
  }, [onClose]);

  // Pan gesture — RNGH Gesture API, same as LobbyPanel
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) slideY.value = e.translationY;
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_THRESHOLD || e.velocityY > 500) {
        slideY.value = withTiming(SCREEN_HEIGHT, SLIDE_OUT, () => {
          runOnJS(onClose)();
        });
      } else {
        slideY.value = withSpring(0, { damping: 20, stiffness: 200 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideY.value }],
  }));

  const handleClaim = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (allDone && !claimedFinal) {
      claimTutorialFinal();
      handleAnimatedClose();
    } else if (currentTask && isComplete) {
      claimTutorialTask(currentIndex);
    }
  };

  const progressRatio = currentTask ? Math.min(1, delta / currentTask.threshold) : 1;
  const totalTasks = TUTORIAL_TASKS.length;
  const displayIndex = Math.min(currentIndex, totalTasks);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleAnimatedClose}>
      {visible && (
        <GestureHandlerRootView style={styles.overlay}>
          {/* Transparent backdrop — tap to close */}
          <Pressable style={StyleSheet.absoluteFill} onPress={handleAnimatedClose} />

          <Animated.View style={[styles.sheet, sheetStyle, { backgroundColor: bg }]}>
            {/* Header area — GestureDetector covers handle + section row + close btn */}
            <GestureDetector gesture={panGesture}>
              <View style={styles.sheetHeader}>
                {/* Drag handle pill */}
                <View style={styles.handleRow}>
                  <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }]} />
                </View>
                {/* NEWCOMER'S PATH label + counter + close */}
                <View style={styles.sectionRow}>
                  <Text style={styles.sectionLabel}>NEWCOMER'S PATH</Text>
                  <Text style={[styles.counterText, { color: textSecondary }]}>{displayIndex}/{totalTasks}</Text>
                  <Pressable onPress={handleAnimatedClose} style={styles.closeBtn} hitSlop={14}>
                    <Text style={[styles.closeBtnText, { color: textSecondary }]}>✕</Text>
                  </Pressable>
                </View>
              </View>
            </GestureDetector>

            {/* Content */}
            <View style={styles.content}>
              {allDone && !claimedFinal ? (
                <>
                  <View style={styles.taskHeader}>
                    <View style={styles.iconWrap}>
                      <Text style={{ fontSize: 28 }}>🎉</Text>
                    </View>
                    <View style={styles.taskHeaderText}>
                      <Text style={[styles.taskTitle, { color: textPrimary }]}>All tasks done!</Text>
                      <Text style={[styles.taskDesc, { color: textSecondary }]}>
                        You've mastered the basics of TinyTower.
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.divider, { backgroundColor: divider }]} />

                  <View style={styles.rewardRow}>
                    <Text style={[styles.rewardLabel, { color: textSecondary }]}>Final reward</Text>
                    <View style={styles.rewardIcons}>
                      <CoinIcon size={18} />
                      <Text style={[styles.rewardValue, { color: textPrimary }]}>{FINAL_REWARD.coins.toLocaleString()}</Text>
                      <GemIcon size={18} />
                      <Text style={[styles.rewardValue, { color: textPrimary }]}>{FINAL_REWARD.gems}</Text>
                    </View>
                  </View>

                  <View style={styles.claimSpacer} />
                  <Pressable onPress={handleClaim} style={[styles.claimBtn, styles.claimBtnActive]}>
                    <Text style={styles.claimBtnText}>Claim Final Reward</Text>
                  </Pressable>
                </>
              ) : claimedFinal ? (
                <View style={styles.taskHeader}>
                  <Text style={{ fontSize: 28, marginRight: 10 }}>✅</Text>
                  <Text style={[styles.taskTitle, { color: textPrimary }]}>All complete!</Text>
                </View>
              ) : currentTask ? (
                <>
                  <View style={styles.taskHeader}>
                    <View style={styles.iconWrap}>
                      <Image source={TASK_ICONS[currentTask.key]} style={styles.taskIcon} resizeMode="contain" />
                    </View>
                    <View style={styles.taskHeaderText}>
                      <Text style={[styles.taskTitle, { color: textPrimary }]} numberOfLines={1}>
                        {currentTask.title}
                      </Text>
                      <Text style={[styles.taskDesc, { color: textSecondary }]} numberOfLines={2}>
                        {currentTask.description}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.progressRow}>
                    <View style={[styles.progressTrack, { backgroundColor: trackBg }]}>
                      <View style={[styles.progressFill, { width: `${progressRatio * 100}%` }]} />
                    </View>
                    <Text style={[styles.progressLabel, { color: textSecondary }]}>{Math.min(delta, currentTask.threshold)}/{currentTask.threshold}</Text>
                  </View>

                  <View style={[styles.divider, { backgroundColor: divider }]} />

                  <View style={styles.rewardRow}>
                    <Text style={[styles.rewardLabel, { color: textSecondary }]}>Reward</Text>
                    <View style={styles.rewardIcons}>
                      {currentTask.reward.coins > 0 && (
                        <>
                          <CoinIcon size={18} />
                          <Text style={[styles.rewardValue, { color: textPrimary }]}>{currentTask.reward.coins}</Text>
                        </>
                      )}
                      {currentTask.reward.gems > 0 && (
                        <>
                          <GemIcon size={18} />
                          <Text style={[styles.rewardValue, { color: textPrimary }]}>{currentTask.reward.gems}</Text>
                        </>
                      )}
                    </View>
                  </View>

                  {isComplete ? (
                    <>
                      <View style={styles.claimSpacer} />
                      <Pressable onPress={handleClaim} style={[styles.claimBtn, styles.claimBtnActive]}>
                        <Text style={styles.claimBtnText}>Claim Reward</Text>
                      </Pressable>
                    </>
                  ) : (
                    <View style={styles.claimSpacer} />
                  )}
                </>
              ) : null}
            </View>
          </Animated.View>
        </GestureHandlerRootView>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 12,
  },
  sheetHeader: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
  },
  handleRow: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  sectionLabel: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 11,
    letterSpacing: 1.2,
    color: '#F2AC40',
    flex: 1,
  },
  counterText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
    marginRight: 10,
  },
  closeBtn: { padding: 4 },
  closeBtnText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 18,
    lineHeight: 22,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 8,
    gap: 16,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: 'rgba(242,172,64,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  taskIcon: {
    width: 30,
    height: 30,
  },
  taskHeaderText: {
    flex: 1,
    gap: 3,
  },
  taskTitle: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 18,
    lineHeight: 22,
  },
  taskDesc: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    lineHeight: 19,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: '#3FA535',
  },
  progressLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
    minWidth: 36,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    marginVertical: -4,
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rewardLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
  },
  rewardIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  rewardValue: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 16,
    marginRight: 4,
  },
  claimSpacer: {
    height: 16,
  },
  claimBtn: {
    paddingVertical: 14,
    borderRadius: 22,
    alignItems: 'center',
  },
  claimBtnActive: {
    backgroundColor: '#3FA535',
  },
  claimBtnText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 17,
    color: '#fff',
  },
});

import React, { useState } from 'react';
import {
  Modal, View, Text, Pressable, StyleSheet, useColorScheme,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTutorialTaskStore, useGameStore } from '../stores/gameStore';
import { TUTORIAL_TASKS, FINAL_REWARD } from '../../shared/config/tutorialTasksConfig';
import { CoinIcon, GemIcon } from './CurrencyIcons';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function TutorialTaskSheet({ visible, onClose }: Props) {
  const isDark = useColorScheme() === 'dark';
  const bg = isDark ? '#1C2028' : '#FFFFFF';
  const textPrimary = isDark ? '#E8EDE4' : '#1A202C';
  const textSecondary = isDark ? '#8A9BAE' : '#6A7585';

  const { currentTask, delta, currentIndex, isComplete, allDone, claimedFinal } = useTutorialTaskStore();
  const claimTutorialTask = useGameStore((s) => s.claimTutorialTask);
  const claimTutorialFinal = useGameStore((s) => s.claimTutorialFinal);
  const [loading, setLoading] = useState(false);

  const handleClaim = async () => {
    if (loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      if (allDone && !claimedFinal) {
        claimTutorialFinal();
        onClose();
      } else if (currentTask && isComplete) {
        claimTutorialTask(currentIndex);
      }
    } finally {
      setLoading(false);
    }
  };

  const progressRatio = currentTask
    ? Math.min(1, delta / currentTask.threshold)
    : 1;

  const totalTasks = TUTORIAL_TASKS.length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: bg }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: textPrimary }]}>Tutorial</Text>
          <Text style={[styles.headerProgress, { color: textSecondary }]}>
            {Math.min(currentIndex, totalTasks)}/{totalTasks}
          </Text>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
            <Text style={[styles.closeBtnText, { color: textSecondary }]}>✕</Text>
          </Pressable>
        </View>

        {allDone && !claimedFinal ? (
          /* Final reward card */
          <View style={styles.taskCard}>
            <Text style={[styles.taskTitle, { color: textPrimary }]}>🎉 All done!</Text>
            <Text style={[styles.taskDesc, { color: textSecondary }]}>
              You've mastered the basics of TinyTower. Claim your final reward!
            </Text>
            <View style={styles.rewardRow}>
              <CoinIcon size={20} />
              <Text style={[styles.rewardText, { color: textPrimary }]}>{FINAL_REWARD.coins.toLocaleString()}</Text>
              <GemIcon size={20} />
              <Text style={[styles.rewardText, { color: textPrimary }]}>{FINAL_REWARD.gems}</Text>
            </View>
            <Pressable
              onPress={handleClaim}
              style={[styles.claimBtn, styles.claimBtnActive]}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.claimBtnText}>Claim Final Reward</Text>}
            </Pressable>
          </View>
        ) : claimedFinal ? (
          <View style={styles.taskCard}>
            <Text style={[styles.taskTitle, { color: textPrimary }]}>All complete! ✅</Text>
          </View>
        ) : currentTask ? (
          /* Active task card */
          <View style={styles.taskCard}>
            <Text style={[styles.taskTitle, { color: textPrimary }]}>{currentTask.title}</Text>
            <Text style={[styles.taskDesc, { color: textSecondary }]}>{currentTask.description}</Text>

            {/* Progress bar */}
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressRatio * 100}%` }]} />
            </View>
            <Text style={[styles.progressLabel, { color: textSecondary }]}>
              {delta} / {currentTask.threshold}
            </Text>

            {/* Reward preview */}
            <View style={styles.rewardRow}>
              {currentTask.reward.coins > 0 && (
                <>
                  <CoinIcon size={18} />
                  <Text style={[styles.rewardText, { color: textPrimary }]}>{currentTask.reward.coins}</Text>
                </>
              )}
              {currentTask.reward.gems > 0 && (
                <>
                  <GemIcon size={18} />
                  <Text style={[styles.rewardText, { color: textPrimary }]}>{currentTask.reward.gems}</Text>
                </>
              )}
            </View>

            {/* Claim button */}
            <Pressable
              onPress={isComplete ? handleClaim : undefined}
              style={[styles.claimBtn, isComplete ? styles.claimBtnActive : styles.claimBtnInactive]}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.claimBtnText}>{isComplete ? 'Claim reward' : 'In progress…'}</Text>}
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 22,
    flex: 1,
  },
  headerProgress: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
    marginRight: 12,
  },
  closeBtn: { padding: 4 },
  closeBtnText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 18,
  },
  taskCard: {
    gap: 12,
  },
  taskTitle: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 19,
  },
  taskDesc: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
    lineHeight: 22,
  },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.08)',
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
    textAlign: 'right',
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rewardText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 16,
  },
  claimBtn: {
    marginTop: 4,
    paddingVertical: 14,
    borderRadius: 22,
    alignItems: 'center',
  },
  claimBtnActive: {
    backgroundColor: '#3FA535',
  },
  claimBtnInactive: {
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  claimBtnText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 17,
    color: '#fff',
  },
});

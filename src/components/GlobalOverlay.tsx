import React from 'react';
import { View, StyleSheet } from 'react-native';
import AchievementModal from './AchievementModal';
import LevelUpModal from './LevelUpModal';
import ReferralNotificationModal from './ReferralNotificationModal';
import DailyLoginRewardModal from './DailyLoginRewardModal';
import InsufficientResourcesModal from './InsufficientResourcesModal';
import TokenInsufficientModal from './TokenInsufficientModal';
import TaskRewardModal from './TaskRewardModal';
import DeliverAllModal from './DeliverAllModal';
import { useGameStore } from '../stores/gameStore';

export default function GlobalOverlay() {
  const pendingDeliverAll      = useGameStore((s) => s.pendingDeliverAll);
  const clearPendingDeliverAll = useGameStore((s) => s.clearPendingDeliverAll);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <AchievementModal />
      <LevelUpModal />
      <ReferralNotificationModal />
      <DailyLoginRewardModal />
      <InsufficientResourcesModal />
      <TokenInsufficientModal />
      <TaskRewardModal />
      <DeliverAllModal
        visible={pendingDeliverAll !== null}
        summary={pendingDeliverAll}
        onDismiss={clearPendingDeliverAll}
      />
    </View>
  );
}

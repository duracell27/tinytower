import React from 'react';
import { View, StyleSheet } from 'react-native';
import AchievementModal from './AchievementModal';
import LevelUpModal from './LevelUpModal';
import ReferralNotificationModal from './ReferralNotificationModal';
import DailyLoginRewardModal from './DailyLoginRewardModal';
import InsufficientResourcesModal from './InsufficientResourcesModal';
import TokenInsufficientModal from './TokenInsufficientModal';
import TaskRewardModal from './TaskRewardModal';
import HotelFullNoticeModal from './HotelFullNoticeModal';
import PurchaseSuccessModal from './PurchaseSuccessModal';

export default function GlobalOverlay() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <AchievementModal />
      <LevelUpModal />
      <ReferralNotificationModal />
      <DailyLoginRewardModal />
      <InsufficientResourcesModal />
      <TokenInsufficientModal />
      <TaskRewardModal />
      <HotelFullNoticeModal />
      <PurchaseSuccessModal />
    </View>
  );
}

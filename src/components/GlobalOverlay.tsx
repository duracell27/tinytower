import React from 'react';
import { View, StyleSheet } from 'react-native';
import AchievementModal from './AchievementModal';
import LevelUpModal from './LevelUpModal';
import ReferralNotificationModal from './ReferralNotificationModal';
import DailyLoginRewardModal from './DailyLoginRewardModal';
import InsufficientResourcesModal from './InsufficientResourcesModal';
import TokenInsufficientModal from './TokenInsufficientModal';
import TaskRewardModal from './TaskRewardModal';
import PurchaseSuccessModal from './PurchaseSuccessModal';
import PurchaseLoadingOverlay from './PurchaseLoadingOverlay';
import FloorUpgradeModal from './FloorUpgradeModal';
import ProductionDetailModal from './ProductionDetailModal';
import WarehouseFullModal from './WarehouseFullModal';
import CityAlertModal from './CityAlertModal';
import { useGameStore } from '../stores/gameStore';

export default function GlobalOverlay() {
  const purchasingActive = useGameStore((s) => s.purchasingActive);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <AchievementModal />
      <LevelUpModal />
      <ReferralNotificationModal />
      <DailyLoginRewardModal />
      <InsufficientResourcesModal />
      <TokenInsufficientModal />
      <TaskRewardModal />
      <PurchaseSuccessModal />
      <PurchaseLoadingOverlay visible={purchasingActive} />
      <FloorUpgradeModal />
      <ProductionDetailModal />
      <WarehouseFullModal />
      <CityAlertModal />
    </View>
  );
}

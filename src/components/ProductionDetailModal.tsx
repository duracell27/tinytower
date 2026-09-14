import React, { useEffect } from 'react';
import {
  View, Text, Modal, Pressable, StyleSheet, ScrollView, Dimensions,
} from 'react-native';
import LocaleText from './LocaleText';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, Easing, runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { useAppTheme } from '../hooks/useAppTheme';
import { useGameStore } from '../stores/gameStore';
import { gameConfig } from '../../shared/config/gameConfig';
import { VEHICLE_CONFIG } from '../../shared/config/vehicleConfig';
import { FLOOR_STAR_MULTIPLIERS } from '../../shared/config/floorUpgradeConfig';
import {
  getWorkerMood,
  getRevenueMultiplier,
  getWorkerForSlot,
  getFloorDiscount,
  getFloorSpecialistBonus,
} from '../../shared/engine/workerUtils';
import WorkerAvatar from './WorkerAvatar';
import { CoinIcon } from './CurrencyIcons';
import { PRODUCT_IMAGES } from '../utils/productImages';
const MARKETING_ICON    = require('../../assets/img/MarketingIcon.png');
const WORKER_ICON       = require('../../assets/img/worker.png');
const SPECIALIST_ICON   = require('../../assets/img/specialistWorker.png');
import { FLOOR_TYPE_SCHEMES } from './FloorCard';
import { shadeColor } from '../utils/color';
import { formatNum } from '../utils/format';
import { getProductionStatus } from '../../shared/engine/productionStatus';
import { computeVehicleBonuses } from '../../shared/engine/vehicleUtils';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.85;
const SHEET_TIMING = { duration: 320, easing: Easing.bezier(0.4, 0, 0.2, 1) };
const SWIPE_CLOSE_THRESHOLD = 80;
const VELOCITY_CLOSE_THRESHOLD = 500;

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return i18n.t('hotel:productionCard.time.seconds', { count: totalSec });
  const min = Math.floor(totalSec / 60);
  if (min < 60) return i18n.t('hotel:productionCard.time.minutes', { count: min });
  const hours = Math.floor(min / 60);
  if (hours < 24) return i18n.t('hotel:productionCard.time.hours', { count: hours });
  return i18n.t('hotel:productionCard.time.days', { count: Math.floor(hours / 24) });
}

export default function ProductionDetailModal() {
  const { t } = useTranslation('hotel');
  const { t: tContent } = useTranslation('gameContent');

  const theme = useAppTheme();
  const { isDark } = theme;

  const modal = useGameStore((s) => s.productionDetailModal);
  const close = useGameStore((s) => s.closeProductionDetailModal);
  const workers = useGameStore((s) => s.workers);
  const floors = useGameStore((s) => s.floors);
  const floorStars = useGameStore((s) => s.floorStars);
  const businessUpgrades = useGameStore((s) => s.businessUpgrades);
  const vehicles = useGameStore((s) => s.vehicles);
  const coinBonusPercent   = useGameStore((s) => s.coinBonusPercent);
  const coinBoostPercent   = useGameStore((s) => s.coinBoostPercent);
  const coinBoostExpiresAt = useGameStore((s) => s.coinBoostExpiresAt);
  const balance = useGameStore((s) => s.balance);
  const activeCoinBoost = Date.now() < coinBoostExpiresAt ? coinBoostPercent : 0;
  const openedFloorTypes = useGameStore((s) => s.openedFloorTypes);

  // Animation hooks — must come before early returns
  const translateY = useSharedValue(SHEET_HEIGHT);
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
    if (modal) {
      translateY.value = SHEET_HEIGHT;
      translateY.value = withTiming(0, SHEET_TIMING);
    }
  }, [modal]);

  const panGesture = Gesture.Pan()
    .activeOffsetY(5)
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (e.translationY > SWIPE_CLOSE_THRESHOLD || e.velocityY > VELOCITY_CLOSE_THRESHOLD) {
        runOnJS(close)();
      } else {
        translateY.value = withTiming(0, SHEET_TIMING);
      }
    });

  if (!modal) return null;

  const { floorId, slotIdx } = modal;

  const floor = floors.find((f) => f.id === floorId);
  if (!floor) return null;

  const production = floor.productions[slotIdx];
  if (!production) return null;

  const worker = getWorkerForSlot(workers, floorId, slotIdx);
  if (!worker) return null;

  const floorConfig = gameConfig.floors.find((f) => f.id === floorId);
  const availableTypes = floorConfig?.availableTypes
    ?? floor.productions.map((p) => p.typeId).filter((id): id is string => id !== null);

  const typeId = production.typeId ?? availableTypes[slotIdx] ?? null;

  // Resolve floorType: static config → openedFloorTypes → derive from typeId dreamJobs
  let floorType: string | null = floorConfig?.floorType ?? openedFloorTypes?.[String(floorId)] ?? null;
  if (!floorType && typeId) {
    for (const [type, typeData] of Object.entries(gameConfig.floorTypes)) {
      if (typeData.businesses.some((b) => b.dreamJobs.includes(typeId))) {
        floorType = type;
        break;
      }
    }
  }
  const typeConfig = typeId ? gameConfig.productionTypes[typeId] : null;

  const stars = floorStars?.[String(floorId)] ?? 0;
  const starMult = FLOOR_STAR_MULTIPLIERS[stars] ?? FLOOR_STAR_MULTIPLIERS[0];

  const mood = floorType && typeId ? getWorkerMood(worker, floorType, typeId) : 'bad';
  const multiplier = floorType && typeId ? getRevenueMultiplier(worker, floorType, typeId) : 1;

  const discount = getFloorDiscount(workers, floorId);
  const specialistBonus = getFloorSpecialistBonus(workers, floorId);
  const specialistBonusPercent = Math.round(specialistBonus * 100);
  const categoryBonus = floorType
    ? (businessUpgrades?.[floorType as keyof typeof businessUpgrades] ?? 0) * 5
    : 0;

  const vb = computeVehicleBonuses(vehicles);
  const forkliftSalesSpeed    = vb.salesSpeedPercent;
  const deliveryTruckSpeed    = vb.deliverySpeedPercent;
  const armoredBaseCoin       = vb.baseCoinBoostPercent;
  const armoredBaseXp         = vb.baseXpBoostPercent;
  const hasVehicleBonus       = forkliftSalesSpeed > 0 || deliveryTruckSpeed > 0 || armoredBaseCoin > 0 || armoredBaseXp > 0;

  const baseRevenue = typeConfig?.batchValue ?? 0;
  const starValueMult = starMult.value;
  const effectiveRevenue = typeConfig
    ? Math.floor(
        typeConfig.batchValue *
          (1 + vb.baseCoinBoostPercent / 100) *
          starValueMult *
          (1 + (coinBonusPercent + activeCoinBoost + specialistBonusPercent + categoryBonus) / 100) *
          multiplier,
      )
    : 0;

  const deliveryDuration = typeConfig
    ? Math.max(1_000, typeConfig.deliveryDuration * (1 - vb.deliverySpeedPercent / 100))
    : 0;
  const effectiveSellDuration = typeConfig
    ? Math.max(1_000, typeConfig.sellDuration * starMult.time * (1 - vb.salesSpeedPercent / 100))
    : 0;
  const revenuePerMin =
    effectiveSellDuration > 0
      ? Math.round((effectiveRevenue / effectiveSellDuration) * 60_000)
      : 0;

  const status = getProductionStatus(production, typeConfig, Date.now(), balance, effectiveSellDuration || undefined, deliveryDuration || undefined);
  const effectiveStage = status.effectiveStage;

  const effectiveCost = typeConfig
    ? Math.floor(typeConfig.buyCost * starMult.cost * (1 - discount))
    : 0;
  const discountPercent = Math.round(discount * 100);

  const productTitle = tContent(`productionTypes.${typeId}.displayName`, {
    defaultValue: typeId ?? '',
  });
  const productImage = typeId
    ? (PRODUCT_IMAGES[typeId] ?? PRODUCT_IMAGES[availableTypes[0]])
    : null;

  const scheme = (floorType ? FLOOR_TYPE_SCHEMES[floorType] : undefined) ?? FLOOR_TYPE_SCHEMES.green;
  const accentColor = scheme.color;
  const headerBg = shadeColor(accentColor, -10);

  const moodColor =
    mood === 'good' ? '#72C24F' : mood === 'mid' ? '#F2AC40' : '#9098A6';
  const moodLabel =
    mood === 'good'
      ? t('productionDetail.mood.good')
      : mood === 'mid'
      ? t('productionDetail.mood.mid')
      : t('productionDetail.mood.bad');

  const multiplierText =
    multiplier === 2.0 ? '×2.0' : multiplier === 1.3 ? '×1.3' : '×1.0';

  const statusLabels: Record<string, string> = {
    IDLE: t('productionDetail.status.IDLE'),
    DELIVERING: t('productionDetail.status.DELIVERING'),
    READY_TO_LIST: t('productionDetail.status.READY_TO_LIST'),
    SELLING: t('productionDetail.status.SELLING'),
    READY_TO_COLLECT: t('productionDetail.status.READY_TO_COLLECT'),
    EMPTY: t('productionDetail.status.EMPTY'),
  };

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={close}
      statusBarTranslucent
    >
      <Pressable style={styles.scrim} onPress={close} />

      <Animated.View style={[styles.sheet, sheetStyle, { backgroundColor: theme.surface }]}>
        {/* Colored top: handle + header */}
        <View style={[styles.topSection, { backgroundColor: headerBg }]}>
          <GestureDetector gesture={panGesture}>
            <View style={styles.handleRow}>
              <View style={styles.handle} />
            </View>
          </GestureDetector>

        {/* Header */}
        <View style={styles.header}>
          {productImage && (
            <Image source={productImage} style={styles.productImage} contentFit="contain" />
          )}
          <View style={styles.headerText}>
            <LocaleText style={styles.productName} numberOfLines={1}>
              {productTitle}
            </LocaleText>
            <LocaleText style={styles.statusLabel}>
              {statusLabels[effectiveStage] ?? effectiveStage}
            </LocaleText>
          </View>
          <Pressable
            onPress={close}
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
            hitSlop={8}
          >
            <LocaleText style={styles.closeBtnText}>✕</LocaleText>
          </Pressable>
        </View>
        </View>{/* /topSection */}

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Worker row */}
          <View style={styles.section}>
            <View style={styles.workerRow}>
              <View style={[styles.avatarWrap, isDark && { backgroundColor: theme.surface, borderColor: theme.divider }, worker.isSpecialist && { borderColor: '#F5C842' }]}>
                <WorkerAvatar worker={worker} size={40} />
              </View>
              <View style={styles.workerInfo}>
                <LocaleText style={[styles.workerName, { color: theme.text }]} numberOfLines={1}>
                  {worker.name}
                </LocaleText>
                <LocaleText style={[styles.workerLevel, isDark && { color: '#6A7284' }]}>Lv{worker.level}</LocaleText>
                {worker.isSpecialist && (
                  <View style={styles.specialistBadge}>
                    <LocaleText style={styles.specialistBadgeText}>★</LocaleText>
                  </View>
                )}
              </View>
              <View style={[styles.moodChip, { backgroundColor: moodColor }]}>
                <LocaleText style={styles.moodChipText}>
                  {moodLabel} {multiplierText}
                </LocaleText>
              </View>
            </View>
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: theme.divider }]} />

          {/* Revenue breakdown */}
          <View style={styles.section}>
            <LocaleText style={[styles.sectionTitle, isDark && { color: '#6A7284' }]}>{t('productionDetail.revenue.section')}</LocaleText>

            <BreakdownRow
              isDark={isDark}
              label={
                <View style={styles.rowLabelWithIcon}>
                  {productImage && <Image source={productImage} style={styles.rowLabelIcon} contentFit="contain" />}
                  <LocaleText style={[styles.rowLabel, isDark && { color: '#8E95A3' }]}>{t('productionDetail.revenue.base')}</LocaleText>
                </View>
              }
              value={<><LocaleText style={[styles.rowValue, { color: theme.text }]}>{formatNum(baseRevenue)}</LocaleText><CoinIcon size={13} /></>}
            />

            {stars > 0 && (
              <BreakdownRow
                isDark={isDark}
                label={t('productionDetail.revenue.stars')}
                value={<LocaleText style={[styles.rowValue, { color: theme.text }]}>×{starValueMult.toFixed(1)}</LocaleText>}
              />
            )}

            <BreakdownRow
              isDark={isDark}
              label={
                <View style={styles.rowLabelWithIcon}>
                  <Image source={WORKER_ICON} style={styles.rowLabelIcon} contentFit="contain" />
                  <LocaleText style={[styles.rowLabel, isDark && { color: '#8E95A3' }]}>{t('productionDetail.revenue.worker')}</LocaleText>
                </View>
              }
              value={<LocaleText style={[styles.rowValue, { color: moodColor }]}>{multiplierText}</LocaleText>}
            />

            {specialistBonusPercent > 0 && (
              <BreakdownRow
                isDark={isDark}
                label={
                  <View style={styles.rowLabelWithIcon}>
                    <Image source={SPECIALIST_ICON} style={styles.rowLabelIcon} contentFit="contain" />
                    <LocaleText style={[styles.rowLabel, isDark && { color: '#8E95A3' }]}>{t('productionDetail.revenue.specialist')}</LocaleText>
                  </View>
                }
                value={<LocaleText style={[styles.rowValue, { color: theme.text }]}>+{specialistBonusPercent}%</LocaleText>}
              />
            )}

            {categoryBonus > 0 && (
              <BreakdownRow
                isDark={isDark}
                label={t('productionDetail.revenue.category')}
                value={<LocaleText style={[styles.rowValue, { color: theme.text }]}>+{categoryBonus}%</LocaleText>}
              />
            )}

            {coinBonusPercent > 0 && (
              <BreakdownRow
                isDark={isDark}
                label={t('productionDetail.revenue.global')}
                value={<LocaleText style={[styles.rowValue, { color: theme.text }]}>+{coinBonusPercent}%</LocaleText>}
              />
            )}

            {activeCoinBoost > 0 && (
              <BreakdownRow
                isDark={isDark}
                label={
                  <View style={styles.rowLabelWithIcon}>
                    <Image source={MARKETING_ICON} style={styles.rowLabelIcon} contentFit="contain" />
                    <LocaleText style={[styles.rowLabel, isDark && { color: '#8E95A3' }]}>{t('productionDetail.revenue.marketingBoost')}</LocaleText>
                  </View>
                }
                value={<LocaleText style={[styles.rowValue, { color: '#F5A623' }]}>+{activeCoinBoost}%</LocaleText>}
              />
            )}

            {hasVehicleBonus && (
              <View style={[styles.bonusSection, { borderTopColor: theme.divider }]}>
                <LocaleText style={[styles.bonusSectionTitle, { color: theme.textMuted }]}>{t('productionDetail.revenue.vehicleBonuses')}</LocaleText>
                {forkliftSalesSpeed > 0 && (
                  <BreakdownRow
                    isDark={isDark}
                    label={t('productionDetail.revenue.forklift')}
                    value={<LocaleText style={[styles.rowValue, { color: VEHICLE_CONFIG.forklift.accentColor }]}>−{forkliftSalesSpeed}% sell time</LocaleText>}
                  />
                )}
                {deliveryTruckSpeed > 0 && (
                  <BreakdownRow
                    isDark={isDark}
                    label={t('productionDetail.revenue.deliveryTruck')}
                    value={<LocaleText style={[styles.rowValue, { color: VEHICLE_CONFIG.delivery_truck.accentColor }]}>−{deliveryTruckSpeed}% delivery time</LocaleText>}
                  />
                )}
                {armoredBaseCoin > 0 && (
                  <BreakdownRow
                    isDark={isDark}
                    label={t('productionDetail.revenue.armoredTruck')}
                    value={<LocaleText style={[styles.rowValue, { color: VEHICLE_CONFIG.armored_truck.accentColor }]}>+{armoredBaseCoin}% base revenue</LocaleText>}
                  />
                )}
                {armoredBaseXp > 0 && (
                  <BreakdownRow
                    isDark={isDark}
                    label={t('productionDetail.revenue.armoredTruckXp')}
                    value={<LocaleText style={[styles.rowValue, { color: VEHICLE_CONFIG.armored_truck.accentColor }]}>+{armoredBaseXp}% base XP</LocaleText>}
                  />
                )}
              </View>
            )}

            <View style={[styles.rowDivider, { backgroundColor: theme.divider }]} />

            <View style={styles.totalRow}>
              <LocaleText style={[styles.totalLabel, { color: theme.text }]}>{t('productionDetail.revenue.total')}</LocaleText>
              <View style={styles.totalValueRow}>
                <LocaleText style={[styles.totalValue, { color: theme.text }]}>{formatNum(effectiveRevenue)}</LocaleText>
                <CoinIcon size={14} />
                {revenuePerMin > 0 && (
                  <LocaleText style={styles.perMin}>
                    {' '}({formatNum(revenuePerMin)}{t('productionDetail.revenue.perMin')})
                  </LocaleText>
                )}
              </View>
            </View>
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: theme.divider }]} />

          {/* Timings + cost */}
          <View style={styles.section}>
            {deliveryDuration > 0 && (
              <BreakdownRow
                isDark={isDark}
                label={t('productionDetail.timing.delivery')}
                value={<LocaleText style={[styles.rowValue, { color: theme.text }]}>{formatDuration(deliveryDuration)}</LocaleText>}
              />
            )}
            {effectiveSellDuration > 0 && (
              <BreakdownRow
                isDark={isDark}
                label={t('productionDetail.timing.sell')}
                value={<LocaleText style={[styles.rowValue, { color: theme.text }]}>{formatDuration(effectiveSellDuration)}</LocaleText>}
              />
            )}
            {effectiveCost > 0 && (
              <BreakdownRow
                isDark={isDark}
                label={t('productionDetail.cost.buy')}
                value={
                  <View style={styles.costValueRow}>
                    <LocaleText style={[styles.rowValue, { color: theme.text }]}>{formatNum(effectiveCost)}</LocaleText>
                    <CoinIcon size={13} />
                    {discountPercent > 0 && (
                      <LocaleText style={styles.discountLabel}>
                        {t('productionDetail.cost.discount', { percent: discountPercent })}
                      </LocaleText>
                    )}
                  </View>
                }
              />
            )}
          </View>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

function BreakdownRow({ label, value, isDark }: { label: React.ReactNode; value: React.ReactNode; isDark?: boolean }) {
  return (
    <View style={styles.breakdownRow}>
      {typeof label === 'string'
        ? <LocaleText style={[styles.rowLabel, isDark && { color: '#8E95A3' }]}>{label}</LocaleText>
        : label}
      <View style={styles.rowValueWrap}>{value}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: SHEET_HEIGHT,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 16,
    paddingBottom: 20,
  },
  topSection: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 14,
  },
  productImage: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  productName: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 17,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    textTransform: 'capitalize',
  },
  statusLabel: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 12,
    color: 'rgba(255,255,255,0.82)',
  },
  body: {
    flexShrink: 1,
  },
  bodyContent: {
    paddingBottom: 12,
  },
  section: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 8,
  },
  sectionTitle: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 11,
    color: '#9098A6',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  workerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E7EBF1',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    overflow: 'hidden',
  },
  workerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  workerName: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
    color: '#2A3344',
    textTransform: 'capitalize',
    flexShrink: 1,
  },
  workerLevel: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 12,
    color: '#9098A6',
  },
  specialistBadge: {
    backgroundColor: '#F5C842',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  specialistBadgeText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 10,
    color: '#fff',
  },
  moodChip: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  moodChipText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 12,
    color: '#fff',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginHorizontal: 18,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 13.5,
    color: '#6A7284',
  },
  rowLabelWithIcon: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rowLabelIcon:     { width: 16, height: 16 },
  rowValue: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13.5,
    color: '#2A3344',
  },
  rowValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  rowDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginVertical: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    color: '#2A3344',
  },
  totalValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  totalValue: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 15,
    color: '#2A3344',
  },
  perMin: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 11.5,
    color: '#9098A6',
  },
  costValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  discountLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 11.5,
    color: '#72C24F',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    color: '#fff',
  },
  bonusSection: {
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 6,
    gap: 6,
  },
  bonusSectionTitle: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
});

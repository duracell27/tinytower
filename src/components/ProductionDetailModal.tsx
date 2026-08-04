import React from 'react';
import {
  View, Text, Modal, Pressable, StyleSheet, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { useGameStore } from '../stores/gameStore';
import { gameConfig } from '../../shared/config/gameConfig';
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
import { FLOOR_TYPE_SCHEMES } from './FloorCard';
import { shadeColor } from '../utils/color';
import { formatNum } from '../utils/format';

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

  const modal = useGameStore((s) => s.productionDetailModal);
  const close = useGameStore((s) => s.closeProductionDetailModal);
  const workers = useGameStore((s) => s.workers);
  const floors = useGameStore((s) => s.floors);
  const floorStars = useGameStore((s) => s.floorStars);
  const businessUpgrades = useGameStore((s) => s.businessUpgrades);
  const coinBonusPercent = useGameStore((s) => s.coinBonusPercent);
  const openedFloorTypes = useGameStore((s) => s.openedFloorTypes);

  if (!modal) return null;

  const { floorId, slotIdx } = modal;

  const floor = floors.find((f) => f.id === floorId);
  if (!floor) return null;

  const production = floor.productions[slotIdx];
  if (!production) return null;

  const worker = getWorkerForSlot(workers, floorId, slotIdx);
  if (!worker) return null;

  const floorConfig = gameConfig.floors.find((f) => f.id === floorId);
  const floorType = floorConfig?.floorType ?? openedFloorTypes?.[String(floorId)] ?? null;
  const availableTypes = floorConfig?.availableTypes
    ?? floor.productions.map((p) => p.typeId).filter((id): id is string => id !== null);

  const typeId = production.typeId ?? availableTypes[slotIdx] ?? null;
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

  const baseRevenue = typeConfig?.batchValue ?? 0;
  const starValueMult = starMult.value;
  const effectiveRevenue = typeConfig
    ? Math.floor(
        typeConfig.batchValue *
          starValueMult *
          (1 + (coinBonusPercent + specialistBonusPercent + categoryBonus) / 100) *
          multiplier,
      )
    : 0;

  const deliveryDuration = typeConfig?.deliveryDuration ?? 0;
  const effectiveSellDuration = typeConfig ? typeConfig.sellDuration * starMult.time : 0;
  const totalCycleDuration = deliveryDuration + effectiveSellDuration;
  const revenuePerMin =
    totalCycleDuration > 0
      ? Math.round((effectiveRevenue / totalCycleDuration) * 60_000)
      : 0;

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
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={close}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={[styles.header, { backgroundColor: headerBg }]}>
            {productImage && (
              <Image source={productImage} style={styles.productImage} contentFit="contain" />
            )}
            <View style={styles.headerText}>
              <Text style={styles.productName} numberOfLines={1}>
                {productTitle}
              </Text>
              <Text style={styles.statusLabel}>
                {statusLabels[production.stage] ?? production.stage}
              </Text>
            </View>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Worker row */}
            <View style={styles.section}>
              <View style={styles.workerRow}>
                <View style={[styles.avatarWrap, worker.isSpecialist && { borderColor: '#F5C842' }]}>
                  <WorkerAvatar worker={worker} size={40} />
                </View>
                <View style={styles.workerInfo}>
                  <Text style={styles.workerName} numberOfLines={1}>
                    {worker.name}
                  </Text>
                  <Text style={styles.workerLevel}>Lv{worker.level}</Text>
                  {worker.isSpecialist && (
                    <View style={styles.specialistBadge}>
                      <Text style={styles.specialistBadgeText}>★</Text>
                    </View>
                  )}
                </View>
                <View style={[styles.moodChip, { backgroundColor: moodColor }]}>
                  <Text style={styles.moodChipText}>
                    {moodLabel} {multiplierText}
                  </Text>
                </View>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Revenue breakdown */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('productionDetail.revenue.section')}</Text>

              <BreakdownRow
                label={t('productionDetail.revenue.base')}
                value={<><Text style={styles.rowValue}>{formatNum(baseRevenue)}</Text><CoinIcon size={13} /></>}
              />

              {stars > 0 && (
                <BreakdownRow
                  label={t('productionDetail.revenue.stars')}
                  value={<Text style={styles.rowValue}>×{starValueMult.toFixed(1)}</Text>}
                />
              )}

              <BreakdownRow
                label={t('productionDetail.revenue.worker')}
                value={<Text style={[styles.rowValue, { color: moodColor }]}>{multiplierText}</Text>}
              />

              {specialistBonusPercent > 0 && (
                <BreakdownRow
                  label={t('productionDetail.revenue.specialist')}
                  value={<Text style={styles.rowValue}>+{specialistBonusPercent}%</Text>}
                />
              )}

              {categoryBonus > 0 && (
                <BreakdownRow
                  label={t('productionDetail.revenue.category')}
                  value={<Text style={styles.rowValue}>+{categoryBonus}%</Text>}
                />
              )}

              {coinBonusPercent > 0 && (
                <BreakdownRow
                  label={t('productionDetail.revenue.global')}
                  value={<Text style={styles.rowValue}>+{coinBonusPercent}%</Text>}
                />
              )}

              <View style={styles.rowDivider} />

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{t('productionDetail.revenue.total')}</Text>
                <View style={styles.totalValueRow}>
                  <Text style={styles.totalValue}>{formatNum(effectiveRevenue)}</Text>
                  <CoinIcon size={14} />
                  {revenuePerMin > 0 && (
                    <Text style={styles.perMin}>
                      {' '}({formatNum(revenuePerMin)}{t('productionDetail.revenue.perMin')})
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Timings + cost */}
            <View style={styles.section}>
              {deliveryDuration > 0 && (
                <BreakdownRow
                  label={t('productionDetail.timing.delivery')}
                  value={<Text style={styles.rowValue}>{formatDuration(deliveryDuration)}</Text>}
                />
              )}
              {effectiveSellDuration > 0 && (
                <BreakdownRow
                  label={t('productionDetail.timing.sell')}
                  value={<Text style={styles.rowValue}>{formatDuration(effectiveSellDuration)}</Text>}
                />
              )}
              {effectiveCost > 0 && (
                <BreakdownRow
                  label={t('productionDetail.cost.buy')}
                  value={
                    <View style={styles.costValueRow}>
                      <Text style={styles.rowValue}>{formatNum(effectiveCost)}</Text>
                      <CoinIcon size={13} />
                      {discountPercent > 0 && (
                        <Text style={styles.discountLabel}>
                          {t('productionDetail.cost.discount', { percent: discountPercent })}
                        </Text>
                      )}
                    </View>
                  }
                />
              )}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function BreakdownRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <View style={styles.breakdownRow}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowValueWrap}>{value}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.48)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '82%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
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
    paddingBottom: 32,
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
});

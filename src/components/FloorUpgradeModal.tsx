import React from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, useColorScheme,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../stores/gameStore';
import { FLOOR_UPGRADE_COSTS } from '../../shared/config/floorUpgradeConfig';
import { gameConfig } from '../../shared/config/gameConfig';
import { GemIcon } from './CurrencyIcons';

const TOKEN_LABEL: Record<string, string> = {
  green: '🟢', blue: '🔵', yellow: '🟡', purple: '🟣', red: '🔴',
};

export default function FloorUpgradeModal() {
  const { t } = useTranslation('hotel');
  const isDark = useColorScheme() === 'dark';
  const modal = useGameStore((s) => s.floorUpgradeModal);
  const close = useGameStore((s) => s.closeFloorUpgradeModal);
  const upgradeFloor = useGameStore((s) => s.upgradeFloor);
  const floorStars = useGameStore((s) => s.floorStars);
  const gems = useGameStore((s) => s.gems);
  const tokens = useGameStore((s) => s.tokens);

  if (!modal) return null;

  const { floorId } = modal;
  const stars = floorStars?.[String(floorId)] ?? 0;
  const isMax = stars >= 5;

  const floorConfig = gameConfig.floors.find((f) => f.id === floorId);
  const floorType = (floorConfig?.floorType ?? '') as keyof typeof tokens;
  const floorName = (() => {
    if (!floorType || !floorConfig?.availableTypes[0]) return `Floor ${floorId}`;
    return gameConfig.floorTypes[floorType as string]?.businesses
      .find((b) => b.dreamJobs.includes(floorConfig!.availableTypes[0]))?.name
      ?? `Floor ${floorId}`;
  })();

  const cost = isMax ? null : FLOOR_UPGRADE_COSTS[stars];
  const canAfford = cost
    ? gems >= cost.gems && (tokens[floorType] ?? 0) >= cost.tokens
    : false;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={[styles.card, isDark && styles.cardDark]}>
          <Text style={[styles.title, isDark && styles.textDark]}>
            {t('floorUpgrade.title')} — {floorName}
          </Text>

          {/* Stars row */}
          <View style={styles.starsRow}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Text key={i} style={[styles.star, { color: i < stars ? '#FFD23E' : isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.18)' }]}>
                {'★'}
              </Text>
            ))}
          </View>

          {isMax ? (
            <Text style={[styles.maxText, isDark && styles.textDark]}>
              {t('floorUpgrade.maxLevel')}
            </Text>
          ) : (
            <>
              <View style={styles.costRow}>
                <GemIcon size={16} />
                <Text style={[styles.costText, isDark && styles.textDark]}>
                  {cost!.gems} {t('floorUpgrade.gems')}
                </Text>
                <Text style={[styles.costText, isDark && styles.textDark]}>
                  {'  '}
                  {TOKEN_LABEL[floorType] ?? ''} {cost!.tokens} {t('floorUpgrade.tokens')}
                </Text>
              </View>
              <Text style={[styles.balanceHint, isDark && styles.textMuted]}>
                {gems} / {tokens[floorType] ?? 0}
              </Text>
              <TouchableOpacity
                style={[styles.upgradeBtn, !canAfford && styles.upgradeBtnDisabled]}
                disabled={!canAfford}
                onPress={() => { upgradeFloor(floorId); close(); }}
              >
                <Text style={styles.upgradeBtnText}>{t('floorUpgrade.upgradeBtn')}</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.closeBtn} onPress={close}>
            <Text style={[styles.closeBtnText, isDark && styles.textMuted]}>
              {t('floorUpgrade.close')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: 300,
    alignItems: 'center',
    gap: 12,
  },
  cardDark: {
    backgroundColor: '#1e1e1e',
  },
  title: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 18,
    color: '#222',
    textAlign: 'center',
  },
  textDark: {
    color: '#f0f0f0',
  },
  textMuted: {
    color: '#888',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  star: {
    fontSize: 28,
  },
  costRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  costText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
    color: '#333',
  },
  balanceHint: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 12,
    color: '#888',
  },
  maxText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 16,
    color: '#FFD23E',
  },
  upgradeBtn: {
    backgroundColor: '#5E8F42',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 10,
    marginTop: 4,
  },
  upgradeBtnDisabled: {
    backgroundColor: '#bbb',
  },
  upgradeBtnText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 16,
    color: '#fff',
  },
  closeBtn: {
    marginTop: 4,
    padding: 6,
  },
  closeBtnText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    color: '#888',
  },
});

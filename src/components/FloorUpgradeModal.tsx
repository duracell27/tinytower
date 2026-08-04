import React from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, useColorScheme,
} from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../stores/gameStore';
import { FLOOR_UPGRADE_COSTS } from '../../shared/config/floorUpgradeConfig';
import { gameConfig } from '../../shared/config/gameConfig';
import { FLOOR_TYPE_SCHEMES } from './FloorCard';

const STAR_FULL  = require('../../assets/img/starFull.png');
const STAR_EMPTY = require('../../assets/img/starEmpty.png');
const DIAMOND    = require('../../assets/img/diamond.png');
const TOKEN_ICONS: Record<string, ReturnType<typeof require>> = {
  green:  require('../../assets/img/tokens/tokenGreen.png'),
  blue:   require('../../assets/img/tokens/tokenBlue.png'),
  yellow: require('../../assets/img/tokens/tokenYellow.png'),
  purple: require('../../assets/img/tokens/tokenViolet.png'),
  red:    require('../../assets/img/tokens/tokenRed.png'),
};

export default function FloorUpgradeModal() {
  const { t } = useTranslation('hotel');
  const isDark = useColorScheme() === 'dark';

  const modal            = useGameStore((s) => s.floorUpgradeModal);
  const close            = useGameStore((s) => s.closeFloorUpgradeModal);
  const upgradeFloor     = useGameStore((s) => s.upgradeFloor);
  const floorStars       = useGameStore((s) => s.floorStars);
  const gems             = useGameStore((s) => s.gems);
  const tokens           = useGameStore((s) => s.tokens);
  const openedFloorTypes = useGameStore((s) => s.openedFloorTypes);
  const floors           = useGameStore((s) => s.floors);

  if (!modal) return null;

  const { floorId } = modal;
  const stars  = floorStars?.[String(floorId)] ?? 0;
  const isMax  = stars >= 5;

  const floorConfig = gameConfig.floors.find((f) => f.id === floorId);
  const floorType   = (floorConfig?.floorType ?? openedFloorTypes?.[String(floorId)] ?? '') as keyof typeof tokens;
  const scheme      = FLOOR_TYPE_SCHEMES[floorType as string] ?? FLOOR_TYPE_SCHEMES.green;

  const storeFloor  = floors.find((f) => f.id === floorId);
  const firstTypeId = floorConfig?.availableTypes[0]
    ?? storeFloor?.productions.map((p) => p.typeId).find((id) => id != null)
    ?? null;
  const floorName = firstTypeId && floorType
    ? (gameConfig.floorTypes[floorType as string]?.businesses
        .find((b) => b.dreamJobs.includes(firstTypeId))?.name ?? `Floor ${floorId}`)
    : `Floor ${floorId}`;

  const cost      = isMax ? null : FLOOR_UPGRADE_COSTS[stars];
  const haveTok   = tokens[floorType] ?? 0;
  const canAfford = cost ? gems >= cost.gems && haveTok >= cost.tokens : false;
  const tokenIcon = TOKEN_ICONS[floorType as string];

  return (
    <Modal transparent animationType="fade" visible onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.card}>

          {/* Colored top strip — floor number + floor name */}
          <View style={[styles.strip, { backgroundColor: scheme.color }]}>
            <Text style={styles.stripTitle}>{floorId} {floorName}</Text>
          </View>

          {/* Body — bodyColor = background under cards on the floor */}
          <View style={[styles.body, { backgroundColor: scheme.bodyColor }]}>

            {/* Stars */}
            <View style={styles.starsRow}>
              {[0, 1, 2, 3, 4].map((i) => (
                <Image
                  key={i}
                  source={i < stars ? STAR_FULL : STAR_EMPTY}
                  style={styles.starImg}
                  contentFit="contain"
                />
              ))}
            </View>

            {/* Description */}
            <Text style={styles.description}>
              {t('floorUpgrade.description')}
            </Text>

            {isMax ? (
              <Text style={[styles.maxText, { color: scheme.color }]}>
                {t('floorUpgrade.maxLevel')}
              </Text>
            ) : (
              <>
                {/* Cost row */}
                <View style={[styles.costRow, { backgroundColor: scheme.cardBg }]}>
                  <View style={styles.costItem}>
                    <Image source={DIAMOND} style={styles.costIcon} contentFit="contain" />
                    <Text style={styles.costVal}>{cost!.gems}</Text>
                  </View>
                  {tokenIcon && (
                    <View style={styles.costItem}>
                      <Image source={tokenIcon} style={styles.costIcon} contentFit="contain" />
                      <Text style={styles.costVal}>{cost!.tokens}</Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.upgradeBtn, { backgroundColor: canAfford ? scheme.color : '#bbb' }]}
                  disabled={!canAfford}
                  onPress={() => { upgradeFloor(floorId); close(); }}
                >
                  <Text style={styles.upgradeBtnText}>{t('floorUpgrade.upgradeBtn')}</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity onPress={close} style={styles.closeBtn}>
              <Text style={[styles.closeBtnText, isDark && styles.textMuted]}>
                {t('floorUpgrade.close')}
              </Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: 300,
    borderRadius: 20,
    overflow: 'hidden',
  },
  strip: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  stripTitle: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 20,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  body: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
    gap: 14,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  starImg: {
    width: 34,
    height: 34,
  },
  description: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 13,
    color: '#555',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 4,
  },
  costRow: {
    flexDirection: 'row',
    gap: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 0,
  },
  costItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  costIcon: {
    width: 26,
    height: 26,
  },
  costVal: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 20,
    color: '#222',
  },
  textMuted: {
    color: '#888',
  },
  maxText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 17,
    textAlign: 'center',
  },
  upgradeBtn: {
    borderRadius: 14,
    paddingVertical: 12,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  upgradeBtnText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 16,
    color: '#fff',
  },
  closeBtn: {
    paddingVertical: 2,
  },
  closeBtnText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    color: '#888',
  },
});

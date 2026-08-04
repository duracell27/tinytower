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

  const modal           = useGameStore((s) => s.floorUpgradeModal);
  const close           = useGameStore((s) => s.closeFloorUpgradeModal);
  const upgradeFloor    = useGameStore((s) => s.upgradeFloor);
  const floorStars      = useGameStore((s) => s.floorStars);
  const gems            = useGameStore((s) => s.gems);
  const tokens          = useGameStore((s) => s.tokens);
  const openedFloorTypes = useGameStore((s) => s.openedFloorTypes);
  const floors          = useGameStore((s) => s.floors);

  if (!modal) return null;

  const { floorId } = modal;
  const stars  = floorStars?.[String(floorId)] ?? 0;
  const isMax  = stars >= 5;

  const floorConfig = gameConfig.floors.find((f) => f.id === floorId);
  const floorType   = (floorConfig?.floorType ?? openedFloorTypes?.[String(floorId)] ?? '') as keyof typeof tokens;
  const scheme      = FLOOR_TYPE_SCHEMES[floorType as string] ?? FLOOR_TYPE_SCHEMES.green;

  // Resolve business name from first available typeId (works for static + dynamic floors)
  const storeFloor  = floors.find((f) => f.id === floorId);
  const firstTypeId = floorConfig?.availableTypes[0]
    ?? storeFloor?.productions.map((p) => p.typeId).find((id) => id != null)
    ?? null;
  const floorName = firstTypeId && floorType
    ? (gameConfig.floorTypes[floorType as string]?.businesses
        .find((b) => b.dreamJobs.includes(firstTypeId))?.name ?? `Floor ${floorId}`)
    : `Floor ${floorId}`;

  const cost      = isMax ? null : FLOOR_UPGRADE_COSTS[stars];
  const haveGems  = gems;
  const haveTok   = tokens[floorType] ?? 0;
  const canAfford = cost ? haveGems >= cost.gems && haveTok >= cost.tokens : false;

  const tokenIcon = TOKEN_ICONS[floorType as string];

  return (
    <Modal transparent animationType="fade" visible onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={[styles.card, isDark && styles.cardDark]}>

          {/* Colored header */}
          <View style={[styles.header, { backgroundColor: scheme.color }]}>
            <Text style={styles.headerTitle}>{floorName}</Text>
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
          </View>

          {/* Body */}
          <View style={styles.body}>
            {isMax ? (
              <Text style={[styles.maxText, { color: scheme.color }]}>
                {t('floorUpgrade.maxLevel')}
              </Text>
            ) : (
              <>
                <Text style={[styles.sectionLabel, isDark && styles.textMuted]}>
                  {t('floorUpgrade.cost')}
                </Text>

                {/* Cost row */}
                <View style={styles.resourceRow}>
                  <View style={styles.resourceItem}>
                    <Image source={DIAMOND} style={styles.resourceIcon} contentFit="contain" />
                    <Text style={[styles.resourceVal, isDark && styles.textLight]}>{cost!.gems}</Text>
                  </View>
                  {tokenIcon && (
                    <View style={styles.resourceItem}>
                      <Image source={tokenIcon} style={styles.resourceIcon} contentFit="contain" />
                      <Text style={[styles.resourceVal, isDark && styles.textLight]}>{cost!.tokens}</Text>
                    </View>
                  )}
                </View>

                {/* Balance row */}
                <Text style={[styles.sectionLabel, isDark && styles.textMuted]}>
                  {t('floorUpgrade.balance')}
                </Text>
                <View style={styles.resourceRow}>
                  <View style={styles.resourceItem}>
                    <Image source={DIAMOND} style={styles.resourceIcon} contentFit="contain" />
                    <Text style={[
                      styles.resourceVal,
                      isDark && styles.textLight,
                      haveGems < cost!.gems && styles.insufficient,
                    ]}>
                      {haveGems}
                    </Text>
                  </View>
                  {tokenIcon && (
                    <View style={styles.resourceItem}>
                      <Image source={tokenIcon} style={styles.resourceIcon} contentFit="contain" />
                      <Text style={[
                        styles.resourceVal,
                        isDark && styles.textLight,
                        haveTok < cost!.tokens && styles.insufficient,
                      ]}>
                        {haveTok}
                      </Text>
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

            <TouchableOpacity style={styles.closeBtn} onPress={close}>
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
    backgroundColor: '#fff',
  },
  cardDark: {
    backgroundColor: '#1e1e1e',
  },
  header: {
    paddingTop: 20,
    paddingBottom: 16,
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 20,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  starImg: {
    width: 28,
    height: 28,
  },
  body: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 10,
  },
  sectionLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
    color: '#888',
    alignSelf: 'flex-start',
  },
  resourceRow: {
    flexDirection: 'row',
    gap: 24,
    alignSelf: 'flex-start',
  },
  resourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resourceIcon: {
    width: 22,
    height: 22,
  },
  resourceVal: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 18,
    color: '#222',
  },
  textLight: {
    color: '#f0f0f0',
  },
  textMuted: {
    color: '#888',
  },
  insufficient: {
    color: '#E05050',
  },
  maxText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 17,
    textAlign: 'center',
  },
  upgradeBtn: {
    borderRadius: 14,
    paddingHorizontal: 36,
    paddingVertical: 11,
    marginTop: 6,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  upgradeBtnText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 16,
    color: '#fff',
  },
  closeBtn: {
    paddingVertical: 4,
  },
  closeBtnText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    color: '#888',
  },
});

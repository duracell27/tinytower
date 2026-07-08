import React, { useEffect } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../stores/gameStore';
import { formatNum } from '../utils/format';

const COINS_PER_GEM = 1000;

const { width: SCREEN_W } = Dimensions.get('window');

const TOOL_META: Record<
  'briks' | 'glass' | 'nails' | 'screw',
  { label: string; image: ReturnType<typeof require> }
> = {
  briks: { label: 'Bricks',  image: require('../../assets/img/tools/briks.png') },
  glass: { label: 'Glass',   image: require('../../assets/img/tools/glass.png') },
  nails: { label: 'Nails',   image: require('../../assets/img/tools/nails.png') },
  screw: { label: 'Screws',  image: require('../../assets/img/tools/screw.png') },
};

function CoinIcon() {
  return <Image source={require('../../assets/img/coin.png')} style={{ width: 16, height: 16 }} contentFit="contain" />;
}

function GemIcon() {
  return <Image source={require('../../assets/img/diamond.png')} style={{ width: 16, height: 16 }} contentFit="contain" />;
}

export default function InsufficientResourcesModal() {
  const { t } = useTranslation('common');
  const payload = useGameStore((s) => s.insufficientResources);
  const clearInsufficientResources = useGameStore((s) => s.clearInsufficientResources);
  const exchangeGemsForCoins = useGameStore((s) => s.exchangeGemsForCoins);
  const gems = useGameStore((s) => s.gems);

  const visible = payload !== null;
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 });
      scale.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.back(1.4)) });
    } else {
      opacity.value = 0;
      scale.value = 0.5;
    }
  }, [visible]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!visible || !payload) return null;

  const isGems = payload.currency === 'gems';
  const isCoins = payload.currency === 'coins';
  const isTools = !payload.currency && !!payload.missingTools?.length;
  const canBuy = isGems || isTools;

  const title = isCoins
    ? t('insufficientResources.notEnoughCoins')
    : isGems
      ? t('insufficientResources.notEnoughGems')
      : t('insufficientResources.missingMaterials');

  const deficit = payload.need - payload.have;
  const gemsNeeded = isCoins ? Math.ceil(deficit / COINS_PER_GEM) : 0;
  const canExchange = isCoins && gemsNeeded > 0 && gems >= gemsNeeded;

  const handleShop = () => {
    clearInsufficientResources();
    router.replace('/shop');
  };

  return (
    <Modal transparent animationType="none" onRequestClose={clearInsufficientResources}>
      <Animated.View style={[styles.scrim, scrimStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={clearInsufficientResources} />

        <Animated.View style={[styles.card, cardStyle]}>
          <LinearGradient colors={['#F0F4FA', '#E4EAF2']} style={styles.cardGradient}>

            {/* Icon */}
            <View style={styles.iconWrap}>
              {isCoins && <View style={styles.coinLarge} />}
              {isGems && <View style={styles.gemLarge} />}
              {isTools && (
                <View style={styles.toolIconRow}>
                  {payload.missingTools!.slice(0, 3).map((tool) => (
                    <Image
                      key={tool.key}
                      source={TOOL_META[tool.key].image}
                      style={styles.toolIconSmall}
                      contentFit="contain"
                    />
                  ))}
                </View>
              )}
            </View>

            {/* Title */}
            <Text style={styles.title}>{title}</Text>

            {/* Currency deficit card */}
            {(isCoins || isGems) && (
              <View style={styles.deficitCard}>
                <View style={styles.deficitRow}>
                  <View style={styles.deficitCell}>
                    <Text style={styles.deficitLabel}>{t('insufficientResources.have')}</Text>
                    <View style={styles.deficitValueRow}>
                      {isCoins ? <CoinIcon /> : <GemIcon />}
                      <Text style={[styles.deficitValue, isCoins ? styles.coinText : styles.gemText]}>
                        {formatNum(payload.have)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.arrow}>→</Text>
                  <View style={styles.deficitCell}>
                    <Text style={styles.deficitLabel}>{t('insufficientResources.need')}</Text>
                    <View style={styles.deficitValueRow}>
                      {isCoins ? <CoinIcon /> : <GemIcon />}
                      <Text style={[styles.deficitValue, isCoins ? styles.coinText : styles.gemText]}>
                        {formatNum(payload.need)}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.missingRow}>
                  <Text style={styles.missingLabel}>{t('insufficientResources.missing')}:</Text>
                  <View style={styles.deficitValueRow}>
                    {isCoins ? <CoinIcon /> : <GemIcon />}
                    <Text style={styles.missingValue}>{formatNum(deficit)}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Tools list */}
            {isTools && (
              <View style={styles.toolsCard}>
                {payload.missingTools!.map((tool) => (
                  <View key={tool.key} style={styles.toolItemRow}>
                    <Image
                      source={TOOL_META[tool.key].image}
                      style={styles.toolItemIcon}
                      contentFit="contain"
                    />
                    <Text style={styles.toolItemLabel}>{TOOL_META[tool.key].label}</Text>
                    <View style={styles.toolItemCounts}>
                      <Text style={styles.toolHave}>{tool.have}</Text>
                      <Text style={styles.toolSlash}>/</Text>
                      <Text style={styles.toolNeed}>{tool.need}</Text>
                    </View>
                    <Text style={styles.toolMissing}>-{tool.need - tool.have}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Exchange gems → coins button (coins shortage only) */}
            {canExchange && (
              <Pressable
                onPress={() => {
                  exchangeGemsForCoins(gemsNeeded);
                  clearInsufficientResources();
                }}
                style={({ pressed }) => [styles.shopBtn, pressed && { opacity: 0.85 }]}
              >
                <LinearGradient
                  colors={['#E5A41C', '#C98A10']}
                  style={styles.shopBtnGradient}
                >
                  <Text style={styles.shopBtnText}>
                    {t('insufficientResources.exchangeGems', {
                      gems: gemsNeeded,
                      coins: formatNum(gemsNeeded * COINS_PER_GEM),
                    })}
                  </Text>
                </LinearGradient>
                <View style={[styles.shopBtnShadow, { backgroundColor: '#A06A00' }]} />
              </Pressable>
            )}

            {/* Shop button (gems and tools only) */}
            {canBuy && (
              <Pressable
                onPress={handleShop}
                style={({ pressed }) => [styles.shopBtn, pressed && { opacity: 0.85 }]}
              >
                <LinearGradient
                  colors={['#52A6E2', '#3B8BCB']}
                  style={styles.shopBtnGradient}
                >
                  <Text style={styles.shopBtnText}>{t('insufficientResources.goToShop')}</Text>
                </LinearGradient>
                <View style={styles.shopBtnShadow} />
              </Pressable>
            )}

            {/* Close */}
            <Pressable onPress={clearInsufficientResources} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>{t('insufficientResources.close')}</Text>
            </Pressable>

          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const icons = StyleSheet.create({
  coin: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#F2B330',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  gem: {
    width: 13,
    height: 13,
    backgroundColor: '#3FB8D6',
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
  },
});

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: SCREEN_W * 0.82,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: 'rgba(30,50,80,1)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 30,
    elevation: 12,
  },
  cardGradient: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 22,
    gap: 12,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EEF1F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  coinLarge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F2B330',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.55)',
    shadowColor: 'rgba(180,130,30,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  gemLarge: {
    width: 32,
    height: 32,
    backgroundColor: '#3FB8D6',
    borderRadius: 7,
    transform: [{ rotate: '45deg' }],
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  toolIconRow: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  toolIconSmall: {
    width: 22,
    height: 22,
  },
  title: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 22,
    color: '#2A3344',
    textAlign: 'center',
  },
  deficitCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 10,
    shadowColor: 'rgba(40,60,90,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  deficitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deficitCell: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  deficitLabel: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 12,
    color: '#9BA3B0',
  },
  deficitValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  deficitValue: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 18,
  },
  arrow: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 18,
    color: '#C5CAD4',
    marginHorizontal: 4,
  },
  missingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF3F2',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  missingLabel: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 13,
    color: '#D9534F',
  },
  missingValue: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 16,
    color: '#D9534F',
  },
  coinText: {
    color: '#C28A22',
  },
  gemText: {
    color: '#2592AB',
  },
  toolsCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 10,
    shadowColor: 'rgba(40,60,90,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  toolItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  toolItemIcon: {
    width: 28,
    height: 28,
  },
  toolItemLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    color: '#2A3344',
    flex: 1,
  },
  toolItemCounts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  toolHave: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
    color: '#9BA3B0',
  },
  toolSlash: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 12,
    color: '#C5CAD4',
  },
  toolNeed: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
    color: '#5A6478',
  },
  toolMissing: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 13,
    color: '#D9534F',
    minWidth: 26,
    textAlign: 'right',
  },
  shopBtn: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  shopBtnGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    zIndex: 1,
  },
  shopBtnText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 16,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  shopBtnShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#2E72A8',
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  closeBtn: {
    paddingVertical: 6,
  },
  closeBtnText: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 14,
    color: '#9BA3B0',
  },
});

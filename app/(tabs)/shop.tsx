import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, useWindowDimensions, useColorScheme,
} from 'react-native';
import { Image } from 'expo-image';
import AppBackground from '../../src/components/AppBackground';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import TopBar from '../../src/components/TopBar';
import { useGameStore, useBalance } from '../../src/stores/gameStore';
import { useAuthStore } from '../../src/stores/authStore';
import { xpForLevel } from '../../shared/engine/xp';
import { formatNum } from '../../src/utils/format';
import { useGameClock } from '../../src/hooks/useGameClock';
import { calcRevenuePerMin } from '../../shared/engine/ratingUtils';
import { gameConfig } from '../../shared/config/gameConfig';
import {
  DIAMOND_PACKS, BUNDLE_PACKS, BUILDER_PACKS, MATERIAL_PACKS, ShopPack,
} from '../../src/data/shopPacks';
import { BOOST_PACKAGES, BoostPackage } from '../../shared/config/boostConfig';

const DIAMOND_ICON = require('../../assets/img/diamond.png');
const TOKEN_ICONS: Record<string, ReturnType<typeof require>> = {
  green:  require('../../assets/img/tokens/tokenGreen.png'),
  blue:   require('../../assets/img/tokens/tokenBlue.png'),
  yellow: require('../../assets/img/tokens/tokenYellow.png'),
  purple: require('../../assets/img/tokens/tokenViolet.png'),
  red:    require('../../assets/img/tokens/tokenRed.png'),
};
const TOOL_ICONS: Record<string, ReturnType<typeof require>> = {
  briks:  require('../../assets/img/tools/briks.png'),
  glass:  require('../../assets/img/tools/glass.png'),
  nails:  require('../../assets/img/tools/nails.png'),
  screw:  require('../../assets/img/tools/screw.png'),
  wood:   require('../../assets/img/tools/wood.png'),
  cement: require('../../assets/img/tools/cement.png'),
};

// Colors from FLOOR_TYPE_SCHEMES in FloorCard.tsx — single source of truth
const SECTION_THEME: Record<string, { gradient: [string, string]; btn: string }> = {
  diamonds:  { gradient: ['#5E8F42', '#5E8F42'], btn: '#5E8F42' },
  bundles:   { gradient: ['#2E6EC9', '#2E6EC9'], btn: '#2E6EC9' },
  builder:   { gradient: ['#E7A52B', '#E7A52B'], btn: '#E7A52B' },
  materials: { gradient: ['#9A6FD0', '#9A6FD0'], btn: '#9A6FD0' },
  boosts:    { gradient: ['#F5A623', '#E8820C'] as [string, string], btn: '#F5A623' },
};

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title, sectionKey }: { title: string; sectionKey: string }) {
  const theme = SECTION_THEME[sectionKey] ?? { gradient: ['#9A6FD0', '#7B52BC'] as [string, string] };
  return (
    <LinearGradient
      colors={theme.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={sh.wrap}
    >
      <Text style={sh.text}>{title}</Text>
    </LinearGradient>
  );
}
const sh = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginBottom: 12, marginTop: 16,
          borderRadius: 14, paddingHorizontal: 18, paddingVertical: 10 },
  text: { fontFamily: 'Fredoka_700Bold', fontSize: 18, color: '#FFF', letterSpacing: 0.3 },
});

// ─── Badge chip ───────────────────────────────────────────────────────────────

function Badge({ kind }: { kind: 'best' | 'popular' }) {
  const { t } = useTranslation('tabs');
  return (
    <View style={[bdg.wrap, kind === 'best' ? bdg.best : bdg.pop]}>
      <Text style={bdg.text}>{kind === 'best' ? t('shop.badges.best') : t('shop.badges.popular')}</Text>
    </View>
  );
}
const bdg = StyleSheet.create({
  wrap: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  best: { backgroundColor: '#F2A227' },
  pop:  { backgroundColor: '#3FA535' },
  text: { fontFamily: 'Fredoka_700Bold', fontSize: 10, color: '#FFF' },
});

// ─── Diamond card (2-column grid, white bg) ───────────────────────────────────

function DiamondCard({ pack, onBuy, buying, disabled, cardWidth, btnColor }: {
  pack: ShopPack;
  onBuy: (pack: ShopPack) => void;
  buying: boolean;
  disabled: boolean;
  cardWidth: number;
  btnColor: string;
}) {
  const isDark = useColorScheme() === 'dark';
  const baseGems = pack.rewards.gems != null
    ? pack.rewards.gems - (pack.bonusGems ?? 0)
    : null;

  const activeBtnColor = isDark ? (pack.btnColorDark ?? btnColor) : btnColor;
  const btnTxtColor = pack.btnTextColor ?? (bgBrightness(activeBtnColor) < 148 ? '#FFF' : '#2D1A4E');

  return (
    <View style={[dc.card, { width: cardWidth }, isDark && { backgroundColor: '#252D42' }, buying && dc.buying]}>
      <Image source={pack.image} style={dc.img} contentFit="contain" />

      {pack.badge && <View style={dc.badgePos}><Badge kind={pack.badge} /></View>}

      {baseGems != null && (
        <View style={dc.gemRow}>
          <Image source={DIAMOND_ICON} style={dc.gemIcon} contentFit="contain" />
          <Text style={[dc.gemText, isDark && { color: '#DDE8D8' }]}>{baseGems.toLocaleString()}</Text>
        </View>
      )}

      {pack.bonusGems
        ? <View style={[dc.bonusChip, isDark && { backgroundColor: 'rgba(90,180,70,0.15)' }]}>
            <Text style={[dc.bonusText, isDark && { color: '#5ABF50' }]}>+{pack.bonusGems.toLocaleString()} bonus</Text>
          </View>
        : <View style={[dc.baseChip, isDark && { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
            <Text style={[dc.baseText, isDark && { color: '#8A9A80' }]}>Base price</Text>
          </View>
      }

      <Text style={[dc.name, isDark && { color: '#DDE8D8' }]}>{pack.name}</Text>

      <Pressable
        style={[dc.btn, { backgroundColor: activeBtnColor }, disabled && dc.btnDisabled]}
        onPress={() => !disabled && onBuy(pack)}
        disabled={disabled}
      >
        {buying
          ? <ActivityIndicator color={btnTxtColor} size="small" />
          : <Text style={[dc.btnText, { color: btnTxtColor }]}>{pack.price}</Text>
        }
      </Pressable>
    </View>
  );
}
const dc = StyleSheet.create({
  card:       { backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 18,
                padding: 12, alignItems: 'center', gap: 6, elevation: 3 },
  buying:     { opacity: 0.7 },
  badgePos:   { position: 'absolute', top: 8, right: 8, zIndex: 2 },
  img:        { width: 80, height: 80 },
  gemRow:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  gemIcon:    { width: 18, height: 18 },
  gemText:    { fontFamily: 'Fredoka_700Bold', fontSize: 17, color: '#2D1A4E' },
  bonusChip:  { backgroundColor: 'rgba(32,129,15,0.12)', borderRadius: 8,
                paddingHorizontal: 8, paddingVertical: 2 },
  bonusText:  { fontFamily: 'Fredoka_600SemiBold', fontSize: 12, color: '#20810F' },
  baseChip:   { backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 8,
                paddingHorizontal: 8, paddingVertical: 2 },
  baseText:   { fontFamily: 'Fredoka_500Medium', fontSize: 12, color: '#9A8BAA' },
  name:       { fontFamily: 'Fredoka_700Bold', fontSize: 15, color: '#2D1A4E', textAlign: 'center' },
  btn:        { borderRadius: 12,
                paddingHorizontal: 16, paddingVertical: 8, minWidth: 110, alignItems: 'center', marginTop: 2 },
  btnDisabled:{ opacity: 0.5 },
  btnText:    { fontFamily: 'Fredoka_700Bold', fontSize: 14 },
});

// ─── Full-width card  (bundles & builder) ─────────────────────────────────────
// Gradient card bg, header image+name+desc, reward pillars, large buy button

function bgBrightness(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
}

function FullWidthCard({ pack, onBuy, buying, disabled, fullWidth, btnColor }: {
  pack: ShopPack;
  onBuy: (pack: ShopPack) => void;
  buying: boolean;
  disabled: boolean;
  fullWidth: number;
  btnColor: string;
}) {
  const isDark = useColorScheme() === 'dark';
  const bg = (isDark ? (pack.imageBgDark ?? pack.imageBg) : pack.imageBg) ?? ['#EEE8FF', '#D8CCFF'] as [string, string];

  // Use average brightness of both gradient stops to decide text colour
  const avgBright = (bgBrightness(bg[0]) + bgBrightness(bg[1])) / 2;
  const dark = avgBright < 148;
  const txt       = dark ? '#FFFFFF'              : '#2D1A4E';
  const txtSub    = dark ? 'rgba(255,255,255,0.85)' : '#4A3060';
  const txtReward = dark ? 'rgba(255,255,255,0.92)' : '#3A2360';
  const sepColor  = dark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.08)';
  const divColor  = dark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.12)';

  const toolEntries  = Object.entries(pack.rewards.tools  ?? {}).filter(([, v]) => v) as [string, number][];
  const tokenEntries = Object.entries(pack.rewards.tokens ?? {}).filter(([, v]) => v) as [string, number][];
  const hasRight = toolEntries.length > 0 || tokenEntries.length > 0;

  return (
    <LinearGradient
      colors={bg}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[fw.card, { width: fullWidth }, buying && fw.buying]}
    >
      {/* Header */}
      <View style={fw.header}>
        <View style={fw.imgWrap}>
          <Image source={pack.image} style={fw.img} contentFit="contain" />
        </View>
        <View style={fw.headerText}>
          <View style={fw.titleRow}>
            <Text style={[fw.name, { color: txt }]}>{pack.name}</Text>
            {pack.badge && <Badge kind={pack.badge} />}
          </View>
          {pack.description && <Text style={[fw.desc, { color: txtSub }]}>{pack.description}</Text>}
        </View>
      </View>

      <View style={[fw.sep, { backgroundColor: sepColor }]} />

      {/* Rewards — gems left | tools + tokens right */}
      <View style={fw.rewardSection}>
        {!!pack.rewards.gems && (
          <View style={fw.leftSide}>
            <Image source={DIAMOND_ICON} style={fw.gemIcon} contentFit="contain" />
            <Text style={[fw.gemCount, { color: txt }]}>{pack.rewards.gems.toLocaleString()}</Text>
          </View>
        )}
        {!!pack.rewards.gems && hasRight && <View style={[fw.vDivider, { backgroundColor: divColor }]} />}
        {hasRight && (
          <View style={fw.rightSide}>
            {toolEntries.length > 0 && (
              <View style={fw.rewardRow}>
                {toolEntries.map(([k, v]) => (
                  <View key={k} style={fw.rewardItem}>
                    <Image source={TOOL_ICONS[k]} style={fw.rewardIcon} contentFit="contain" />
                    <Text style={[fw.rewardCount, { color: txtReward }]}>×{v}</Text>
                  </View>
                ))}
              </View>
            )}
            {tokenEntries.length > 0 && (
              <View style={fw.rewardRow}>
                {tokenEntries.map(([k, v]) => (
                  <View key={k} style={fw.rewardItem}>
                    <Image source={TOKEN_ICONS[k]} style={fw.rewardIcon} contentFit="contain" />
                    <Text style={[fw.rewardCount, { color: txtReward }]}>×{v}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </View>

      <View style={[fw.sep, { backgroundColor: sepColor }]} />

      {/* Large buy button */}
      <Pressable
        style={[fw.btn, { backgroundColor: btnColor }, disabled && fw.btnDisabled]}
        onPress={() => !disabled && onBuy(pack)}
        disabled={disabled}
      >
        {buying
          ? <ActivityIndicator color="#FFF" size="small" />
          : <Text style={fw.btnText}>{pack.price}</Text>
        }
      </Pressable>
    </LinearGradient>
  );
}
const fw = StyleSheet.create({
  card:        { borderRadius: 20, padding: 16, gap: 14, elevation: 4,
                 shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
                 shadowOpacity: 0.12, shadowRadius: 6 },
  buying:      { opacity: 0.7 },
  header:      { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  imgWrap:     { width: 72, height: 72, borderRadius: 14,
                 backgroundColor: 'rgba(255,255,255,0.45)',
                 alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  img:         { width: 58, height: 58 },
  headerText:  { flex: 1, gap: 4, justifyContent: 'center' },
  titleRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name:        { fontFamily: 'Fredoka_700Bold', fontSize: 18, color: '#2D1A4E' },
  desc:        { fontFamily: 'Fredoka_400Regular', fontSize: 12, color: '#4A3060', lineHeight: 17 },
  sep:         { height: 1, backgroundColor: 'rgba(0,0,0,0.08)' },
  rewardSection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  leftSide:      { alignItems: 'center', gap: 5 },
  vDivider:      { width: 1, alignSelf: 'stretch', backgroundColor: 'rgba(0,0,0,0.12)' },
  rightSide:     { gap: 10 },
  rewardRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  rewardItem:    { alignItems: 'center', gap: 4 },
  gemIcon:       { width: 42, height: 42 },
  gemCount:      { fontFamily: 'Fredoka_700Bold', fontSize: 17, color: '#2D1A4E' },
  rewardIcon:    { width: 28, height: 28 },
  rewardCount:   { fontFamily: 'Fredoka_600SemiBold', fontSize: 13, color: '#3A2360' },
  btn:         { borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnText:     { fontFamily: 'Fredoka_700Bold', fontSize: 16, color: '#FFF' },
});

// ─── Material card (2-column grid, coloured bg) ───────────────────────────────

function MaterialCard({ pack, onBuy, buying, disabled, cardWidth, btnColor }: {
  pack: ShopPack;
  onBuy: (pack: ShopPack) => void;
  buying: boolean;
  disabled: boolean;
  cardWidth: number;
  btnColor: string;
}) {
  const { t } = useTranslation('tabs');
  const isDark = useColorScheme() === 'dark';
  const bg = (isDark ? (pack.imageBgDark ?? pack.imageBg) : pack.imageBg) ?? ['#E8E0FF', '#C8B8F0'] as [string, string];
  const avgBright = (bgBrightness(bg[0]) + bgBrightness(bg[1])) / 2;
  const onDark = avgBright < 148;
  const txt    = onDark ? '#FFFFFF'               : '#2D1A4E';
  const txtSub = onDark ? 'rgba(255,255,255,0.78)' : '#4A3060';

  const activeBtnColor = isDark ? (pack.btnColorDark ?? btnColor) : btnColor;
  const btnTxtColor = pack.btnTextColor ?? (bgBrightness(activeBtnColor) < 148 ? '#FFF' : '#2D1A4E');

  return (
    <LinearGradient
      colors={bg}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[mc.card, { width: cardWidth }, buying && mc.buying]}
    >
      <Image source={pack.image} style={mc.icon} contentFit="contain" />
      <Text style={[mc.name, { color: txt }]}>{pack.name}</Text>
      {pack.description && <Text style={[mc.desc, { color: txtSub }]}>{pack.description}</Text>}
      <View style={[mc.qtyChip, { backgroundColor: onDark ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.42)' }]}>
        <Text style={[mc.qty, { color: txt }]}>{t('shop.each5')}</Text>
      </View>
      <Pressable
        style={[mc.btn, { backgroundColor: activeBtnColor }, disabled && mc.btnDisabled]}
        onPress={() => !disabled && onBuy(pack)}
        disabled={disabled}
      >
        {buying
          ? <ActivityIndicator color={btnTxtColor} size="small" />
          : <Text style={[mc.btnText, { color: btnTxtColor }]}>{pack.price}</Text>
        }
      </Pressable>
    </LinearGradient>
  );
}
const mc = StyleSheet.create({
  card:       { borderRadius: 18, padding: 14, alignItems: 'center', gap: 8, elevation: 3,
                shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.10, shadowRadius: 4 },
  buying:     { opacity: 0.7 },
  icon:       { width: 72, height: 72 },
  name:       { fontFamily: 'Fredoka_700Bold', fontSize: 16, color: '#2D1A4E', textAlign: 'center' },
  nameLight:  { color: '#FFFFFF' },
  desc:       { fontFamily: 'Fredoka_400Regular', fontSize: 11, color: '#4A3060', textAlign: 'center', lineHeight: 15 },
  descLight:  { color: 'rgba(255,255,255,0.75)' },
  qtyChip:    { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  qty:        { fontFamily: 'Fredoka_700Bold', fontSize: 13 },
  btn:        { borderRadius: 12, paddingVertical: 11, alignSelf: 'stretch',
                alignItems: 'center', marginTop: 2 },
  btnDisabled:{ opacity: 0.5 },
  btnText:    { fontFamily: 'Fredoka_700Bold', fontSize: 14 },
});

// ─── Boost sub-section ───────────────────────────────────────────────────────

function BoostSubSection({
  label,
  activePercent,
  expiresAt,
  packages,
  gems,
  now,
  onBuy,
}: {
  label: string;
  activePercent: number;
  expiresAt: number;
  packages: BoostPackage[];
  gems: number;
  now: number;
  onBuy: (pkg: BoostPackage) => void;
}) {
  const isDark = useColorScheme() === 'dark';
  const remaining = expiresAt > now ? (() => {
    const ms = expiresAt - now;
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return `${h}h ${m}m`;
  })() : null;

  const txt = isDark ? '#F0F0F0' : '#1A1A1A';
  const sub = isDark ? '#9A9A9A' : '#666';
  const cardBg = isDark ? '#2A2A2A' : '#F5F5F5';
  const disabledBg = isDark ? '#1A1A1A' : '#E0E0E0';

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontFamily: 'Fredoka_600SemiBold', fontSize: 16, color: txt, marginBottom: 4 }}>
        {label}
      </Text>
      {remaining && (
        <Text style={{ fontFamily: 'Fredoka_400Regular', fontSize: 13, color: '#F5A623', marginBottom: 8 }}>
          Active: +{activePercent}% · {remaining} remaining
        </Text>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {packages.map((pkg) => {
          const canAfford = gems >= pkg.gemCost;
          return (
            <Pressable
              key={pkg.id}
              onPress={() => canAfford && onBuy(pkg)}
              style={{
                backgroundColor: canAfford ? cardBg : disabledBg,
                borderRadius: 12,
                padding: 12,
                minWidth: 90,
                alignItems: 'center',
                opacity: canAfford ? 1 : 0.5,
              }}
            >
              <Text style={{ fontFamily: 'Fredoka_600SemiBold', fontSize: 18, color: '#F5A623' }}>
                +{pkg.percent}%
              </Text>
              <Text style={{ fontFamily: 'Fredoka_400Regular', fontSize: 12, color: sub, marginTop: 2 }}>
                30 hrs
              </Text>
              <Text style={{ fontFamily: 'Fredoka_600SemiBold', fontSize: 13, color: txt, marginTop: 4 }}>
                💎 {pkg.gemCost}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ShopScreen() {
  const { t } = useTranslation('tabs');
  const { width: screenWidth } = useWindowDimensions();
  const balance      = useBalance();
  const playerLevel  = useGameStore((s) => s.playerLevel);
  const playerXp     = useGameStore((s) => s.playerXp);
  const gems         = useGameStore((s) => s.gems);
  const player       = useAuthStore((s) => s.player);
  const shopPurchase = useGameStore((s) => s.shopPurchase);
  const buyBoost     = useGameStore((s) => s.buyBoost);
  const coinBoostPercent   = useGameStore((s) => s.coinBoostPercent);
  const xpBoostPercent     = useGameStore((s) => s.xpBoostPercent);
  const coinBoostExpiresAt = useGameStore((s) => s.coinBoostExpiresAt);
  const xpBoostExpiresAt   = useGameStore((s) => s.xpBoostExpiresAt);
  const playerName   = player?.playerName ?? t('profile.guestFallbackName');
  const floors = useGameStore((s) => s.floors);
  const workers = useGameStore((s) => s.workers);
  const openedFloorTypes = useGameStore((s) => s.openedFloorTypes);
  const coinBonusPercent = useGameStore((s) => s.coinBonusPercent);
  const businessUpgrades = useGameStore((s) => s.businessUpgrades);
  const floorStars       = useGameStore((s) => s.floorStars);
  const now = useGameClock(60_000);
  const revenuePerMin = React.useMemo(
    () => calcRevenuePerMin(floors, workers, openedFloorTypes ?? {}, gameConfig, now, businessUpgrades, coinBonusPercent, floorStars),
    [floors, workers, openedFloorTypes, now, businessUpgrades, coinBonusPercent, floorStars],
  );

  const cardWidth = Math.floor((screenWidth - 32 - 12) / 2);
  const fullWidth = screenWidth - 32;

  const [buyingId, setBuyingId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const handleBuy = (pack: ShopPack) => {
    if (buyingId) return;
    setBuyingId(pack.id);
    timerRef.current = setTimeout(() => {
      shopPurchase(pack);
      setBuyingId(null);
    }, 3000);
  };

  const handleBuyBoost = (pkg: BoostPackage) => {
    buyBoost(pkg);
  };

  return (
    <View style={styles.container}>
      <AppBackground style={styles.background}>
        <TopBar
          name={playerName}
          level={playerLevel}
          xp={playerXp}
          xpForNextLevel={xpForLevel(playerLevel)}
          coins={formatNum(balance)}
          gems={formatNum(gems)}
          revenuePerMin={revenuePerMin}
        />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Diamonds — 2-column grid, white cards */}
          <SectionHeader title={t('shop.sections.diamonds')} sectionKey="diamonds" />
          <View style={styles.grid}>
            {DIAMOND_PACKS.map((pack) => (
              <DiamondCard key={pack.id} pack={pack} onBuy={handleBuy}
                buying={buyingId === pack.id} disabled={buyingId !== null}
                cardWidth={cardWidth} btnColor={pack.btnColor ?? SECTION_THEME.diamonds.btn} />
            ))}
          </View>

          {/* Bundles — single column, coloured cards */}
          <SectionHeader title={t('shop.sections.bundles')} sectionKey="bundles" />
          <View style={styles.column}>
            {BUNDLE_PACKS.map((pack) => (
              <FullWidthCard key={pack.id} pack={pack} onBuy={handleBuy}
                buying={buyingId === pack.id} disabled={buyingId !== null}
                fullWidth={fullWidth} btnColor={pack.btnColor ?? SECTION_THEME.bundles.btn} />
            ))}
          </View>

          {/* Builder — single column, coloured cards */}
          <SectionHeader title={t('shop.sections.builder')} sectionKey="builder" />
          <View style={styles.column}>
            {BUILDER_PACKS.map((pack) => (
              <FullWidthCard key={pack.id} pack={pack} onBuy={handleBuy}
                buying={buyingId === pack.id} disabled={buyingId !== null}
                fullWidth={fullWidth} btnColor={pack.btnColor ?? SECTION_THEME.builder.btn} />
            ))}
          </View>

          {/* Materials — 2-column grid, coloured cards */}
          <SectionHeader title={t('shop.sections.materials')} sectionKey="materials" />
          <View style={styles.grid}>
            {MATERIAL_PACKS.map((pack) => (
              <MaterialCard key={pack.id} pack={pack} onBuy={handleBuy}
                buying={buyingId === pack.id} disabled={buyingId !== null}
                cardWidth={cardWidth} btnColor={pack.btnColor ?? SECTION_THEME.materials.btn} />
            ))}
          </View>

          {/* Boosts — coin and XP boost packages */}
          <SectionHeader title="Boosts" sectionKey="boosts" />
          <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <BoostSubSection
              label="💰 Coin Boost"
              activePercent={coinBoostPercent}
              expiresAt={coinBoostExpiresAt}
              packages={BOOST_PACKAGES.filter((p) => p.boostType === 'coin')}
              gems={gems}
              now={now}
              onBuy={handleBuyBoost}
            />
            <BoostSubSection
              label="⭐ XP Boost"
              activePercent={xpBoostPercent}
              expiresAt={xpBoostExpiresAt}
              packages={BOOST_PACKAGES.filter((p) => p.boostType === 'xp')}
              gems={gems}
              now={now}
              onBuy={handleBuyBoost}
            />
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </AppBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1 },
  background:    { flex: 1, backgroundColor: '#DCEFF6' },
  scroll:        { flex: 1 },
  scrollContent: { paddingTop: 130, paddingBottom: 50 },
  grid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 12,
                   paddingHorizontal: 16, paddingBottom: 8 },
  column:        { flexDirection: 'column', gap: 12,
                   paddingHorizontal: 16, paddingBottom: 8 },
});

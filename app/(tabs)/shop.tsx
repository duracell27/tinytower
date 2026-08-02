import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, useWindowDimensions,
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
import {
  DIAMOND_PACKS, BUNDLE_PACKS, BUILDER_PACKS, MATERIAL_PACKS, ShopPack,
} from '../../src/data/shopPacks';

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

// Floor-palette section themes
const SECTION_THEME: Record<string, { gradient: [string, string]; btn: string }> = {
  diamonds:  { gradient: ['#49AA38', '#20810F'], btn: '#20810F' },
  bundles:   { gradient: ['#3376E5', '#0A4DBC'], btn: '#0A4DBC' },
  builder:   { gradient: ['#E5A72E', '#BC7E05'], btn: '#BC7E05' },
  materials: { gradient: ['#9A6FD0', '#7B52BC'], btn: '#7B52BC' },
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

// ─── Grouped reward row ───────────────────────────────────────────────────────
// Tools/tokens that all share the same count show as: 🧱🔧🪛🪵🪨🔩 ×3
// Gems and non-uniform groups show individually

function GroupedRewardRow({ pack, iconSize = 20 }: { pack: ShopPack; iconSize?: number }) {
  const fontSize = Math.round(iconSize * 0.72);

  const toolEntries  = Object.entries(pack.rewards.tools  ?? {}).filter(([, v]) => v) as [string, number][];
  const tokenEntries = Object.entries(pack.rewards.tokens ?? {}).filter(([, v]) => v) as [string, number][];

  const toolsUniform  = toolEntries.length  > 1 && toolEntries.every(([, v])  => v === toolEntries[0][1]);
  const tokensUniform = tokenEntries.length > 1 && tokenEntries.every(([, v]) => v === tokenEntries[0][1]);

  return (
    <View style={gr.container}>
      {/* Gems — own row, larger & bolder */}
      {!!pack.rewards.gems && (
        <View style={gr.line}>
          <Image source={DIAMOND_ICON} style={{ width: iconSize + 2, height: iconSize + 2 }} contentFit="contain" />
          <Text style={[gr.count, gr.countGems, { fontSize: fontSize + 2 }]}>×{pack.rewards.gems.toLocaleString()}</Text>
        </View>
      )}

      {/* Tools — own row */}
      {toolEntries.length > 0 && (
        <View style={gr.line}>
          {toolsUniform ? (
            <>
              {toolEntries.map(([k]) => (
                <Image key={k} source={TOOL_ICONS[k]} style={{ width: iconSize, height: iconSize }} contentFit="contain" />
              ))}
              <Text style={[gr.count, { fontSize }]}>×{toolEntries[0][1]}</Text>
            </>
          ) : toolEntries.map(([k, v]) => (
            <View key={k} style={gr.item}>
              <Image source={TOOL_ICONS[k]} style={{ width: iconSize, height: iconSize }} contentFit="contain" />
              <Text style={[gr.count, { fontSize }]}>×{v}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Tokens — own row */}
      {tokenEntries.length > 0 && (
        <View style={gr.line}>
          {tokensUniform ? (
            <>
              {tokenEntries.map(([k]) => (
                <Image key={k} source={TOKEN_ICONS[k]} style={{ width: iconSize, height: iconSize }} contentFit="contain" />
              ))}
              <Text style={[gr.count, { fontSize }]}>×{tokenEntries[0][1]}</Text>
            </>
          ) : tokenEntries.map(([k, v]) => (
            <View key={k} style={gr.item}>
              <Image source={TOKEN_ICONS[k]} style={{ width: iconSize, height: iconSize }} contentFit="contain" />
              <Text style={[gr.count, { fontSize }]}>×{v}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
const gr = StyleSheet.create({
  container: { gap: 4, marginTop: 6 },
  line:      { flexDirection: 'row', alignItems: 'center', gap: 3, flexWrap: 'wrap' },
  item:      { flexDirection: 'row', alignItems: 'center', gap: 2 },
  count:     { fontFamily: 'Fredoka_600SemiBold', color: '#3A2360' },
  countGems: { fontFamily: 'Fredoka_700Bold', color: '#2D1A4E' },
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

// ─── Diamond / Material card  (2-column grid) ─────────────────────────────────

function PackCard({ pack, onBuy, buying, disabled, cardWidth, btnColor }: {
  pack: ShopPack;
  onBuy: (pack: ShopPack) => void;
  buying: boolean;
  disabled: boolean;
  cardWidth: number;
  btnColor: string;
}) {
  const { t } = useTranslation('tabs');
  const isDiamond  = pack.section === 'diamonds';
  const isMaterial = pack.section === 'materials';

  const baseGems = isDiamond && pack.rewards.gems != null
    ? pack.rewards.gems - (pack.bonusGems ?? 0)
    : null;

  return (
    <View style={[pc.card, { width: cardWidth }, buying && pc.buying]}>
      {/* Image */}
      {pack.imageBg ? (
        <LinearGradient colors={pack.imageBg as [string, string]} style={pc.imgBg}>
          <Image source={pack.image} style={pc.imgBgImg} contentFit="contain" />
        </LinearGradient>
      ) : (
        <Image source={pack.image} style={isMaterial ? pc.imgMat : pc.img} contentFit="contain" />
      )}

      {pack.badge && <View style={pc.badgePos}><Badge kind={pack.badge} /></View>}

      {/* Diamond: base gem count */}
      {isDiamond && baseGems != null && (
        <View style={pc.gemRow}>
          <Image source={DIAMOND_ICON} style={pc.gemIcon} contentFit="contain" />
          <Text style={pc.gemText}>{baseGems.toLocaleString()}</Text>
        </View>
      )}

      {/* Diamond: bonus chip — always shown to keep height uniform */}
      {isDiamond && (
        pack.bonusGems
          ? <View style={pc.bonusChip}><Text style={pc.bonusText}>+{pack.bonusGems.toLocaleString()} bonus</Text></View>
          : <View style={pc.baseChip}><Text style={pc.baseText}>Base price</Text></View>
      )}

      {/* Material: quantity */}
      {isMaterial && <Text style={pc.qty}>{t('shop.each5')}</Text>}

      {/* Name above button */}
      <Text style={pc.name}>{pack.name}</Text>

      <Pressable
        style={[pc.btn, { backgroundColor: btnColor }, disabled && pc.btnDisabled]}
        onPress={() => !disabled && onBuy(pack)}
        disabled={disabled}
      >
        {buying
          ? <ActivityIndicator color="#FFF" size="small" />
          : <Text style={pc.btnText}>{pack.price}</Text>
        }
      </Pressable>
    </View>
  );
}
const pc = StyleSheet.create({
  card:       { backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 18,
                padding: 12, alignItems: 'center', gap: 6, elevation: 3 },
  buying:     { opacity: 0.7 },
  badgePos:   { position: 'absolute', top: 8, right: 8, zIndex: 2 },
  img:        { width: 80, height: 80 },
  imgBg:      { width: 108, height: 108, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  imgBgImg:   { width: 90, height: 90 },
  imgMat:     { width: 56, height: 56 },
  gemRow:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  gemIcon:    { width: 18, height: 18 },
  gemText:    { fontFamily: 'Fredoka_700Bold', fontSize: 17, color: '#2D1A4E' },
  bonusChip:  { backgroundColor: 'rgba(32,129,15,0.12)', borderRadius: 8,
                paddingHorizontal: 8, paddingVertical: 2 },
  bonusText:  { fontFamily: 'Fredoka_600SemiBold', fontSize: 12, color: '#20810F' },
  baseChip:   { backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 8,
                paddingHorizontal: 8, paddingVertical: 2 },
  baseText:   { fontFamily: 'Fredoka_500Medium', fontSize: 12, color: '#9A8BAA' },
  qty:        { fontFamily: 'Fredoka_500Medium', fontSize: 12, color: '#7055A0' },
  name:       { fontFamily: 'Fredoka_700Bold', fontSize: 15, color: '#2D1A4E', textAlign: 'center' },
  btn:        { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8,
                minWidth: 110, alignItems: 'center', marginTop: 2 },
  btnDisabled:{ opacity: 0.5 },
  btnText:    { fontFamily: 'Fredoka_700Bold', fontSize: 14, color: '#FFF' },
});

// ─── Full-width card  (bundles & builder — single column) ─────────────────────

function FullWidthCard({ pack, onBuy, buying, disabled, fullWidth, btnColor }: {
  pack: ShopPack;
  onBuy: (pack: ShopPack) => void;
  buying: boolean;
  disabled: boolean;
  fullWidth: number;
  btnColor: string;
}) {
  return (
    <View style={[fw.card, { width: fullWidth }, buying && fw.buying]}>
      {/* Left image */}
      {pack.imageBg ? (
        <LinearGradient colors={pack.imageBg as [string, string]} style={fw.imgBg}>
          <Image source={pack.image} style={fw.imgBgImg} contentFit="contain" />
        </LinearGradient>
      ) : (
        <Image source={pack.image} style={fw.img} contentFit="contain" />
      )}

      {/* Right content */}
      <View style={fw.content}>
        <View style={fw.titleRow}>
          <Text style={fw.name}>{pack.name}</Text>
          {pack.badge && <Badge kind={pack.badge} />}
        </View>

        {pack.description && <Text style={fw.desc}>{pack.description}</Text>}

        <GroupedRewardRow pack={pack} iconSize={20} />

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
      </View>
    </View>
  );
}
const fw = StyleSheet.create({
  card:       { backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 18,
                padding: 14, flexDirection: 'row', gap: 14, elevation: 3, alignItems: 'flex-start' },
  buying:     { opacity: 0.7 },
  imgBg:      { width: 84, height: 84, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  imgBgImg:   { width: 68, height: 68 },
  img:        { width: 84, height: 84, flexShrink: 0 },
  content:    { flex: 1, gap: 4 },
  titleRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name:       { fontFamily: 'Fredoka_700Bold', fontSize: 17, color: '#2D1A4E' },
  desc:       { fontFamily: 'Fredoka_400Regular', fontSize: 12, color: '#7055A0', lineHeight: 17 },
  btn:        { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8,
                alignItems: 'center', marginTop: 6 },
  btnDisabled:{ opacity: 0.5 },
  btnText:    { fontFamily: 'Fredoka_700Bold', fontSize: 14, color: '#FFF' },
});

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
  const playerName   = player?.playerName ?? t('profile.guestFallbackName');

  const cardWidth   = Math.floor((screenWidth - 32 - 12) / 2);
  const fullWidth   = screenWidth - 32;

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

  return (
    <View style={styles.container}>
      <AppBackground style={styles.background}>
        <TopBar
          name={playerName}
          level={playerLevel}
          xp={playerXp}
          xpForNextLevel={xpForLevel(playerLevel)}
          coins={formatNum(balance)}
          gems={String(gems)}
        />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Diamonds — 2-column grid */}
          <SectionHeader title={t('shop.sections.diamonds')} sectionKey="diamonds" />
          <View style={styles.grid}>
            {DIAMOND_PACKS.map((pack) => (
              <PackCard key={pack.id} pack={pack} onBuy={handleBuy}
                buying={buyingId === pack.id} disabled={buyingId !== null}
                cardWidth={cardWidth} btnColor={SECTION_THEME.diamonds.btn} />
            ))}
          </View>

          {/* Bundles — single column */}
          <SectionHeader title={t('shop.sections.bundles')} sectionKey="bundles" />
          <View style={styles.column}>
            {BUNDLE_PACKS.map((pack) => (
              <FullWidthCard key={pack.id} pack={pack} onBuy={handleBuy}
                buying={buyingId === pack.id} disabled={buyingId !== null}
                fullWidth={fullWidth} btnColor={SECTION_THEME.bundles.btn} />
            ))}
          </View>

          {/* Builder — single column */}
          <SectionHeader title={t('shop.sections.builder')} sectionKey="builder" />
          <View style={styles.column}>
            {BUILDER_PACKS.map((pack) => (
              <FullWidthCard key={pack.id} pack={pack} onBuy={handleBuy}
                buying={buyingId === pack.id} disabled={buyingId !== null}
                fullWidth={fullWidth} btnColor={SECTION_THEME.builder.btn} />
            ))}
          </View>

          {/* Materials — 2-column grid */}
          <SectionHeader title={t('shop.sections.materials')} sectionKey="materials" />
          <View style={styles.grid}>
            {MATERIAL_PACKS.map((pack) => (
              <PackCard key={pack.id} pack={pack} onBuy={handleBuy}
                buying={buyingId === pack.id} disabled={buyingId !== null}
                cardWidth={cardWidth} btnColor={SECTION_THEME.materials.btn} />
            ))}
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
  scrollContent: { paddingTop: 130, paddingBottom: 20 },
  grid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 12,
                   paddingHorizontal: 16, paddingBottom: 8 },
  column:        { flexDirection: 'column', gap: 12,
                   paddingHorizontal: 16, paddingBottom: 8 },
});

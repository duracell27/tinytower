import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, ImageBackground,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
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

// Small inline icon row showing reward types in a card
function RewardRow({ pack }: { pack: ShopPack }) {
  const items: { icon: ReturnType<typeof require>; count: number }[] = [];
  if (pack.rewards.gems)
    items.push({ icon: DIAMOND_ICON, count: pack.rewards.gems });
  if (pack.rewards.tools)
    Object.entries(pack.rewards.tools).forEach(([k, v]) => {
      if (v) items.push({ icon: TOOL_ICONS[k], count: v });
    });
  if (pack.rewards.tokens)
    Object.entries(pack.rewards.tokens).forEach(([k, v]) => {
      if (v) items.push({ icon: TOKEN_ICONS[k], count: v });
    });

  // Show first 5 items max to avoid overflow
  const visible = items.slice(0, 5);
  const more    = items.length - visible.length;

  return (
    <View style={rs.row}>
      {visible.map((it, i) => (
        <View key={i} style={rs.item}>
          <Image source={it.icon} style={rs.icon} contentFit="contain" />
          <Text style={rs.count}>+{it.count}</Text>
        </View>
      ))}
      {more > 0 && <Text style={rs.more}>+{more} more</Text>}
    </View>
  );
}
const rs = StyleSheet.create({
  row:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  item:  { flexDirection: 'row', alignItems: 'center', gap: 2 },
  icon:  { width: 16, height: 16 },
  count: { fontFamily: 'Fredoka_500Medium', fontSize: 13, color: '#3A2360' },
  more:  { fontFamily: 'Fredoka_500Medium', fontSize: 12, color: '#9A6FD0' },
});

// Individual pack card
function PackCard({ pack, onBuy, buying, disabled }: {
  pack: ShopPack;
  onBuy: (pack: ShopPack) => void;
  buying: boolean;   // this card is actively purchasing (show spinner)
  disabled: boolean; // any card is purchasing (disable all buttons)
}) {
  const { t } = useTranslation('tabs');
  const isMaterial = pack.section === 'materials';

  return (
    <View style={[pc.card, buying && pc.buying]}>
      {/* Badge */}
      {pack.badge && (
        <View style={[pc.badge, pack.badge === 'best' ? pc.badgeBest : pc.badgePop]}>
          <Text style={pc.badgeText}>
            {pack.badge === 'best' ? t('shop.badges.best') : t('shop.badges.popular')}
          </Text>
        </View>
      )}

      {/* Image */}
      <Image source={pack.image} style={isMaterial ? pc.imgMat : pc.img} contentFit="contain" />

      {/* Gem count for diamond packs */}
      {pack.section === 'diamonds' && pack.rewards.gems != null && (
        <View style={pc.gemCount}>
          <Image source={DIAMOND_ICON} style={pc.gemCountIcon} contentFit="contain" />
          <Text style={pc.gemCountText}>{pack.rewards.gems.toLocaleString()}</Text>
        </View>
      )}

      {/* Name */}
      <Text style={pc.name}>{pack.name}</Text>

      {/* Bonus label (diamonds only) */}
      {pack.bonusLabel && (
        <Text style={pc.bonus}>{pack.bonusLabel}</Text>
      )}

      {/* Reward row (non-diamond, non-material) */}
      {!isMaterial && pack.section !== 'diamonds' && <RewardRow pack={pack} />}

      {/* Material: "5 pcs" */}
      {isMaterial && (
        <Text style={pc.each5}>{t('shop.each5')}</Text>
      )}

      {/* Buy button */}
      <Pressable
        style={[pc.btn, disabled && pc.btnDisabled]}
        onPress={() => !disabled && onBuy(pack)}
        disabled={disabled}
      >
        {buying
          ? <ActivityIndicator color="#FFF" size="small" />
          : (
            <View style={pc.btnInner}>
              {isMaterial && <Image source={DIAMOND_ICON} style={pc.gemInBtn} contentFit="contain" />}
              <Text style={pc.btnText}>{pack.price}</Text>
            </View>
          )
        }
      </Pressable>
    </View>
  );
}
const pc = StyleSheet.create({
  card:       { width: 160, backgroundColor: 'rgba(255,255,255,0.82)', borderRadius: 18,
                padding: 12, alignItems: 'center', gap: 6, elevation: 3 },
  buying:     { opacity: 0.7 },
  badge:      { position: 'absolute', top: 8, right: 8, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  badgeBest:  { backgroundColor: '#F2A227' },
  badgePop:   { backgroundColor: '#3FA535' },
  badgeText:  { fontFamily: 'Fredoka_700Bold', fontSize: 10, color: '#FFF' },
  img:        { width: 80, height: 80 },
  imgMat:     { width: 56, height: 56 },
  name:       { fontFamily: 'Fredoka_700Bold', fontSize: 15, color: '#2D1A4E', textAlign: 'center' },
  bonus:      { fontFamily: 'Fredoka_500Medium', fontSize: 12, color: '#9A6FD0' },
  each5:      { fontFamily: 'Fredoka_500Medium', fontSize: 12, color: '#7055A0' },
  btn:        { backgroundColor: '#9A6FD0', borderRadius: 12, paddingHorizontal: 16,
                paddingVertical: 8, minWidth: 100, alignItems: 'center', marginTop: 4 },
  btnDisabled:{ backgroundColor: '#BBA0E0' },
  btnInner:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  gemInBtn:   { width: 14, height: 14 },
  btnText:    { fontFamily: 'Fredoka_700Bold', fontSize: 14, color: '#FFF' },
  gemCount:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  gemCountIcon: { width: 18, height: 18 },
  gemCountText: { fontFamily: 'Fredoka_700Bold', fontSize: 16, color: '#2D1A4E' },
});

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={sh.wrap}>
      <Text style={sh.text}>{title}</Text>
      <View style={sh.line} />
    </View>
  );
}
const sh = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12, marginTop: 8 },
  text: { fontFamily: 'Fredoka_700Bold', fontSize: 18, color: '#2D1A4E', marginRight: 10 },
  line: { flex: 1, height: 1, backgroundColor: 'rgba(154,111,208,0.3)' },
});

export default function ShopScreen() {
  const { t } = useTranslation('tabs');
  const balance     = useBalance();
  const playerLevel = useGameStore((s) => s.playerLevel);
  const playerXp    = useGameStore((s) => s.playerXp);
  const gems        = useGameStore((s) => s.gems);
  const player      = useAuthStore((s) => s.player);
  const shopPurchase = useGameStore((s) => s.shopPurchase);
  const playerName  = player?.playerName ?? t('profile.guestFallbackName');

  const [buyingId, setBuyingId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleBuy = (pack: ShopPack) => {
    if (buyingId) return;
    setBuyingId(pack.id);
    timerRef.current = setTimeout(() => {
      shopPurchase(pack);
      setBuyingId(null);
    }, 3000);
  };

  const sections = [
    { key: 'diamonds', label: t('shop.sections.diamonds'), packs: DIAMOND_PACKS },
    { key: 'bundles',  label: t('shop.sections.bundles'),  packs: BUNDLE_PACKS  },
    { key: 'builder',  label: t('shop.sections.builder'),  packs: BUILDER_PACKS },
    { key: 'materials',label: t('shop.sections.materials'),packs: MATERIAL_PACKS },
  ];

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('../../assets/img/backgroung/bg15.png')}
        style={styles.background}
        resizeMode="cover"
      >
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />

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
          {sections.map((sec) => (
            <View key={sec.key}>
              <SectionHeader title={sec.label} />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.row}
              >
                {sec.packs.map((pack) => (
                  <PackCard
                    key={pack.id}
                    pack={pack}
                    onBuy={handleBuy}
                    buying={buyingId === pack.id}
                    disabled={buyingId !== null}
                  />
                ))}
              </ScrollView>
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1 },
  background:    { flex: 1, backgroundColor: '#DCEFF6' },
  scroll:        { flex: 1 },
  scrollContent: { paddingTop: 130, paddingBottom: 20 },
  row:           { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingBottom: 8 },
});

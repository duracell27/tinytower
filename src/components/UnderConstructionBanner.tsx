import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { createMMKV } from 'react-native-mmkv';
import { shadeColor } from '../utils/color';
import { useGameStore } from '../stores/gameStore';

const uiStorage = createMMKV({ id: 'ui-prefs' });

const BANNER_COLOR = '#E67E22';
const BANNER_BG = shadeColor(BANNER_COLOR, 45);

const TOOL_NAMES: Record<string, string> = {
  briks: 'Bricks', glass: 'Glass', nails: 'Nails', screw: 'Screws',
};
const TOOL_IMAGES: Record<string, ReturnType<typeof require>> = {
  briks: require('../../assets/img/tools/briks.png'),
  glass: require('../../assets/img/tools/glass.png'),
  nails: require('../../assets/img/tools/nails.png'),
  screw: require('../../assets/img/tools/screw.png'),
};
const FLOOR_TYPE_NAMES: Record<string, string> = {
  green: 'Products', blue: 'Service', yellow: 'Rest', purple: 'Fashion', red: 'Electronics',
};
const FLOOR_TYPE_COLORS: Record<string, string> = {
  green: '#5E8F42', blue: '#2E6EC9', yellow: '#C78800', purple: '#9A6FD0', red: '#E05050',
};

interface UnderConstructionBannerProps {
  floorId: number;
  endsAt: number;
  now: number;
  requiredTools: { tool: string; count: number }[];
  selectedFloorType: string | null;
  onOpenPicker: () => void;
  onStartBusiness: () => void;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function UnderConstructionBanner({
  floorId,
  endsAt,
  now,
  requiredTools,
  selectedFloorType,
  onOpenPicker,
  onStartBusiness,
}: UnderConstructionBannerProps) {
  const tools = useGameStore((s) => s.tools);
  const gems = useGameStore((s) => s.gems);
  const speedUpConstruction = useGameStore((s) => s.speedUpConstruction);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => { setConfirming(false); }, [floorId]);

  const timeLeft = Math.max(0, endsAt - now);
  const isReady = timeLeft === 0;

  const MS_PER_HOUR = 3_600_000;
  const speedUpCost = Math.max(1, Math.ceil(timeLeft / MS_PER_HOUR));
  const canStart = requiredTools.every(({ tool, count }) => (tools?.[tool as keyof typeof tools] ?? 0) >= count);

  const [collapsed, setCollapsed] = useState<boolean>(
    () => uiStorage.getBoolean(`uc-collapsed-${floorId}`) ?? false,
  );
  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    uiStorage.set(`uc-collapsed-${floorId}`, next);
  };

  // State: type selected — full card layout
  if (isReady && selectedFloorType) {
    const typeColor = FLOOR_TYPE_COLORS[selectedFloorType] ?? '#888';
    const typeName = FLOOR_TYPE_NAMES[selectedFloorType] ?? selectedFloorType;

    const num = parseInt(typeColor.replace('#', ''), 16);
    const mix = 0.22;
    const r = Math.round(255 - (255 - (num >> 16)) * mix);
    const g = Math.round(255 - (255 - ((num >> 8) & 0xff)) * mix);
    const b = Math.round(255 - (255 - (num & 0xff)) * mix);
    const cardBg = `rgb(${r},${g},${b})`;

    // Collapsed: compact row
    if (collapsed) {
      return (
        <View style={[styles.collapsedRow, { borderColor: typeColor, backgroundColor: cardBg }]}>
          <Text style={styles.collapsedTitle} numberOfLines={1}>
            {'Floor '}
            <Text style={{ color: typeColor }}>{typeName}</Text>
            {' awaits opening'}
          </Text>
          <Pressable onPress={toggleCollapse} hitSlop={8}>
            <View style={[styles.chevronCircle, { backgroundColor: typeColor }]}>
              <View style={[styles.chevronShape, styles.chevronDown]} />
            </View>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={[styles.card, { borderColor: typeColor, backgroundColor: cardBg }]}>
        {/* Header row with collapse button */}
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { flex: 1 }]}>
            {'Floor '}
            <Text style={[styles.cardTitleType, { color: typeColor }]}>{typeName}</Text>
            {' awaits opening.'}
          </Text>
          <Pressable onPress={toggleCollapse} hitSlop={8}>
            <View style={[styles.chevronCircle, { backgroundColor: typeColor }]}>
              <View style={[styles.chevronShape, styles.chevronUp]} />
            </View>
          </Pressable>
        </View>
        <Text style={styles.cardHint}>
          Gather all required materials to open the business
        </Text>

        {/* Tools row — centred */}
        <View style={styles.toolsRow}>
          {requiredTools.map(({ tool, count }) => {
            const have = tools?.[tool as keyof typeof tools] ?? 0;
            const met = have >= count;
            return (
              <View key={tool} style={styles.toolCircleWrap}>
                <View style={[styles.toolCircle, { borderColor: met ? '#49AA38' : '#C8CDD6' }]}>
                  <Image
                    source={TOOL_IMAGES[tool] ?? TOOL_IMAGES.briks}
                    style={{ width: 28, height: 28 }}
                    contentFit="contain"
                  />
                </View>
                <Text style={[styles.toolCount, { color: met ? '#49AA38' : '#E05050' }]}>
                  {`${have}/${count}`}
                </Text>
                <Text style={styles.toolLabel}>{TOOL_NAMES[tool] ?? tool}</Text>
              </View>
            );
          })}
        </View>

        {/* Start button — full width below tools */}
        <Pressable
          onPress={canStart ? onStartBusiness : undefined}
          style={({ pressed }) => [
            styles.startBtn,
            !canStart && styles.startBtnDisabled,
            pressed && canStart && { opacity: 0.85 },
          ]}
        >
          <LinearGradient
            colors={canStart ? ['#72C24F', '#5BA63C'] : ['#B7BDC8', '#A2A9B6']}
            style={styles.startBtnGradient}
          >
            <Text style={styles.startBtnText}>Open business</Text>
          </LinearGradient>
          {canStart && <View style={styles.startBtnShadow} />}
        </Pressable>
      </View>
    );
  }

  // State: building (timer) or ready but no type selected yet
  return (
    <View style={[styles.ribbon, { borderColor: BANNER_COLOR, backgroundColor: BANNER_BG }]}>
      <View style={styles.ribbonLeft}>
        <Image
          source={require('../../assets/img/workers/builder.png')}
          style={{ width: 28, height: 28 }}
          contentFit="contain"
        />
        <Text style={[styles.ribbonTitle, { color: BANNER_COLOR }]} numberOfLines={1}>
          {`Building floor ${floorId}`}
        </Text>
      </View>

      <View style={styles.ribbonRight}>
        {!isReady ? (
          confirming ? (
            <View style={styles.confirmRow}>
              <Text style={styles.confirmLabel}>⚡ {speedUpCost}💎?</Text>
              <Pressable
                onPress={() => { speedUpConstruction(floorId); setConfirming(false); }}
                style={styles.confirmBtn}
                hitSlop={8}
              >
                <Text style={styles.confirmBtnText}>✓</Text>
              </Pressable>
              <Pressable onPress={() => setConfirming(false)} style={styles.cancelBtn} hitSlop={8}>
                <Text style={styles.cancelBtnText}>✗</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.timerRow}>
              <View style={styles.timerPill}>
                <Text style={[styles.timerText, { color: BANNER_COLOR }]}>
                  {formatCountdown(timeLeft)}
                </Text>
              </View>
              <Pressable
                onPress={() => setConfirming(true)}
                style={styles.speedUpBtn}
                hitSlop={6}
              >
                <Text style={styles.speedUpIcon}>⚡</Text>
                <Image
                  source={require('../../assets/img/diamond.png')}
                  style={{ width: 13, height: 13 }}
                  contentFit="contain"
                />
                <Text style={styles.speedUpCost}>{speedUpCost}</Text>
              </Pressable>
            </View>
          )
        ) : (
          <>
            <Pressable
              onPress={onOpenPicker}
              style={({ pressed }) => [styles.openBtn, pressed && { opacity: 0.85 }]}
            >
              <LinearGradient colors={['#E67E22', '#C96A14']} style={styles.openBtnGradient}>
                <Text style={styles.openBtnText}>Choose business</Text>
              </LinearGradient>
              <View style={styles.openBtnShadow} />
            </Pressable>
            <Pressable onPress={toggleCollapse} hitSlop={8}>
              <View style={[styles.chevronCircle, { backgroundColor: BANNER_COLOR }]}>
                <View style={[styles.chevronShape, collapsed ? styles.chevronDown : styles.chevronUp]} />
              </View>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Collapsed row (type selected + collapsed) ───────────────────
  collapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  collapsedTitle: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 16,
    color: '#2A3344',
    flex: 1,
    flexShrink: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  chevronCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
    elevation: 2,
  },
  chevronShape: {
    width: 8,
    height: 8,
    borderTopWidth: 2.5,
    borderRightWidth: 2.5,
    borderColor: '#fff',
  },
  chevronUp: {
    transform: [{ rotate: '-45deg' }],
    marginTop: 3,
  },
  chevronDown: {
    transform: [{ rotate: '135deg' }],
    marginTop: -3,
  },

  // ── Card (type selected) ─────────────────────────────────────────
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 2,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  cardTitle: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 16,
    color: '#2A3344',
    lineHeight: 22,
  },
  cardTitleType: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 16,
  },
  cardHint: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 12,
    color: '#9BA3B0',
    lineHeight: 16,
  },
  toolsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  toolCircleWrap: {
    alignItems: 'center',
    gap: 4,
  },
  toolCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolCount: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 13,
  },
  toolLabel: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 11,
    color: '#9BA3B0',
  },
  startBtn: {
    borderRadius: 13,
    overflow: 'hidden',
    position: 'relative',
  },
  startBtnDisabled: { opacity: 0.65 },
  startBtnGradient: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 13,
    alignItems: 'center',
    zIndex: 1,
  },
  startBtnText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 15,
    color: '#fff',
  },
  startBtnShadow: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 3,
    backgroundColor: '#4A8A2E',
    borderBottomLeftRadius: 13,
    borderBottomRightRadius: 13,
  },

  // ── Ribbon (building / ready to pick) ───────────────────────────
  ribbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
    elevation: 3,
  },
  ribbonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    flex: 1,
  },
  ribbonRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  ribbonTitle: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    flexShrink: 1,
  },
  timerPill: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 11,
  },
  timerText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  speedUpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(37,146,171,0.15)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(37,146,171,0.35)',
  },
  speedUpIcon: {
    fontSize: 13,
  },
  speedUpCost: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 13,
    color: '#2592AB',
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  confirmLabel: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 13,
    color: BANNER_COLOR,
  },
  confirmBtn: {
    backgroundColor: '#49AA38',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  confirmBtnText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 13,
    color: '#fff',
  },
  cancelBtn: {
    backgroundColor: '#D9534F',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cancelBtnText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 13,
    color: '#fff',
  },
  openBtn: {
    borderRadius: 11,
    overflow: 'hidden',
    position: 'relative',
  },
  openBtnGradient: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 11,
    zIndex: 1,
  },
  openBtnText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 13,
    color: '#fff',
  },
  openBtnShadow: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 3,
    backgroundColor: '#A04000',
    borderBottomLeftRadius: 11,
    borderBottomRightRadius: 11,
  },
});

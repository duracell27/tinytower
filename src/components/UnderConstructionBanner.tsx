import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { shadeColor } from '../utils/color';
import { useGameStore } from '../stores/gameStore';

const BANNER_COLOR = '#E67E22';
const BANNER_BG = shadeColor(BANNER_COLOR, 45);

const TOOL_NAMES: Record<string, string> = {
  briks: 'Цегла', glass: 'Скло', nails: 'Цвяхи', screw: 'Гвинти',
};
const TOOL_IMAGES: Record<string, ReturnType<typeof require>> = {
  briks: require('../../assets/img/tools/briks.png'),
  glass: require('../../assets/img/tools/glass.png'),
  nails: require('../../assets/img/tools/nails.png'),
  screw: require('../../assets/img/tools/screw.png'),
};

interface UnderConstructionBannerProps {
  floorId: number;
  endsAt: number;
  now: number;
  requiredTool: string;
  requiredCount: number;
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
  requiredTool,
  requiredCount,
  selectedFloorType,
  onOpenPicker,
  onStartBusiness,
}: UnderConstructionBannerProps) {
  const tools = useGameStore((s) => s.tools);
  const timeLeft = Math.max(0, endsAt - now);
  const isReady = timeLeft === 0;
  const have = tools?.[requiredTool as keyof typeof tools] ?? 0;
  const canStart = have >= requiredCount;

  return (
    <View style={[styles.ribbon, { borderColor: BANNER_COLOR, backgroundColor: BANNER_BG }]}>
      <View style={styles.topRow}>
        <View style={styles.ribbonLeft}>
          <Image
            source={require('../../assets/img/workers/builder.png')}
            style={{ width: 28, height: 28 }}
            contentFit="contain"
          />
          <Text style={[styles.ribbonTitle, { color: BANNER_COLOR }]} numberOfLines={1}>
            {isReady ? `${floorId} поверх готовий!` : `Будується ${floorId} поверх`}
          </Text>
        </View>

        {!isReady && (
          <View style={styles.timerPill}>
            <Text style={[styles.timerText, { color: BANNER_COLOR }]}>
              {formatCountdown(timeLeft)}
            </Text>
          </View>
        )}

        {isReady && !selectedFloorType && (
          <Pressable
            onPress={onOpenPicker}
            style={({ pressed }) => [styles.openBtn, pressed && { opacity: 0.85 }]}
          >
            <LinearGradient colors={['#E67E22', '#C96A14']} style={styles.openBtnGradient}>
              <Text style={styles.openBtnText}>Вибрати бізнес</Text>
            </LinearGradient>
            <View style={styles.openBtnShadow} />
          </Pressable>
        )}
      </View>

      {isReady && selectedFloorType && (
        <View style={styles.toolRow}>
          <Image
            source={TOOL_IMAGES[requiredTool] ?? TOOL_IMAGES.briks}
            style={{ width: 26, height: 26 }}
            contentFit="contain"
          />
          <Text style={[styles.toolText, { color: canStart ? '#49AA38' : '#E05050' }]}>
            {`${requiredCount} ${TOOL_NAMES[requiredTool] ?? requiredTool}`}
          </Text>
          <Text style={styles.haveText}>{`На складі: ${have}`}</Text>

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
              <Text style={styles.startBtnText}>Запустити бізнес</Text>
            </LinearGradient>
            {canStart && <View style={styles.startBtnShadow} />}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ribbon: {
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
    gap: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 28,
  },
  ribbonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
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
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#A04000',
    borderBottomLeftRadius: 11,
    borderBottomRightRadius: 11,
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toolText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 14,
  },
  haveText: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 12,
    color: '#9BA3B0',
    flex: 1,
  },
  startBtn: {
    borderRadius: 11,
    overflow: 'hidden',
    position: 'relative',
  },
  startBtnDisabled: {
    opacity: 0.7,
  },
  startBtnGradient: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 11,
    zIndex: 1,
  },
  startBtnText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 12,
    color: '#fff',
  },
  startBtnShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#4A8A2E',
    borderBottomLeftRadius: 11,
    borderBottomRightRadius: 11,
  },
});

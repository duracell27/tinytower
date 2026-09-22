import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import LocaleText from './LocaleText';
import { Image } from 'expo-image';
import { GlassView } from 'expo-glass-effect';
import Svg, { Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { CoinIcon, GemIcon } from './CurrencyIcons';
import { getUserIcon } from '../utils/userIcon';
import { useAppTheme } from '../hooks/useAppTheme';
import { useCityStore } from '../stores/cityStore';

interface TopBarProps {
  name: string;
  level: number;
  xp: number;
  xpForNextLevel: number;
  coins: string;
  gems: string;
  revenuePerMin?: number;
  activeCoinBoost?: number;
  activeXpBoost?: number;
  coinBoostExpiresAt?: number;
  xpBoostExpiresAt?: number;
}

function boostTimeLabel(expiresAt: number | undefined, hoursLabel: string, lessThan1h: string): string {
  if (!expiresAt) return '';
  const msLeft = expiresAt - Date.now();
  if (msLeft <= 0) return '';
  const h = Math.floor(msLeft / (1000 * 60 * 60));
  return h >= 1 ? ` ${h}${hoursLabel}` : ` ${lessThan1h}`;
}

function ProgressRing({ progress, size = 50 }: { progress: number; size?: number }) {
  const strokeWidth = 3.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.min(progress, 1));

  return (
    <Svg width={size} height={size} style={styles.progressRing}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="rgba(60,120,40,0.14)"
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="#3FA535"
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={`${circumference}`}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

export default function TopBar({ name, level, xp, xpForNextLevel, coins, gems, revenuePerMin, activeCoinBoost, activeXpBoost, coinBoostExpiresAt, xpBoostExpiresAt }: TopBarProps) {
  const progress = xpForNextLevel > 0 ? xp / xpForNextLevel : 0;
  const theme = useAppTheme();
  const { t } = useTranslation('tabs');
  const cityLevel = useCityStore((s) => s.city?.level ?? 0);

  const panelContent = (
    <>
      <View style={styles.content}>
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrapper}>
            <ProgressRing progress={progress} size={50} />
            <Image
              source={getUserIcon(level)}
              style={[styles.avatarInner, { borderColor: theme.surface }]}
              contentFit="cover"
            />
            <View style={styles.levelBadge}>
              <LocaleText style={styles.levelText}>{level}</LocaleText>
            </View>
          </View>
          <View style={styles.nameColumn}>
            <LocaleText style={[styles.nameText, { color: theme.text }]}>{name}</LocaleText>
            {revenuePerMin !== undefined && (
              <View style={[styles.revenuePill, theme.isDark && { backgroundColor: theme.surfaceElevated }]}>
                <CoinIcon size={12} />
                <LocaleText style={styles.revenuePillText}>{revenuePerMin} {t('topBar.perMin')}</LocaleText>
              </View>
            )}
            {((activeCoinBoost ?? 0) + cityLevel > 0 || (activeXpBoost ?? 0) + cityLevel > 0) && (
              <View style={styles.boostRow}>
                {(activeCoinBoost ?? 0) + cityLevel > 0 && (
                  <View style={[styles.boostPill, theme.isDark && { backgroundColor: 'rgba(212,134,10,0.55)' }]}>
                    <Image source={require('../../assets/img/MarketingIcon.png')} style={styles.boostIcon} contentFit="contain" />
                    <LocaleText style={[styles.boostCoinText, theme.isDark && { color: '#fff' }]}>+{(activeCoinBoost ?? 0) + cityLevel}%{boostTimeLabel(coinBoostExpiresAt, t('topBar.hours'), t('topBar.lessThan1h'))}</LocaleText>
                  </View>
                )}
                {(activeXpBoost ?? 0) + cityLevel > 0 && (
                  <View style={[styles.boostPill, theme.isDark && { backgroundColor: 'rgba(112,64,184,0.55)' }]}>
                    <Image source={require('../../assets/img/PRIcon.png')} style={styles.boostIcon} contentFit="contain" />
                    <LocaleText style={[styles.boostXpText, theme.isDark && { color: '#fff' }]}>+{(activeXpBoost ?? 0) + cityLevel}%{boostTimeLabel(xpBoostExpiresAt, t('topBar.hours'), t('topBar.lessThan1h'))}</LocaleText>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        <View style={styles.currencySection}>
          <View style={[styles.coinBadge, theme.isDark && { backgroundColor: theme.surfaceElevated }]}>
            <CoinIcon size={18} />
            <LocaleText style={styles.coinText}>{coins}</LocaleText>
          </View>
          <Pressable style={[styles.gemBadge, theme.isDark && { backgroundColor: theme.surfaceElevated }]}>
            <GemIcon size={14} />
            <LocaleText style={styles.gemText}>{gems}</LocaleText>
          </Pressable>
        </View>
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      {Platform.OS === 'android' ? (
        <View style={[styles.glassPanel, styles.androidPanel, { backgroundColor: theme.topBarBg, borderColor: theme.topBarBorder }]}>
          {panelContent}
        </View>
      ) : (
        <GlassView glassEffectStyle="regular" style={[styles.glassPanel, { backgroundColor: theme.topBarBg, borderColor: theme.topBarBorder }]}>
          {panelContent}
        </GlassView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 54,
    left: 14,
    right: 14,
    zIndex: 40,
  },
  glassPanel: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(238,248,230,0.80)',
    shadowColor: 'rgba(40,70,35,1)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 8,
  },
  androidPanel: {
    backgroundColor: 'rgba(220,237,210,0.92)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    paddingHorizontal: 12,
    zIndex: 2,
  },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  avatarWrapper: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRing: {
    position: 'absolute',
  },
  avatarInner: {
    width: 39,
    height: 39,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
    overflow: 'hidden',
  },
  levelBadge: {
    position: 'absolute',
    bottom: -3,
    alignSelf: 'center',
    backgroundColor: '#3FA535',
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 7,
    shadowColor: 'rgba(40,110,30,1)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 3,
  },
  levelText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 12,
    color: '#fff',
  },
  nameText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 17,
    color: '#27331F',
    lineHeight: 23,
  },
  nameColumn: {
    flexDirection: 'column',
    gap: 3,
  },
  revenuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    paddingVertical: 2,
    paddingLeft: 5,
    paddingRight: 7,
    borderRadius: 10,
    shadowColor: 'rgba(120,110,60,1)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  revenuePillText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 12,
    color: '#C28A22',
  },
  currencySection: {
    flexDirection: 'column',
    gap: 6,
    alignItems: 'flex-end',
  },
  coinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingVertical: 4,
    paddingLeft: 5,
    paddingRight: 9,
    borderRadius: 13,
    shadowColor: 'rgba(120,110,60,1)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.16,
    shadowRadius: 3,
    elevation: 2,
  },
  coinText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    color: '#C28A22',
  },
  gemBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingVertical: 4,
    paddingLeft: 6,
    paddingRight: 9,
    borderRadius: 13,
    shadowColor: 'rgba(60,120,140,1)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.16,
    shadowRadius: 3,
    elevation: 2,
  },
  gemText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    color: '#2592AB',
  },
  boostRow: {
    flexDirection: 'row',
    gap: 4,
  },
  boostPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    paddingVertical: 2,
    paddingLeft: 5,
    paddingRight: 7,
    borderRadius: 10,
    shadowColor: 'rgba(120,110,60,1)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  boostPillCoin: {},
  boostPillXp: {},
  boostIcon: {
    width: 13,
    height: 13,
  },
  boostCoinText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 12,
    color: '#C28A22',
  },
  boostXpText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 12,
    color: '#7B4FBF',
  },
});

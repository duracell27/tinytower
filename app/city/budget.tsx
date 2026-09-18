import React, { useEffect, useState, useCallback } from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, useColorScheme,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import LocaleText from '../../src/components/LocaleText';
import AppBackground from '../../src/components/AppBackground';
import { useAppTheme } from '../../src/hooks/useAppTheme';
import { useCityStore } from '../../src/stores/cityStore';
import { useGameStore, useBalance } from '../../src/stores/gameStore';
import { useGameClock } from '../../src/hooks/useGameClock';
import { formatNum } from '../../src/utils/format';
import type { DonateBudgetPayload } from '../../src/services/api';

const PRIMARY     = '#2E6EC9';
const BANK_ICON   = require('../../assets/img/city/cityBank.png');
const COIN_ICON   = require('../../assets/img/coin.png');
const GEM_ICON    = require('../../assets/img/diamond.png');
const TOOL_ICONS: Record<string, any> = {
  briks:  require('../../assets/img/tools/briks.png'),
  glass:  require('../../assets/img/tools/glass.png'),
  nails:  require('../../assets/img/tools/nails.png'),
  screw:  require('../../assets/img/tools/screw.png'),
  wood:   require('../../assets/img/tools/wood.png'),
  cement: require('../../assets/img/tools/cement.png'),
};

const TOOL_KEYS   = ['briks', 'glass', 'nails', 'screw', 'wood', 'cement'] as const;
type ToolKey      = typeof TOOL_KEYS[number];
type ResourceKey  = 'coins' | 'gems' | ToolKey;

const ALL_RESOURCES: ResourceKey[] = ['coins', 'gems', ...TOOL_KEYS];

function resourceIcon(k: ResourceKey) {
  if (k === 'coins') return COIN_ICON;
  if (k === 'gems')  return GEM_ICON;
  return TOOL_ICONS[k];
}

function getCountdown(targetMs: number, nowMs: number) {
  const diff      = Math.max(0, targetMs - nowMs);
  const totalSecs = Math.floor(diff / 1000);
  const days      = Math.floor(totalSecs / 86400);
  const hours     = Math.floor((totalSecs % 86400) / 3600);
  const mins      = Math.floor((totalSecs % 3600) / 60);
  return { days, hours, mins };
}

export default function CityBudgetScreen() {
  const { id: cityId } = useLocalSearchParams<{ id: string }>();
  const { t }   = useTranslation('tabs');
  const theme   = useAppTheme();
  const isDark  = useColorScheme() === 'dark';
  const router  = useRouter();

  const { budget, budgetLoading, budgetError, fetchBudget, donate } = useCityStore();
  const balance = useBalance();
  const gems    = useGameStore((s) => s.gems);
  const tools   = useGameStore((s) => s.tools);
  const now     = useGameClock(60_000);

  const [selected, setSelected]   = useState<ResourceKey>('coins');
  const [amounts, setAmounts]     = useState<Record<ResourceKey, string>>(
    Object.fromEntries(ALL_RESOURCES.map((k) => [k, ''])) as Record<ResourceKey, string>
  );
  const [donating, setDonating]   = useState(false);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => { if (cityId) fetchBudget(cityId); }, [cityId]);

  const countdown = budget ? getCountdown(new Date(budget.weekResetAt).getTime(), now) : null;

  function playerBalance(k: ResourceKey): string {
    if (k === 'coins') return formatNum(balance);
    if (k === 'gems')  return String(budget?.myRemaining ?? 100);
    return String((tools as any)?.[k] ?? 0);
  }

  const parsedAmounts = Object.fromEntries(
    ALL_RESOURCES.map((k) => [k, parseInt(amounts[k], 10) || 0])
  ) as Record<ResourceKey, number>;

  const hasAmount = ALL_RESOURCES.some((k) => parsedAmounts[k] > 0);

  const handleDonate = useCallback(async () => {
    if (!cityId || !hasAmount) return;
    setError(null);
    setDonating(true);
    const toolEntries = TOOL_KEYS.filter((k) => parsedAmounts[k] > 0).map((k) => [k, parsedAmounts[k]]);
    const payload: DonateBudgetPayload = {
      ...(parsedAmounts.coins > 0 && { coins: parsedAmounts.coins }),
      ...(parsedAmounts.gems  > 0 && { gems: parsedAmounts.gems }),
      ...(toolEntries.length  > 0 && { tools: Object.fromEntries(toolEntries) }),
    };
    try {
      await donate(cityId, payload);
      setAmounts(Object.fromEntries(ALL_RESOURCES.map((k) => [k, ''])) as Record<ResourceKey, string>);
    } catch (e: any) {
      const msg = (e?.message ?? '').toLowerCase();
      if (msg.includes('gem') && msg.includes('limit'))
        setError(t('city.budget.errors.gemLimitExceeded'));
      else if (msg.includes('coins'))
        setError(t('city.budget.errors.notEnoughCoins'));
      else if (msg.includes('gems'))
        setError(t('city.budget.errors.notEnoughGems'));
      else if (msg.includes('tools'))
        setError(t('city.budget.errors.notEnoughTools'));
      else
        setError(t('city.budget.errors.donateFailed'));
    } finally {
      setDonating(false);
    }
  }, [cityId, parsedAmounts, hasAmount, donate, t]);

  const cardBg = isDark ? '#1A2E3E' : '#FFFFFF';

  return (
    <AppBackground style={[styles.bg, isDark && styles.bgDark]}>
      {/* ── Header ── */}
      <View style={[styles.header, { backgroundColor: cardBg }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <LocaleText style={[styles.backText, { color: PRIMARY }]}>‹</LocaleText>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Image source={BANK_ICON} style={styles.headerIcon} contentFit="contain" />
          <LocaleText style={[styles.headerTitle, { color: theme.text }]}>
            {t('city.budget.title')}
          </LocaleText>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {budgetLoading && !budget ? (
        <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 80 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {budgetError && (
            <View style={[styles.errorBanner, { backgroundColor: theme.surfaceDanger }]}>
              <LocaleText style={[styles.errorBannerText, { color: theme.text }]}>{budgetError}</LocaleText>
            </View>
          )}

          {/* ── Current Budget ── */}
          <LocaleText style={[styles.sectionLabel, { color: theme.textMuted }]}>
            {t('city.budget.currentBudget')}
          </LocaleText>

          {/* Coins */}
          <View style={[styles.card, { backgroundColor: cardBg }]}>
            <View style={styles.budgetRow}>
              <Image source={COIN_ICON} style={styles.budgetIcon} contentFit="contain" />
              <LocaleText style={[styles.budgetNum, { color: theme.text }]}>
                {formatNum(budget?.budgetCoins ?? 0)}
              </LocaleText>
              <LocaleText style={[styles.budgetUnit, { color: theme.textMuted }]}>
                {t('city.budget.coins')}
              </LocaleText>
            </View>
          </View>

          {/* Gems */}
          <View style={[styles.card, { backgroundColor: cardBg }]}>
            <View style={styles.budgetRow}>
              <Image source={GEM_ICON} style={styles.budgetIcon} contentFit="contain" />
              <LocaleText style={[styles.budgetNum, { color: theme.text }]}>
                {String(budget?.budgetGems ?? 0)}
              </LocaleText>
              <LocaleText style={[styles.budgetUnit, { color: theme.textMuted }]}>
                {t('city.budget.gems')}
              </LocaleText>
            </View>
          </View>

          {/* Tools — 3 columns */}
          <View style={[styles.card, { backgroundColor: cardBg }]}>
            <LocaleText style={[styles.cardLabel, { color: theme.textMuted }]}>
              {t('city.budget.tools')}
            </LocaleText>
            <View style={styles.toolsGrid}>
              {TOOL_KEYS.map((k) => {
                const budgetKey = `budget${k.charAt(0).toUpperCase() + k.slice(1)}` as keyof typeof budget;
                const val = budget ? (budget[budgetKey] as number ?? 0) : 0;
                return (
                  <View key={k} style={styles.toolCell}>
                    <Image source={TOOL_ICONS[k]} style={styles.toolIcon} contentFit="contain" />
                    <LocaleText style={[styles.toolVal, { color: theme.text }]}>{String(val)}</LocaleText>
                  </View>
                );
              })}
            </View>
          </View>

          {/* ── My Donation ── */}
          <LocaleText style={[styles.sectionLabel, { color: theme.textMuted }]}>
            {t('city.budget.myDonation')}
          </LocaleText>

          <View style={[styles.card, { backgroundColor: cardBg }]}>
            {/* Resource selector */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.selectorRow}
            >
              {ALL_RESOURCES.map((k) => {
                const active = selected === k;
                return (
                  <TouchableOpacity
                    key={k}
                    style={[
                      styles.selectorChip,
                      { borderColor: active ? PRIMARY : theme.divider },
                      active && { backgroundColor: PRIMARY + '18' },
                    ]}
                    onPress={() => setSelected(k)}
                    activeOpacity={0.7}
                  >
                    <Image source={resourceIcon(k)} style={styles.chipIcon} contentFit="contain" />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Single input for selected resource */}
            <View style={styles.inputArea}>
              <Image source={resourceIcon(selected)} style={styles.inputIcon} contentFit="contain" />
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.divider, backgroundColor: theme.surfaceSub }]}
                value={amounts[selected]}
                onChangeText={(v) => setAmounts((prev) => ({ ...prev, [selected]: v }))}
                placeholder="0"
                placeholderTextColor={theme.textMuted}
                keyboardType="numeric"
              />
              <LocaleText style={[styles.inputBalance, { color: theme.textMuted }]}>
                / {playerBalance(selected)}
              </LocaleText>
            </View>

            {error ? (
              <LocaleText style={styles.errorText}>{error}</LocaleText>
            ) : null}

            <TouchableOpacity
              style={[
                styles.donateBtn,
                { backgroundColor: hasAmount && !donating ? PRIMARY : theme.divider },
              ]}
              onPress={handleDonate}
              disabled={!hasAmount || donating}
              activeOpacity={0.8}
            >
              {donating
                ? <ActivityIndicator color="#FFFFFF" />
                : <LocaleText style={styles.donateBtnText}>{t('city.budget.donateButton')}</LocaleText>
              }
            </TouchableOpacity>
          </View>

          {/* ── Weekly Timer ── */}
          {countdown && (
            <View style={[styles.timerCard, { backgroundColor: cardBg }]}>
              <LocaleText style={[styles.timerLabel, { color: theme.textMuted }]}>
                {t('city.budget.resetIn')}:
              </LocaleText>
              <LocaleText style={[styles.timerValue, { color: theme.text }]}>
                {countdown.days}{t('city.budget.days')} {countdown.hours}{t('city.budget.hours')} {countdown.mins}{t('city.budget.minutes')}
              </LocaleText>
            </View>
          )}

          <View style={{ height: 80 }} />
        </ScrollView>
      )}
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  bg:     { flex: 1, backgroundColor: '#F0F8FF' },
  bgDark: { backgroundColor: '#0D1F2D' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  backBtn:      { width: 36, alignItems: 'center' },
  backText:     { fontSize: 28, lineHeight: 32, fontFamily: 'Fredoka_600SemiBold' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIcon:   { width: 28, height: 28 },
  headerTitle:  { fontFamily: 'Fredoka_700Bold', fontSize: 20 },

  scroll: { paddingHorizontal: 16, paddingTop: 12 },

  sectionLabel: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
    marginTop: 4,
  },

  card:      { borderRadius: 16, padding: 16, marginBottom: 10 },
  cardLabel: { fontFamily: 'Fredoka_500Medium', fontSize: 13, marginBottom: 10 },

  budgetRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  budgetIcon: { width: 30, height: 30 },
  budgetNum:  { fontFamily: 'Fredoka_700Bold', fontSize: 22, flex: 1 },
  budgetUnit: { fontFamily: 'Fredoka_400Regular', fontSize: 14 },

  toolsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toolCell:  {
    width: '30%',
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 4,
  },
  toolIcon:  { width: 28, height: 28 },
  toolVal:   { fontFamily: 'Fredoka_600SemiBold', fontSize: 14 },

  selectorRow: { gap: 8, paddingBottom: 12 },
  selectorChip: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipIcon: { width: 26, height: 26 },

  inputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  inputIcon: { width: 32, height: 32 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: 'Fredoka_500Medium',
    fontSize: 20,
  },
  inputBalance: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 13,
    minWidth: 50,
    textAlign: 'right',
  },

  errorBanner: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  errorBannerText: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 13,
    textAlign: 'center',
  },
  errorText: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 13,
    color: '#C03030',
    marginBottom: 10,
    textAlign: 'center',
  },

  donateBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  donateBtnText: { fontFamily: 'Fredoka_700Bold', fontSize: 16, color: '#FFFFFF' },

  timerCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timerLabel: { fontFamily: 'Fredoka_400Regular', fontSize: 13 },
  timerValue: { fontFamily: 'Fredoka_700Bold', fontSize: 17 },
});

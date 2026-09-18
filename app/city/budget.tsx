import React, { useEffect, useState, useCallback } from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import LocaleText from '../../src/components/LocaleText';
import { useAppTheme } from '../../src/hooks/useAppTheme';
import { useCityStore } from '../../src/stores/cityStore';
import { useGameStore, useBalance } from '../../src/stores/gameStore';
import { useGameClock } from '../../src/hooks/useGameClock';
import { formatNum } from '../../src/utils/format';
import type { DonateBudgetPayload } from '../../src/services/api';

const PRIMARY = '#2E6EC9';

const COIN_ICON   = require('../../assets/img/coin.png');
const GEM_ICON    = require('../../assets/img/diamond.png');
const BUDGET_ICON = require('../../assets/img/coin.png');
const TOOL_ICONS: Record<string, any> = {
  briks:  require('../../assets/img/tools/briks.png'),
  glass:  require('../../assets/img/tools/glass.png'),
  nails:  require('../../assets/img/tools/nails.png'),
  screw:  require('../../assets/img/tools/screw.png'),
  wood:   require('../../assets/img/tools/wood.png'),
  cement: require('../../assets/img/tools/cement.png'),
};

const TOOL_KEYS = ['briks', 'glass', 'nails', 'screw', 'wood', 'cement'] as const;
type ToolKey = typeof TOOL_KEYS[number];

function getCountdown(targetMs: number, nowMs: number) {
  const diff = Math.max(0, targetMs - nowMs);
  const totalSecs = Math.floor(diff / 1000);
  const days  = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins  = Math.floor((totalSecs % 3600) / 60);
  return { days, hours, mins };
}

export default function CityBudgetScreen() {
  const { id: cityId } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation('tabs');
  const theme = useAppTheme();
  const router = useRouter();

  const { budget, budgetLoading, budgetError, fetchBudget, donate } = useCityStore();
  const balance = useBalance();
  const gems    = useGameStore((s) => s.gems);
  const tools   = useGameStore((s) => s.tools);

  const now = useGameClock(60_000);

  const [coins,    setCoins]    = useState('');
  const [gemAmt,   setGemAmt]   = useState('');
  const [toolAmts, setToolAmts] = useState<Record<ToolKey, string>>({
    briks: '', glass: '', nails: '', screw: '', wood: '', cement: '',
  });
  const [donating, setDonating] = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    if (cityId) fetchBudget(cityId);
  }, [cityId]);

  const nextMonday = budget ? new Date(budget.weekResetAt) : null;
  const countdown  = nextMonday ? getCountdown(nextMonday.getTime(), now) : null;

  const coinsNum = parseInt(coins,  10) || 0;
  const gemNum   = parseInt(gemAmt, 10) || 0;
  const toolNums = Object.fromEntries(
    TOOL_KEYS.map((k) => [k, parseInt(toolAmts[k], 10) || 0]),
  ) as Record<ToolKey, number>;
  const hasAmount = coinsNum > 0 || gemNum > 0 || TOOL_KEYS.some((k) => toolNums[k] > 0);

  const handleDonate = useCallback(async () => {
    if (!cityId || !hasAmount) return;
    setError(null);
    setDonating(true);
    const payload: DonateBudgetPayload = {
      ...(coinsNum > 0 && { coins: coinsNum }),
      ...(gemNum   > 0 && { gems: gemNum }),
      ...(TOOL_KEYS.some((k) => toolNums[k] > 0) && {
        tools: Object.fromEntries(
          TOOL_KEYS.filter((k) => toolNums[k] > 0).map((k) => [k, toolNums[k]])
        ),
      }),
    };
    try {
      await donate(cityId, payload);
      setCoins('');
      setGemAmt('');
      setToolAmts({ briks: '', glass: '', nails: '', screw: '', wood: '', cement: '' });
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
  }, [cityId, coinsNum, gemNum, toolNums, hasAmount, donate, t]);

  const screenBg = theme.isDark ? '#0D1F2D' : '#DCEFF6';

  if (budgetLoading && !budget) {
    return (
      <View style={[styles.container, { backgroundColor: screenBg }]}>
        <View style={[styles.header, { backgroundColor: theme.surface }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <LocaleText style={[styles.backText, { color: PRIMARY }]}>‹</LocaleText>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Image source={BUDGET_ICON} style={styles.headerIcon} contentFit="contain" />
            <LocaleText style={[styles.headerTitle, { color: theme.text }]}>
              {t('city.budget.title')}
            </LocaleText>
          </View>
          <View style={{ width: 36 }} />
        </View>
        <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 100 }} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: screenBg }]}>
      {/* ── Header ── */}
      <View style={[styles.header, { backgroundColor: theme.surface }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <LocaleText style={[styles.backText, { color: PRIMARY }]}>‹</LocaleText>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Image source={BUDGET_ICON} style={styles.headerIcon} contentFit="contain" />
          <LocaleText style={[styles.headerTitle, { color: theme.text }]}>
            {t('city.budget.title')}
          </LocaleText>
        </View>
        <View style={{ width: 36 }} />
      </View>

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

        {/* ── Current Budget: Coins ── */}
        <LocaleText style={[styles.sectionTitle, { color: theme.textMuted }]}>
          {t('city.budget.currentBudget')}
        </LocaleText>

        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <View style={styles.budgetRow}>
            <Image source={COIN_ICON} style={styles.budgetIcon} contentFit="contain" />
            <LocaleText style={[styles.budgetBigNum, { color: theme.text }]}>
              {formatNum(budget?.budgetCoins ?? 0)}
            </LocaleText>
            <LocaleText style={[styles.budgetUnit, { color: theme.textMuted }]}>
              {t('city.budget.coins')}
            </LocaleText>
          </View>
        </View>

        {/* ── Current Budget: Diamonds ── */}
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <View style={styles.budgetRow}>
            <Image source={GEM_ICON} style={styles.budgetIcon} contentFit="contain" />
            <LocaleText style={[styles.budgetBigNum, { color: theme.text }]}>
              {String(budget?.budgetGems ?? 0)}
            </LocaleText>
            <LocaleText style={[styles.budgetUnit, { color: theme.textMuted }]}>
              {t('city.budget.gems')}
            </LocaleText>
          </View>
        </View>

        {/* ── Current Budget: Tools ── */}
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <LocaleText style={[styles.cardLabel, { color: theme.textMuted }]}>
            {t('city.budget.tools')}
          </LocaleText>
          <View style={styles.toolsGrid}>
            {TOOL_KEYS.map((k) => {
              const capKey  = k.charAt(0).toUpperCase() + k.slice(1);
              const budgetKey = `budget${capKey}` as keyof typeof budget;
              const val = budget ? (budget[budgetKey] as number ?? 0) : 0;
              return (
                <View key={k} style={styles.toolItem}>
                  <Image source={TOOL_ICONS[k]} style={styles.toolIconSm} contentFit="contain" />
                  <LocaleText style={[styles.toolVal, { color: theme.text }]}>{String(val)}</LocaleText>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── My Donation ── */}
        <LocaleText style={[styles.sectionTitle, { color: theme.textMuted }]}>
          {t('city.budget.myDonation')}
        </LocaleText>

        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          {/* Coins row */}
          <View style={styles.inputRow}>
            <Image source={COIN_ICON} style={styles.inputIcon} contentFit="contain" />
            <View style={styles.inputBody}>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.divider, backgroundColor: theme.surfaceSub }]}
                value={coins}
                onChangeText={setCoins}
                placeholder="0"
                placeholderTextColor={theme.textMuted}
                keyboardType="numeric"
              />
            </View>
            <LocaleText style={[styles.inputBalance, { color: theme.textMuted }]}>
              {formatNum(balance)}
            </LocaleText>
          </View>

          {/* Gems row */}
          <View style={styles.inputRow}>
            <Image source={GEM_ICON} style={styles.inputIcon} contentFit="contain" />
            <View style={styles.inputBody}>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.divider, backgroundColor: theme.surfaceSub }]}
                value={gemAmt}
                onChangeText={setGemAmt}
                placeholder="0"
                placeholderTextColor={theme.textMuted}
                keyboardType="numeric"
              />
            </View>
            <LocaleText style={[styles.inputBalance, { color: theme.textMuted }]}>
              {String(budget?.myRemaining ?? 100)}
            </LocaleText>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.divider }]} />

          {/* Tools grid inputs */}
          <View style={styles.toolInputsGrid}>
            {TOOL_KEYS.map((k) => (
              <View key={k} style={styles.toolInputCell}>
                <Image source={TOOL_ICONS[k]} style={styles.toolIconSm} contentFit="contain" />
                <TextInput
                  style={[styles.toolInput, { color: theme.text, borderColor: theme.divider, backgroundColor: theme.surfaceSub }]}
                  value={toolAmts[k]}
                  onChangeText={(v) => setToolAmts((prev) => ({ ...prev, [k]: v }))}
                  placeholder="0"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="numeric"
                />
                <LocaleText style={[styles.toolInputBalance, { color: theme.textMuted }]}>
                  {String((tools as any)?.[k] ?? 0)}
                </LocaleText>
              </View>
            ))}
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
          <View style={[styles.timerCard, { backgroundColor: theme.surface }]}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

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
  headerIcon:   { width: 26, height: 26 },
  headerTitle:  { fontFamily: 'Fredoka_700Bold', fontSize: 20 },

  scroll: { paddingHorizontal: 16, paddingTop: 12 },

  sectionTitle: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 4,
  },

  card:      { borderRadius: 16, padding: 16, marginBottom: 12 },
  cardLabel: { fontFamily: 'Fredoka_500Medium', fontSize: 13, marginBottom: 10 },

  budgetRow:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  budgetIcon:  { width: 32, height: 32 },
  budgetBigNum:{ fontFamily: 'Fredoka_700Bold', fontSize: 24, flex: 1 },
  budgetUnit:  { fontFamily: 'Fredoka_400Regular', fontSize: 14 },

  toolsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  toolItem:  { alignItems: 'center', gap: 4, minWidth: 44 },
  toolIconSm:{ width: 28, height: 28 },
  toolVal:   { fontFamily: 'Fredoka_600SemiBold', fontSize: 13 },

  inputRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  inputIcon:    { width: 28, height: 28 },
  inputBody:    { flex: 1 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: 'Fredoka_500Medium',
    fontSize: 16,
  },
  inputBalance: { fontFamily: 'Fredoka_400Regular', fontSize: 12, minWidth: 40, textAlign: 'right' },

  divider: { height: 1, marginVertical: 12 },

  toolInputsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  toolInputCell: { width: '30%', alignItems: 'center', gap: 4 },
  toolInput: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontFamily: 'Fredoka_500Medium',
    fontSize: 14,
    textAlign: 'center',
  },
  toolInputBalance: { fontFamily: 'Fredoka_400Regular', fontSize: 10 },

  errorBanner: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
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
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timerLabel: { fontFamily: 'Fredoka_400Regular', fontSize: 13 },
  timerValue: { fontFamily: 'Fredoka_700Bold', fontSize: 17 },
});

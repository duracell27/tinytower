import React, { useEffect, useState, useCallback } from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, useColorScheme,
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

const COIN_ICON = require('../../assets/img/coin.png');
const GEM_ICON  = require('../../assets/img/diamond.png');
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

function getMondayUTC(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

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
  const isDark = useColorScheme() === 'dark';
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

  const nextMonday = budget
    ? new Date(budget.weekResetAt)
    : null;
  const countdown = nextMonday ? getCountdown(nextMonday.getTime(), now) : null;

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

  const screenBg = isDark ? '#0D1F2D' : '#DCEFF6';

  if (budgetLoading && !budget) {
    return (
      <View style={[styles.container, { backgroundColor: screenBg }]}>
        <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 100 }} />
      </View>
    );
  }

  const weekLimit  = budget?.myWeekLimit  ?? 100;
  const remaining  = budget?.myRemaining  ?? 100;
  const gemDonated = weekLimit - remaining;
  const quotaPct   = weekLimit > 0 ? Math.min(gemDonated / weekLimit, 1) : 0;

  return (
    <View style={[styles.container, { backgroundColor: screenBg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <LocaleText style={[styles.backText, { color: PRIMARY }]}>‹</LocaleText>
        </TouchableOpacity>
        <LocaleText style={[styles.headerTitle, { color: theme.text }]}>
          {t('city.budget.title')}
        </LocaleText>
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

        {/* ── Current Budget ── */}
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <LocaleText style={[styles.cardTitle, { color: theme.text }]}>
            {t('city.budget.currentBudget')}
          </LocaleText>

          <View style={styles.budgetRow}>
            <BudgetItem icon={COIN_ICON} value={formatNum(budget?.budgetCoins ?? 0)} label={t('city.budget.coins')} theme={theme} />
            <BudgetItem icon={GEM_ICON}  value={String(budget?.budgetGems ?? 0)}     label={t('city.budget.gems')}  theme={theme} />
          </View>

          <LocaleText style={[styles.toolsLabel, { color: theme.textMuted }]}>
            {t('city.budget.tools')}
          </LocaleText>
          <View style={styles.toolsGrid}>
            {TOOL_KEYS.map((k) => {
              const capKey = (k.charAt(0).toUpperCase() + k.slice(1)) as string;
              const budgetKey = `budget${capKey}` as keyof typeof budget;
              const val = budget ? (budget[budgetKey] as number ?? 0) : 0;
              return (
                <BudgetItem
                  key={k}
                  icon={TOOL_ICONS[k]}
                  value={String(val)}
                  label={k}
                  theme={theme}
                  small
                />
              );
            })}
          </View>
        </View>

        {/* ── Diamond Quota ── */}
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <LocaleText style={[styles.cardTitle, { color: theme.text }]}>
            {t('city.budget.weeklyQuota')}
          </LocaleText>
          <View style={styles.quotaRow}>
            <LocaleText style={[styles.quotaRemaining, { color: PRIMARY }]}>
              {remaining}
            </LocaleText>
            <LocaleText style={[styles.quotaOf, { color: theme.textMuted }]}>
              {' '}{t('city.budget.of')}{' '}{weekLimit}
            </LocaleText>
            <Image source={GEM_ICON} style={styles.gemIcon} contentFit="contain" />
          </View>
          <View style={[styles.quotaBarBg, { backgroundColor: theme.divider }]}>
            <View
              style={[
                styles.quotaBarFill,
                { width: `${Math.round(quotaPct * 100)}%` as any, backgroundColor: PRIMARY },
              ]}
            />
          </View>
          <LocaleText style={[styles.quotaSubtext, { color: theme.textMuted }]}>
            {t('city.budget.remaining')}: {remaining} {t('city.budget.gems')}
          </LocaleText>
        </View>

        {/* ── My Donation ── */}
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <LocaleText style={[styles.cardTitle, { color: theme.text }]}>
            {t('city.budget.myDonation')}
          </LocaleText>

          {/* Coins */}
          <DonateRow
            icon={COIN_ICON}
            label={t('city.budget.coins')}
            value={coins}
            onChangeText={setCoins}
            hint={`${t('city.budget.remaining')}: ${formatNum(balance)}`}
            theme={theme}
            isDark={isDark}
          />

          {/* Gems */}
          <DonateRow
            icon={GEM_ICON}
            label={t('city.budget.gems')}
            value={gemAmt}
            onChangeText={setGemAmt}
            hint={`${t('city.budget.remaining')}: ${remaining}`}
            theme={theme}
            isDark={isDark}
          />

          {/* Tools */}
          <LocaleText style={[styles.toolsLabel, { color: theme.textMuted, marginTop: 12 }]}>
            {t('city.budget.tools')}
          </LocaleText>
          {TOOL_KEYS.map((k) => (
            <DonateRow
              key={k}
              icon={TOOL_ICONS[k]}
              label={k}
              value={toolAmts[k]}
              onChangeText={(v) => setToolAmts((prev) => ({ ...prev, [k]: v }))}
              hint={`${t('city.budget.remaining')}: ${(tools as any)?.[k] ?? 0}`}
              theme={theme}
              isDark={isDark}
            />
          ))}

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

// ── Sub-components ─────────────────────────────────────────────────────────────

function BudgetItem({ icon, value, label, theme, small }: {
  icon: any;
  value: string;
  label: string;
  theme: ReturnType<typeof useAppTheme>;
  small?: boolean;
}) {
  return (
    <View style={[styles.budgetItem, small && styles.budgetItemSmall]}>
      <Image source={icon} style={small ? styles.budgetIconSm : styles.budgetIcon} contentFit="contain" />
      <LocaleText style={[styles.budgetValue, { color: theme.text }, small && styles.budgetValueSm]}>
        {value}
      </LocaleText>
      <LocaleText style={[styles.budgetLabel, { color: theme.textMuted }]}>{label}</LocaleText>
    </View>
  );
}

function DonateRow({ icon, label, value, onChangeText, hint, theme, isDark }: {
  icon: any;
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  hint: string;
  theme: ReturnType<typeof useAppTheme>;
  isDark: boolean;
}) {
  return (
    <View style={styles.donateRow}>
      <Image source={icon} style={styles.donateIcon} contentFit="contain" />
      <View style={styles.donateRowBody}>
        <LocaleText style={[styles.donateRowLabel, { color: theme.textMuted }]}>{label}</LocaleText>
        <TextInput
          style={[
            styles.donateInput,
            {
              color: theme.text,
              borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
            },
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder="0"
          placeholderTextColor={theme.textMuted}
          keyboardType="numeric"
        />
        <LocaleText style={[styles.donateHint, { color: theme.textMuted }]}>{hint}</LocaleText>
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

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
  backBtn:     { width: 36, alignItems: 'center' },
  backText:    { fontSize: 28, lineHeight: 32, fontFamily: 'Fredoka_600SemiBold' },
  headerTitle: { fontFamily: 'Fredoka_700Bold', fontSize: 20 },

  scroll: { paddingHorizontal: 16, paddingTop: 16 },

  card:      { borderRadius: 16, padding: 16, marginBottom: 14 },
  cardTitle: { fontFamily: 'Fredoka_700Bold', fontSize: 16, marginBottom: 14 },

  budgetRow:       { flexDirection: 'row', gap: 12, marginBottom: 12 },
  budgetItem:      { flex: 1, alignItems: 'center', gap: 4 },
  budgetItemSmall: { flex: 0, width: '30%' },
  budgetIcon:      { width: 32, height: 32 },
  budgetIconSm:    { width: 24, height: 24 },
  budgetValue:     { fontFamily: 'Fredoka_700Bold', fontSize: 18 },
  budgetValueSm:   { fontSize: 14 },
  budgetLabel:     { fontFamily: 'Fredoka_400Regular', fontSize: 11 },

  toolsLabel: { fontFamily: 'Fredoka_500Medium', fontSize: 13, marginBottom: 8 },
  toolsGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  quotaRow:       { flexDirection: 'row', alignItems: 'baseline', marginBottom: 10 },
  quotaRemaining: { fontFamily: 'Fredoka_700Bold', fontSize: 28 },
  quotaOf:        { fontFamily: 'Fredoka_400Regular', fontSize: 15 },
  gemIcon:        { width: 18, height: 18, marginLeft: 4 },
  quotaBarBg:     { height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  quotaBarFill:   { height: '100%', borderRadius: 4 },
  quotaSubtext:   { fontFamily: 'Fredoka_400Regular', fontSize: 12 },

  donateRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  donateIcon:     { width: 28, height: 28, marginTop: 18 },
  donateRowBody:  { flex: 1 },
  donateRowLabel: { fontFamily: 'Fredoka_400Regular', fontSize: 12, marginBottom: 4 },
  donateInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: 'Fredoka_500Medium',
    fontSize: 16,
  },
  donateHint: { fontFamily: 'Fredoka_400Regular', fontSize: 11, marginTop: 3 },

  errorBanner: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
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

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity, Modal, Pressable,
  ActivityIndicator, useColorScheme,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import LocaleText from '../../src/components/LocaleText';
import AppBackground from '../../src/components/AppBackground';
import { useAppTheme } from '../../src/hooks/useAppTheme';
import { useCityStore } from '../../src/stores/cityStore';
import { formatNum } from '../../src/utils/format';

const PRIMARY    = '#2E6EC9';
const COIN_COLOR = '#F5A623';
const GEM_COLOR  = '#2592AB';
const COIN_ICON   = require('../../assets/img/coin.png');
const GEM_ICON    = require('../../assets/img/diamond.png');
const TOOL_ICON   = require('../../assets/img/tools/briks.png');

const MATERIAL_ICONS: Record<string, ReturnType<typeof require>> = {
  briks:  require('../../assets/img/tools/briks.png'),
  glass:  require('../../assets/img/tools/glass.png'),
  nails:  require('../../assets/img/tools/nails.png'),
  screw:  require('../../assets/img/tools/screw.png'),
  wood:   require('../../assets/img/tools/wood.png'),
  cement: require('../../assets/img/tools/cement.png'),
};
const MATERIAL_KEYS = ['briks', 'glass', 'nails', 'screw', 'wood', 'cement'] as const;
const OK_ICON     = require('../../assets/img/OkIcon.png');
const CANCEL_ICON = require('../../assets/img/CancellIcon.png');
const CUP1_ICON   = require('../../assets/img/rating/1PlaceCup.png');
const CUP2_ICON   = require('../../assets/img/rating/2PlaceCup.png');
const CUP3_ICON   = require('../../assets/img/rating/3PlaceCup.png');

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];
const MEDAL_BG     = ['#FFF9E0', '#F4F4F4', '#FBF0E4'];
const MEDAL_BG_DRK = ['#3A3010', '#2A2A2A', '#2E1A0A'];

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const dd  = String(d.getDate()).padStart(2, '0');
  const mm  = String(d.getMonth() + 1).padStart(2, '0');
  const hh  = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}.${mm} ${hh}:${min}`;
}

export default function BudgetContribsScreen() {
  const { id: cityId } = useLocalSearchParams<{ id: string }>();
  const { t }    = useTranslation('tabs');
  const theme    = useAppTheme();
  const isDark   = useColorScheme() === 'dark';
  const router   = useRouter();
  const insets   = useSafeAreaInsets();

  const { budgetContribsData, budgetContribsLoading, fetchBudgetContribs, resetBudget, city } = useCityStore();
  const isMayor = city?.myRole === 'MAYOR';

  const [tab,          setTab]          = useState<'coins' | 'gems' | 'tools'>('coins');
  const [histPage,     setHistPage]     = useState(0);
  const [resetting,    setResetting]    = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resultPopup,  setResultPopup]  = useState<{ ok: boolean; message: string } | null>(null);

  const HIST_PAGE_SIZE = 10;

  useEffect(() => {
    if (cityId) fetchBudgetContribs(cityId);
  }, [cityId]);

  const handleReset = useCallback(async () => {
    if (!cityId) return;
    setConfirmReset(false);
    setResetting(true);
    try {
      await resetBudget(cityId);
      setResultPopup({ ok: true, message: t('city.budget.resetSuccess') });
    } catch {
      setResultPopup({ ok: false, message: t('city.budget.resetFailed') });
    } finally {
      setResetting(false);
    }
  }, [cityId, resetBudget, t]);

  const rawContribs = budgetContribsData?.contribs   ?? [];
  const history     = budgetContribsData?.history    ?? [];
  const lastResetAt = budgetContribsData?.lastResetAt ?? null;

  const contribs = [...rawContribs].sort((a, b) => {
    if (tab === 'coins') return b.coins      - a.coins;
    if (tab === 'gems')  return b.gems       - a.gems;
    return b.toolsTotal - a.toolsTotal;
  });

  return (
    <AppBackground style={[styles.bg, isDark && styles.bgDark]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.hero, { backgroundColor: isDark ? '#1A2E3E' : '#FFFFFF' }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <LocaleText style={[styles.backText, { color: isDark ? '#8AAFD4' : PRIMARY }]}>‹</LocaleText>
          </TouchableOpacity>
          <View style={styles.heroCenter}>
            <LocaleText style={[styles.heroTitle, { color: theme.text }]}>
              🏆 {t('city.budget.contribs')}
            </LocaleText>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {/* Last reset info */}
        <View style={[styles.lastResetRow, { backgroundColor: isDark ? '#1A2E3E' : '#FFFFFF' }]}>
          <LocaleText style={[styles.lastResetText, { color: theme.textMuted }]}>
            {lastResetAt
              ? `${t('city.budget.lastReset')}: ${fmtDate(lastResetAt)}`
              : t('city.budget.neverReset')
            }
          </LocaleText>
        </View>

        {/* Section: Top contributors */}
        <View style={[styles.sectionHeaderBlock, { backgroundColor: PRIMARY }]}>
          <LocaleText style={styles.sectionHeader}>{t('city.budget.contribs')}</LocaleText>
        </View>

        <View style={[styles.card, styles.cardNoTopRadius, { backgroundColor: isDark ? '#1A2E3E' : '#FFFFFF' }]}>
          {/* Tab bar */}
          <View style={[styles.tabBar, { backgroundColor: isDark ? '#0D1F2D' : '#F0F4FA' }]}>
            {([
              { key: 'coins', icon: COIN_ICON, color: COIN_COLOR },
              { key: 'gems',  icon: GEM_ICON,  color: GEM_COLOR },
              { key: 'tools', icon: TOOL_ICON, color: '#CD7F32' },
            ] as const).map(({ key: t2, icon, color }) => {
              const active = tab === t2;
              return (
                <TouchableOpacity
                  key={t2}
                  style={[styles.tabItem, active && { backgroundColor: isDark ? '#1A2E3E' : '#FFFFFF' }]}
                  onPress={() => setTab(t2)}
                  activeOpacity={0.7}
                >
                  <Image source={icon} style={styles.tabIcon} contentFit="contain" />
                  {active && <View style={[styles.tabActiveLine, { backgroundColor: color }]} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {budgetContribsLoading && !budgetContribsData ? (
            <ActivityIndicator color={PRIMARY} style={{ marginVertical: 32 }} />
          ) : contribs.length === 0 ? (
            <View style={styles.emptyWrap}>
              <LocaleText style={styles.emptyEmoji}>📭</LocaleText>
              <LocaleText style={[styles.emptyText, { color: theme.textMuted }]}>
                {t('city.budget.noContribs')}
              </LocaleText>
            </View>
          ) : (
            contribs.map((item, idx) => {
              const isTop3    = idx < 3;
              const bgColor   = isTop3
                ? (isDark ? MEDAL_BG_DRK[idx] : MEDAL_BG[idx])
                : (isDark ? '#0D1F2D' : '#F6F8FB');
              const rankColor = isTop3 ? MEDAL_COLORS[idx] : (theme.textMuted as string);
              const val       = tab === 'coins' ? item.coins : tab === 'gems' ? item.gems : item.toolsTotal;
              const valIcon   = tab === 'coins' ? COIN_ICON : tab === 'gems' ? GEM_ICON : TOOL_ICON;
              const valColor  = tab === 'coins' ? COIN_COLOR : tab === 'gems' ? GEM_COLOR : theme.textMuted as string;
              return (
                <View
                  key={item.playerId}
                  style={[
                    styles.row,
                    { backgroundColor: bgColor, borderColor: isTop3 ? MEDAL_COLORS[idx] + '40' : 'transparent' },
                  ]}
                >
                  <View style={[styles.rankBadge, { backgroundColor: rankColor + '22' }]}>
                    {idx === 0 ? (
                      <Image source={CUP1_ICON} style={styles.rankCupIcon} contentFit="contain" />
                    ) : idx === 1 ? (
                      <Image source={CUP2_ICON} style={styles.rankCupIcon} contentFit="contain" />
                    ) : idx === 2 ? (
                      <Image source={CUP3_ICON} style={styles.rankCupIcon} contentFit="contain" />
                    ) : (
                      <LocaleText style={[styles.rankText, { color: rankColor }]}>{String(idx + 1)}</LocaleText>
                    )}
                  </View>
                  <LocaleText style={[styles.playerName, { color: theme.text }]} numberOfLines={1}>
                    {item.playerName}
                  </LocaleText>
                  <View style={styles.statChip}>
                    <Image source={valIcon} style={styles.statIcon} contentFit="contain" />
                    <LocaleText style={[styles.statVal, { color: valColor }]}>
                      {tab === 'coins' ? formatNum(val) : String(val)}
                    </LocaleText>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Section: Donation history */}
        <View style={[styles.sectionHeaderBlock, { backgroundColor: PRIMARY }]}>
          <LocaleText style={styles.sectionHeader}>{t('city.budget.historyTitle')}</LocaleText>
        </View>

        <View style={[styles.card, styles.cardNoTopRadius, { backgroundColor: isDark ? '#1A2E3E' : '#FFFFFF' }]}>
          {history.length === 0 ? (
            <View style={styles.emptyWrap}>
              <LocaleText style={[styles.emptyText, { color: theme.textMuted }]}>
                {t('city.budget.noContribs')}
              </LocaleText>
            </View>
          ) : (
            <>
              {history.slice(histPage * HIST_PAGE_SIZE, (histPage + 1) * HIST_PAGE_SIZE).map((item, idx) => (
                <View
                  key={histPage * HIST_PAGE_SIZE + idx}
                  style={[styles.histRow, { borderBottomColor: theme.divider as string }]}
                >
                  <View style={styles.histLeft}>
                    <LocaleText style={[styles.histPlayer, { color: theme.text }]} numberOfLines={1}>
                      {item.playerName}
                    </LocaleText>
                    <LocaleText style={[styles.histTime, { color: theme.textMuted }]}>
                      {fmtDate(item.donatedAt)}
                    </LocaleText>
                  </View>
                  <View style={styles.histStats}>
                    {(item.coins ?? 0) > 0 && (
                      <View style={styles.histChip}>
                        <Image source={COIN_ICON} style={styles.histIcon} contentFit="contain" />
                        <LocaleText style={[styles.histVal, { color: COIN_COLOR }]}>
                          {formatNum(item.coins!)}
                        </LocaleText>
                      </View>
                    )}
                    {(item.gems ?? 0) > 0 && (
                      <View style={styles.histChip}>
                        <Image source={GEM_ICON} style={styles.histIcon} contentFit="contain" />
                        <LocaleText style={[styles.histVal, { color: GEM_COLOR }]}>
                          {String(item.gems)}
                        </LocaleText>
                      </View>
                    )}
                    {MATERIAL_KEYS.map((k) => (item[k] ?? 0) > 0 ? (
                      <View key={k} style={styles.histChip}>
                        <Image source={MATERIAL_ICONS[k]} style={styles.histIcon} contentFit="contain" />
                        <LocaleText style={[styles.histVal, { color: theme.textMuted as string }]}>
                          {String(item[k])}
                        </LocaleText>
                      </View>
                    ) : null)}
                  </View>
                </View>
              ))}

              {/* Pagination */}
              {history.length > HIST_PAGE_SIZE && (
                <View style={styles.pagRow}>
                  <TouchableOpacity
                    style={[styles.pagBtn, { backgroundColor: isDark ? '#0D1F2D' : '#F0F4FA' }, histPage === 0 && styles.pagBtnOff]}
                    onPress={() => setHistPage(p => Math.max(0, p - 1))}
                    disabled={histPage === 0}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.pagChevron, styles.pagChevronLeft, { borderColor: histPage === 0 ? (theme.textMuted as string) : PRIMARY }]} />
                  </TouchableOpacity>

                  <LocaleText style={[styles.pagLabel, { color: theme.textMuted }]}>
                    {histPage + 1} / {Math.ceil(history.length / HIST_PAGE_SIZE)}
                  </LocaleText>

                  <TouchableOpacity
                    style={[styles.pagBtn, { backgroundColor: isDark ? '#0D1F2D' : '#F0F4FA' }, (histPage + 1) * HIST_PAGE_SIZE >= history.length && styles.pagBtnOff]}
                    onPress={() => setHistPage(p => p + 1)}
                    disabled={(histPage + 1) * HIST_PAGE_SIZE >= history.length}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.pagChevron, styles.pagChevronRight, { borderColor: (histPage + 1) * HIST_PAGE_SIZE >= history.length ? (theme.textMuted as string) : PRIMARY }]} />
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>

        {/* Mayor reset button */}
        {isMayor && (
          <TouchableOpacity
            style={[
              styles.resetBtn,
              { backgroundColor: isDark ? '#2A1010' : '#FCE8E8' },
              resetting && styles.resetBtnOff,
            ]}
            onPress={() => setConfirmReset(true)}
            disabled={resetting}
            activeOpacity={0.7}
          >
            {resetting
              ? <ActivityIndicator color="#C03030" />
              : <LocaleText style={styles.resetBtnText}>{t('city.budget.resetBudget')}</LocaleText>
            }
          </TouchableOpacity>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Confirm reset modal */}
      <Modal visible={confirmReset} transparent animationType="fade" onRequestClose={() => setConfirmReset(false)}>
        <Pressable style={styles.overlay} onPress={() => setConfirmReset(false)}>
          <Pressable style={[styles.popupCard, { backgroundColor: isDark ? '#1A2E3E' : '#FFFFFF' }]}>
            <LocaleText style={[styles.popupTitle, { color: theme.text }]}>
              {t('city.budget.resetBudget')}
            </LocaleText>
            <LocaleText style={[styles.popupBody, { color: theme.textMuted as string }]}>
              {t('city.budget.resetConfirm')}
            </LocaleText>
            <View style={styles.popupBtns}>
              <TouchableOpacity
                style={[styles.popupActionBtn, { backgroundColor: isDark ? '#0D1F2D' : '#F0F4FA' }]}
                onPress={() => setConfirmReset(false)}
                activeOpacity={0.7}
              >
                <LocaleText style={[styles.popupCancelText, { color: theme.textMuted as string }]}>
                  {t('common.cancel')}
                </LocaleText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.popupActionBtn, { backgroundColor: '#FCE8E8' }]}
                onPress={handleReset}
                activeOpacity={0.7}
              >
                <LocaleText style={styles.popupResetText}>{t('city.budget.resetBudget')}</LocaleText>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Result popup */}
      <Modal visible={!!resultPopup} transparent animationType="fade" onRequestClose={() => setResultPopup(null)}>
        <Pressable style={styles.overlay} onPress={() => setResultPopup(null)}>
          <Pressable style={[styles.popupCard, { backgroundColor: isDark ? '#1A2E3E' : '#FFFFFF' }]}>
            <Image
              source={resultPopup?.ok ? OK_ICON : CANCEL_ICON}
              style={styles.popupIcon}
              contentFit="contain"
            />
            <LocaleText style={[styles.popupBody, { color: theme.text }]}>
              {resultPopup?.message}
            </LocaleText>
            <TouchableOpacity
              style={[styles.popupOkBtn, { backgroundColor: PRIMARY }]}
              onPress={() => setResultPopup(null)}
              activeOpacity={0.8}
            >
              <LocaleText style={styles.popupOkText}>OK</LocaleText>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  bg:     { flex: 1, backgroundColor: '#EEF4FB' },
  bgDark: { backgroundColor: '#0D1520' },
  scroll: { paddingHorizontal: 0 },

  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 14,
    marginBottom: 10,
    marginHorizontal: 14,
  },
  backBtn:    { width: 36 },
  backText:   { fontSize: 28, lineHeight: 32, fontFamily: 'Fredoka_600SemiBold' },
  heroCenter: { flex: 1, alignItems: 'center' },
  heroTitle:  { fontFamily: 'Fredoka_700Bold', fontSize: 20 },

  lastResetRow: {
    marginHorizontal: 14,
    marginBottom: 4,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  lastResetText: { fontFamily: 'Fredoka_400Regular', fontSize: 12 },

  sectionHeaderBlock: {
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 0,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  sectionHeader: { fontFamily: 'Fredoka_700Bold', fontSize: 17, color: '#FFFFFF' },

  card: {
    borderRadius: 14,
    padding: 10,
    gap: 8,
    marginHorizontal: 14,
  },
  cardNoTopRadius: { borderTopLeftRadius: 0, borderTopRightRadius: 0 },

  emptyWrap:  { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyEmoji: { fontSize: 36 },
  emptyText:  { fontFamily: 'Fredoka_400Regular', fontSize: 14 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText:    { fontFamily: 'Fredoka_700Bold', fontSize: 16 },
  rankCupIcon: { width: 24, height: 24 },
  playerName: { flex: 1, fontFamily: 'Fredoka_600SemiBold', fontSize: 15 },
  statsCol:   { alignItems: 'flex-end', gap: 4 },
  statChip:   { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statIcon:   { width: 14, height: 14 },
  statVal:    { fontFamily: 'Fredoka_600SemiBold', fontSize: 13 },

  tabBar: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    gap: 2,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  tabIcon:       { width: 20, height: 20 },
  tabActiveLine: { height: 2, width: 20, borderRadius: 1 },

  histRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  histLeft:   { flex: 1 },
  histPlayer: { fontFamily: 'Fredoka_600SemiBold', fontSize: 13 },
  histTime:   { fontFamily: 'Fredoka_400Regular', fontSize: 11, marginTop: 2 },
  histStats:  { flexDirection: 'row', gap: 8, alignItems: 'center' },
  histChip:   { flexDirection: 'row', alignItems: 'center', gap: 3 },
  histIcon:   { width: 13, height: 13 },
  histVal:    { fontFamily: 'Fredoka_600SemiBold', fontSize: 12 },

  pagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingTop: 6,
  },
  pagBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pagBtnOff:       { opacity: 0.35 },
  pagLabel:        { fontFamily: 'Fredoka_500Medium', fontSize: 13, minWidth: 40, textAlign: 'center' },
  pagChevron:      { width: 9, height: 9, borderRightWidth: 2, borderBottomWidth: 2 },
  pagChevronLeft:  { transform: [{ rotate: '135deg' }] },
  pagChevronRight: { transform: [{ rotate: '-45deg' }] },

  resetBtn: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 16,
    marginHorizontal: 14,
  },
  resetBtnOff:  { opacity: 0.5 },
  resetBtnText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 14, color: '#C03030' },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupCard: {
    width: 280,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  popupTitle:     { fontFamily: 'Fredoka_700Bold', fontSize: 18 },
  popupBody:      { fontFamily: 'Fredoka_500Medium', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  popupIcon:      { width: 52, height: 52 },
  popupBtns:      { flexDirection: 'row', gap: 10, marginTop: 4, width: '100%' },
  popupActionBtn: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  popupCancelText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 14 },
  popupResetText:  { fontFamily: 'Fredoka_600SemiBold', fontSize: 14, color: '#C03030' },
  popupOkBtn:  { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 40, marginTop: 4 },
  popupOkText: { fontFamily: 'Fredoka_700Bold', fontSize: 15, color: '#FFFFFF' },
});

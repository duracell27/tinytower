import React, { useEffect, useState, useCallback } from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, TextInput, useColorScheme,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import LocaleText from '../../src/components/LocaleText';
import AppBackground from '../../src/components/AppBackground';
import { useAppTheme } from '../../src/hooks/useAppTheme';
import { useCityStore } from '../../src/stores/cityStore';
import { useCityNotifStore } from '../../src/stores/cityNotifStore';
import { getUserIcon } from '../../src/utils/userIcon';

const PRIMARY       = '#2E6EC9';
const NOTIF_ICON    = require('../../assets/img/city/cityNotice.png');
const SENDER_ROLES  = new Set(['MAYOR', 'ACTING_MAYOR', 'VICE_MAYOR']);

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const dd  = String(d.getDate()).padStart(2, '0');
  const mm  = String(d.getMonth() + 1).padStart(2, '0');
  const yy  = String(d.getFullYear()).slice(-2);
  const hh  = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${yy} ${hh}:${min}`;
}

export default function CityNotificationsScreen() {
  const { t } = useTranslation('tabs');
  const { id: cityId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const theme = useAppTheme();

  const myRole = useCityStore((s) => s.city?.myRole ?? null);
  const isLeader = !!myRole && SENDER_ROLES.has(myRole);

  const { notifications, notifLoading, notifError, sending, fetchNotifications, sendNotification } =
    useCityNotifStore();

  const [draft, setDraft] = useState('');
  const [sendErr, setSendErr] = useState<string | null>(null);

  const load = useCallback(() => {
    if (cityId) void fetchNotifications(cityId);
  }, [cityId, fetchNotifications]);

  useEffect(() => { load(); }, [load]);

  const handleSend = async () => {
    if (!cityId || !draft.trim()) return;
    setSendErr(null);
    try {
      await sendNotification(cityId, draft.trim());
      setDraft('');
    } catch {
      setSendErr(t('city.notifications.sendError'));
    }
  };

  return (
    <View style={styles.container}>
      <AppBackground style={[styles.bg, isDark && styles.bgDark]}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={[styles.hero, { backgroundColor: isDark ? '#1A2E3E' : '#FFFFFF' }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
              <LocaleText style={[styles.backText, { color: isDark ? '#8AAFD4' : PRIMARY }]}>‹</LocaleText>
            </TouchableOpacity>
            <View style={styles.heroCenter}>
              <Image source={NOTIF_ICON} style={styles.heroIcon} contentFit="contain" />
              <View style={styles.heroTextWrap}>
                <LocaleText style={[styles.heroTitle, { color: theme.text }]}>
                  {t('city.sections.notifications')}
                </LocaleText>
                <LocaleText style={[styles.heroSub, { color: theme.textMuted }]}>
                  {t('city.notifications.headerDesc')}
                </LocaleText>
              </View>
            </View>
            <View style={{ width: 36 }} />
          </View>

          {/* Send form — leaders only */}
          {isLeader && (
            <View style={[styles.sendCard, { backgroundColor: isDark ? '#1A2E3E' : '#FFFFFF' }]}>
              <TextInput
                style={[styles.input, isDark && styles.inputDark]}
                placeholder={t('city.notifications.sendPlaceholder')}
                placeholderTextColor={theme.textMuted}
                value={draft}
                onChangeText={(v) => setDraft(v.slice(0, 500))}
                multiline
                maxLength={500}
              />
              <View style={styles.sendRow}>
                <LocaleText style={[styles.charCount, { color: theme.textMuted }]}>
                  {t('city.notifications.charCount', { count: draft.length })}
                </LocaleText>
                <TouchableOpacity
                  onPress={handleSend}
                  disabled={sending || !draft.trim()}
                  activeOpacity={0.8}
                  style={[styles.sendBtn, { backgroundColor: isDark ? '#2E6EC9' : PRIMARY, opacity: (!draft.trim() || sending) ? 0.5 : 1 }]}
                >
                  <LocaleText style={styles.sendBtnText}>
                    {t('city.notifications.send')}
                  </LocaleText>
                </TouchableOpacity>
              </View>
              {sendErr && (
                <LocaleText style={[styles.sendErr, { color: '#D93025' }]}>{sendErr}</LocaleText>
              )}
            </View>
          )}

          {/* List */}
          {notifLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={isDark ? '#6BAED0' : PRIMARY} />
            </View>
          ) : notifError ? (
            <View style={styles.center}>
              <LocaleText style={[styles.emptyText, { color: theme.textMuted }]}>{notifError}</LocaleText>
            </View>
          ) : notifications.length === 0 ? (
            <View style={styles.center}>
              <LocaleText style={[styles.emptyText, { color: theme.textMuted }]}>
                {t('city.notifications.empty')}
              </LocaleText>
            </View>
          ) : (
            <View style={[styles.listCard, { backgroundColor: isDark ? '#1A2E3E' : '#FFFFFF' }]}>
              {notifications.map((notif, idx) => {
                const isLast = idx === notifications.length - 1;
                const accentColor = isDark ? '#4A8EE8' : PRIMARY;
                return (
                  <View
                    key={notif.id}
                    style={[
                      styles.notifRow,
                      !isLast && { borderBottomColor: theme.divider, borderBottomWidth: 1 },
                      !notif.isReadByMe && { borderLeftColor: accentColor, borderLeftWidth: 3 },
                    ]}
                  >
                    <LocaleText style={[styles.notifText, { color: theme.text }]}>
                      {notif.text}
                    </LocaleText>
                    <TouchableOpacity
                      style={styles.authorRow}
                      onPress={notif.authorId ? () => router.push(`/user-profile/${notif.authorId}`) : undefined}
                      activeOpacity={notif.authorId ? 0.7 : 1}
                    >
                      <Image
                        source={getUserIcon(notif.authorLevel)}
                        style={styles.avatar}
                        contentFit="cover"
                      />
                      <View style={styles.authorMeta}>
                        <LocaleText style={[styles.authorName, { color: accentColor }]}>
                          {notif.authorName}
                        </LocaleText>
                        <LocaleText style={[styles.notifDate, { color: theme.textMuted }]}>
                          {t(`city.roles.${notif.authorRole}`)} · {fmtDate(notif.createdAt)}
                        </LocaleText>
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </AppBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bg: { flex: 1, backgroundColor: '#DCEFF6' },
  bgDark: { backgroundColor: '#0D1F2D' },
  center: { paddingVertical: 48, alignItems: 'center', justifyContent: 'center', padding: 32 },
  scroll: { paddingHorizontal: 0 },

  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 10,
    marginHorizontal: 14,
  },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(46,110,201,0.15)', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 26, lineHeight: 26, fontFamily: 'Fredoka_700Bold', includeFontPadding: false },
  heroCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  heroIcon: { width: 36, height: 36 },
  heroTextWrap: { gap: 1 },
  heroTitle: { fontFamily: 'Fredoka_700Bold', fontSize: 20 },
  heroSub:   { fontFamily: 'Fredoka_400Regular', fontSize: 12 },

  sendCard: {
    borderRadius: 14,
    marginHorizontal: 14,
    marginBottom: 10,
    padding: 14,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#C8D8E8',
    backgroundColor: '#F4F8FC',
    borderRadius: 12,
    padding: 12,
    fontFamily: 'Geologica_500Medium',
    fontSize: 15,
    color: '#0A1C30',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  inputDark: { backgroundColor: '#243040', borderColor: '#2A4A60', color: '#DDE8D8' },
  sendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  charCount: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 12,
  },
  sendBtn: {
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 10,
  },
  sendBtnText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  sendErr: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 13,
    marginTop: 6,
  },

  listCard: {
    borderRadius: 14,
    overflow: 'hidden',
    marginHorizontal: 14,
    marginBottom: 14,
  },
  notifRow: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  authorMeta: { gap: 1 },
  authorName: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  notifDate: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 11,
  },
  notifText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
    lineHeight: 22,
  },
  emptyText: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 15,
    textAlign: 'center',
  },
});

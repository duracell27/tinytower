import React, { useRef, useState, useCallback } from 'react';
import {
  View, ScrollView, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, useColorScheme, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import LocaleText from '../../src/components/LocaleText';
import AppBackground from '../../src/components/AppBackground';
import { useAppTheme } from '../../src/hooks/useAppTheme';
import { useAuthStore } from '../../src/stores/authStore';
import { useCityChatStore } from '../../src/stores/cityChatStore';
import { getUserIcon } from '../../src/utils/userIcon';
import type { CityChatMessage } from '../../src/services/api';

const PRIMARY = '#2E6EC9';
const CHAT_ICON = require('../../assets/img/city/cityChat.png');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(iso: string, t: any): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 3600) return t('city.chat.timeAgo.minutes', { n: Math.max(1, Math.floor(diff / 60)) });
  if (diff < 86400) return t('city.chat.timeAgo.hours', { n: Math.floor(diff / 3600) });
  return t('city.chat.timeAgo.days', { n: Math.floor(diff / 86400) });
}

function splitHighlight(body: string, term: string): { text: string; highlight: boolean }[] {
  if (!term) return [{ text: body, highlight: false }];
  const idx = body.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) return [{ text: body, highlight: false }];
  return [
    { text: body.slice(0, idx), highlight: false },
    { text: body.slice(idx, idx + term.length), highlight: true },
    { text: body.slice(idx + term.length), highlight: false },
  ];
}

const MENTION_RE = /^@([^,]+), /;

// ─── Message Row ─────────────────────────────────────────────────────────────

function ChatMessageRow({
  msg, myName, onReply, t, theme, isDark,
}: {
  msg: CityChatMessage;
  myName: string;
  onReply: (name: string) => void;
  t: any;
  theme: any;
  isDark: boolean;
}) {
  const parts = myName ? splitHighlight(msg.body, `@${myName}`) : [{ text: msg.body, highlight: false }];

  return (
    <View style={styles.msgRow}>
      <View style={styles.msgMeta}>
        <View style={styles.msgLeft}>
          <Image source={getUserIcon(msg.playerLevel)} style={styles.avatar} contentFit="contain" />
          <LocaleText style={[styles.msgName, { color: theme.text }]}>{msg.playerName}</LocaleText>
          <LocaleText style={[styles.msgTime, { color: theme.textMuted }]}>
            {timeAgo(msg.createdAt, t)}
          </LocaleText>
        </View>
        <TouchableOpacity onPress={() => onReply(msg.playerName)} activeOpacity={0.7}>
          <LocaleText style={styles.replyBtn}>{t('city.chat.reply')}</LocaleText>
        </TouchableOpacity>
      </View>
      <LocaleText style={[styles.msgBody, { color: isDark ? '#DDE8D8' : '#1C2C1A' }]}>
        {parts.map((p, i) =>
          p.highlight ? (
            <LocaleText key={i} style={styles.mention}>{p.text}</LocaleText>
          ) : (
            <LocaleText key={i}>{p.text}</LocaleText>
          ),
        )}
      </LocaleText>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function CityChatScreen() {
  const { t } = useTranslation('tabs');
  const { id: cityId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const theme = useAppTheme();

  const myName = useAuthStore((s) => s.player?.playerName ?? '');

  const { messages, page, totalPages, isLoading, isSending, fetchPage, sendMessage, clearMention } =
    useCityChatStore();

  const [draft, setDraft] = useState('');
  const inputRef = useRef<TextInput>(null);

  useFocusEffect(
    useCallback(() => {
      if (!cityId) return;
      void fetchPage(cityId, 1);
      void clearMention(cityId);
    }, [cityId]),
  );

  const handleSend = async () => {
    const trimmed = draft.trim();
    if (!trimmed || isSending || !cityId) return;
    const match = MENTION_RE.exec(trimmed);
    const mentionedName = match?.[1];
    const mentionedPlayerId = mentionedName
      ? (messages.find((m) => m.playerName === mentionedName)?.playerId ?? undefined)
      : undefined;
    try {
      await sendMessage(cityId, trimmed, mentionedPlayerId ?? undefined, mentionedName);
      setDraft('');
    } catch {
      // draft preserved; error visible via store.error
    }
  };

  const handleReply = (name: string) => {
    setDraft(`@${name}, `);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // API returns DESC; reverse so oldest is at top
  const displayed = [...messages].reverse();

  return (
    <View style={styles.container}>
      <AppBackground style={[styles.bg, isDark && styles.bgDark]}>

        {/* ── Hero header ────────────────────────────────── */}
        <View style={{ paddingTop: insets.top + 8 }}>
          <View style={[styles.hero, { backgroundColor: isDark ? '#1A2E3E' : '#FFFFFF' }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
              <LocaleText style={[styles.backText, { color: isDark ? '#8AAFD4' : PRIMARY }]}>‹</LocaleText>
            </TouchableOpacity>
            <View style={styles.heroCenter}>
              <Image source={CHAT_ICON} style={styles.heroIcon} contentFit="contain" />
              <View style={styles.heroTextWrap}>
                <LocaleText style={[styles.heroTitle, { color: theme.text }]}>{t('city.chat.title')}</LocaleText>
                <LocaleText style={[styles.heroSub, { color: theme.textMuted }]}>{t('city.chat.headerDesc')}</LocaleText>
              </View>
            </View>
            <View style={{ width: 36 }} />
          </View>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          {/* ── Input bar ──────────────────────────────────── */}
          <View style={[styles.inputBar, { backgroundColor: theme.surface }]}>
            <TextInput
              ref={inputRef}
              style={[styles.input, isDark && styles.inputDark]}
              placeholder={t('city.chat.inputPlaceholder')}
              placeholderTextColor={theme.textMuted}
              value={draft}
              onChangeText={setDraft}
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={handleSend}
            />
            <View style={styles.inputActions}>
              <TouchableOpacity
                style={[styles.sendBtn, (!draft.trim() || isSending) && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={isSending || !draft.trim()}
                activeOpacity={0.75}
              >
                {isSending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <LocaleText style={styles.sendBtnText}>{t('city.chat.send')}</LocaleText>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => cityId && void fetchPage(cityId, page)}
                style={styles.refreshBtn}
                activeOpacity={0.7}
              >
                <LocaleText style={[styles.refreshIcon, { color: '#2E6EC9' }]}>↻</LocaleText>
                <LocaleText style={[styles.refreshLabel, { color: '#2E6EC9' }]}>{t('city.chat.refresh')}</LocaleText>
              </TouchableOpacity>
            </View>
          </View>

        {/* ── Messages ───────────────────────────────────── */}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.msgList}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.msgCard, { backgroundColor: isDark ? '#1A2E3E' : '#FFFFFF' }]}>
            {isLoading && displayed.length === 0 ? (
              <ActivityIndicator style={{ marginVertical: 40 }} color={isDark ? '#6BAED0' : '#2E6EC9'} />
            ) : displayed.length === 0 ? (
              <LocaleText style={[styles.empty, { color: theme.textMuted }]}>
                {t('city.chat.noMessages')}
              </LocaleText>
            ) : (
              displayed.map((msg, i) => (
                <React.Fragment key={msg.id}>
                  {i > 0 && <View style={styles.separator} />}
                  <ChatMessageRow
                    msg={msg} myName={myName} onReply={handleReply}
                    t={t} theme={theme} isDark={isDark}
                  />
                </React.Fragment>
              ))
            )}
          </View>

          {/* Pagination */}
          {totalPages > 1 && (
            <View style={styles.pagination}>
              <TouchableOpacity
                style={[styles.pageBtn, isDark && styles.pageBtnDark, page === 1 && styles.pageBtnOff]}
                onPress={() => cityId && void fetchPage(cityId, page - 1)}
                disabled={page === 1}
                activeOpacity={0.7}
              >
                <LocaleText style={[styles.pageBtnText, page === 1 && styles.pageBtnTextOff]}>◀</LocaleText>
              </TouchableOpacity>
              <LocaleText style={[styles.pageIndicator, { color: theme.textMuted }]}>
                {page} / {totalPages}
              </LocaleText>
              <TouchableOpacity
                style={[styles.pageBtn, isDark && styles.pageBtnDark, page === totalPages && styles.pageBtnOff]}
                onPress={() => cityId && void fetchPage(cityId, page + 1)}
                disabled={page === totalPages}
                activeOpacity={0.7}
              >
                <LocaleText style={[styles.pageBtnText, page === totalPages && styles.pageBtnTextOff]}>▶</LocaleText>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 16 }} />
        </ScrollView>
        </KeyboardAvoidingView>

      </AppBackground>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  bg:     { flex: 1, backgroundColor: '#EEF4FB' },
  bgDark: { backgroundColor: '#0D1520' },

  /* Header — identical to budget.tsx */
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 10,
    marginHorizontal: 14,
  },
  backBtn:      { width: 36 },
  backText:     { fontSize: 28, lineHeight: 32, fontFamily: 'Fredoka_600SemiBold' },
  heroCenter:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  heroIcon:     { width: 36, height: 36 },
  heroTextWrap: { gap: 1 },
  heroTitle:    { fontFamily: 'Fredoka_700Bold', fontSize: 20 },
  heroSub:      { fontFamily: 'Fredoka_400Regular', fontSize: 12 },

  inputBar: {
    borderRadius: 14,
    marginHorizontal: 14,
    marginBottom: 10,
    padding: 12,
    gap: 8,
  },
  input: {
    height: 42, borderRadius: 12, paddingHorizontal: 14,
    borderWidth: 1.5, borderColor: '#C8D8E8',
    backgroundColor: '#F4F8FC',
    fontFamily: 'Geologica_500Medium', fontSize: 15, color: '#0A1C30',
  },
  inputDark: { backgroundColor: '#243040', borderColor: '#2A4A60', color: '#DDE8D8' },
  inputActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sendBtn: {
    backgroundColor: '#2E6EC9', borderRadius: 10, paddingHorizontal: 20,
    height: 36, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 15, color: '#FFFFFF' },

  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  refreshIcon: { fontSize: 18, lineHeight: 20 },
  refreshLabel: { fontFamily: 'Fredoka_500Medium', fontSize: 13 },

  msgList: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 8 },
  msgCard: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  msgRow: { paddingVertical: 10, paddingHorizontal: 14 },
  msgMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  msgLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  avatar: { width: 22, height: 22, borderRadius: 11 },
  msgName: { fontFamily: 'Fredoka_600SemiBold', fontSize: 14, flexShrink: 1 },
  msgTime: { fontFamily: 'Fredoka_400Regular', fontSize: 12 },
  replyBtn: { fontFamily: 'Fredoka_500Medium', fontSize: 13, color: '#2E6EC9' },
  msgBody: { fontFamily: 'Fredoka_400Regular', fontSize: 14, lineHeight: 20, paddingLeft: 28 },
  mention: { color: '#2E6EC9', fontFamily: 'Fredoka_600SemiBold' },
  separator: { height: 1, backgroundColor: '#2E6EC9', opacity: 0.18 },
  empty: { textAlign: 'center', marginTop: 60, fontFamily: 'Fredoka_500Medium', fontSize: 15 },

  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginVertical: 12 },
  pageBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  pageBtnDark: { backgroundColor: '#1A2E3E' },
  pageBtnOff: { opacity: 0.35 },
  pageBtnText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 16, color: '#2E6EC9' },
  pageBtnTextOff: { color: '#8A9A80' },
  pageIndicator: { fontFamily: 'Fredoka_500Medium', fontSize: 14, minWidth: 50, textAlign: 'center' },
});

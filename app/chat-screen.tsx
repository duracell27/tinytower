import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TextInput, Pressable,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { useChatStore } from '../src/stores/chatStore';
import { useAuthStore } from '../src/stores/authStore';
import { useGameStore } from '../src/stores/gameStore';
import ChatMessage from '../src/components/ChatMessage';

type Channel = 'global' | 'country';

const regionToFlag = (code: string) =>
  code.toUpperCase().replace(/./g, (c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65));

export default function ChatScreen() {
  const router = useRouter();
  const { t } = useTranslation('tabs');
  const insets = useSafeAreaInsets();
  const { messages, isLoading, isSending, sendMessage, deleteMessage, startPolling, stopPolling } =
    useChatStore();
  const player = useAuthStore((s) => s.player);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const playerLevel = useGameStore((s) => s.playerLevel);

  const [inputText, setInputText] = useState('');
  const [channel, setChannel] = useState<Channel>('global');
  const [isFocused, setIsFocused] = useState(false);

  const countryCode = getLocales()[0]?.regionCode ?? null;
  const activeCountry = channel === 'country' ? (countryCode ?? undefined) : undefined;

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => {
        setIsFocused(false);
        stopPolling();
      };
    }, [stopPolling]),
  );

  useEffect(() => {
    if (isFocused) {
      startPolling(activeCountry);
    }
  }, [isFocused, channel]);

  const reversed = useMemo(() => [...messages].reverse(), [messages]);

  const handleSend = async () => {
    const body = inputText.trim();
    if (!body || isSending || !player) return;
    setInputText('');
    try {
      await sendMessage(body, player.playerName, playerLevel, activeCountry);
    } catch (e) {
      Alert.alert(t('chat.sendError'), (e as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMessage(id);
    } catch (e) {
      Alert.alert(t('chat.deleteError'), (e as Error).message);
    }
  };

  return (
    <View style={styles.container}>
      {/* White top area: safe area + header + tab pills */}
      <View style={[styles.topBar, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{t('chat.title')}</Text>
          <View style={styles.backBtn} />
        </View>

        <View style={styles.divider} />
        <View style={styles.pills}>
          <Pressable
            style={[styles.pill, channel === 'global' && styles.pillActive]}
            onPress={() => setChannel('global')}
          >
            <Text style={[styles.pillText, channel === 'global' && styles.pillTextActive]}>
              {t('chat.global')}
            </Text>
          </Pressable>
          {countryCode && (
            <Pressable
              style={[styles.pill, channel === 'country' && styles.pillActive]}
              onPress={() => setChannel('country')}
            >
              <Text style={[styles.pillText, channel === 'country' && styles.pillTextActive]}>
                {regionToFlag(countryCode)} {countryCode}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 100}
      >
        <FlatList
          data={reversed}
          keyExtractor={(m) => m.id}
          inverted
          renderItem={({ item }) => (
            <ChatMessage
              message={item}
              isOwn={item.playerId === player?.id}
              isAdmin={player?.isAdmin === true}
              onDelete={handleDelete}
            />
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            isLoading ? null : (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>{t('chat.empty')}</Text>
              </View>
            )
          }
        />

        {isAuthenticated ? (
          <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom + 8, 16) }]}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={(v) => setInputText(v.slice(0, 300))}
              placeholder={t('chat.placeholder')}
              placeholderTextColor="#aaa"
              multiline
              maxLength={300}
            />
            <Pressable
              style={[styles.sendBtn, (!inputText.trim() || isSending) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!inputText.trim() || isSending}
            >
              <Text style={styles.sendIcon}>➤</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.guestBanner, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <Text style={styles.guestText}>{t('chat.guestBanner')}</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7F0' },
  flex: { flex: 1 },
  topBar: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
    paddingBottom: 2,
  },
  divider: {
    height: 3,
    backgroundColor: '#3C9A34',
    marginHorizontal: 16,
    borderRadius: 2,
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { width: 36, alignItems: 'center' },
  backIcon: { fontSize: 32, color: '#3C9A34', lineHeight: 36 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 20,
    color: '#2A3344',
  },
  pills: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  pill: {
    height: 32,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#F4F7F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillActive: {
    backgroundColor: '#3C9A34',
  },
  pillText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    color: '#888',
    lineHeight: 18,
    includeFontPadding: false,
  },
  pillTextActive: { color: '#fff' },
  list: { paddingVertical: 12 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontFamily: 'Nunito_400Regular', color: '#aaa', fontSize: 15 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: '#F4F7F0',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: '#1a1a1a',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3C9A34',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#ccc' },
  sendIcon: { color: '#fff', fontSize: 16 },
  guestBanner: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
    alignItems: 'center',
  },
  guestText: { fontFamily: 'Nunito_600SemiBold', color: '#999', fontSize: 14 },
});

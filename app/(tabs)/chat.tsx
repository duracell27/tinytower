import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TextInput, Pressable,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../../src/stores/chatStore';
import { useAuthStore } from '../../src/stores/authStore';
import ChatMessage from '../../src/components/ChatMessage';

export default function ChatScreen() {
  const { t } = useTranslation('tabs');
  const { messages, isLoading, isSending, sendMessage, deleteMessage, startPolling, stopPolling } =
    useChatStore();
  const player = useAuthStore((s) => s.player);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [inputText, setInputText] = useState('');

  useFocusEffect(
    useCallback(() => {
      startPolling();
      return () => stopPolling();
    }, [startPolling, stopPolling]),
  );

  const handleSend = async () => {
    const body = inputText.trim();
    if (!body || isSending || !player) return;
    setInputText('');
    try {
      await sendMessage(body, player.playerName);
    } catch (e) {
      Alert.alert('', (e as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMessage(id);
    } catch (e) {
      Alert.alert('', (e as Error).message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        data={[...messages].reverse()}
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
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={(v) => setInputText(v.slice(0, 300))}
            placeholder={t('chat.placeholder')}
            placeholderTextColor="#aaa"
            multiline
            maxLength={300}
          />
          <Text style={styles.counter}>{inputText.length}/300</Text>
          <Pressable
            style={[styles.sendBtn, (!inputText.trim() || isSending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || isSending}
          >
            <Text style={styles.sendIcon}>➤</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.guestBanner}>
          <Text style={styles.guestText}>{t('chat.guestBanner')}</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7F0' },
  list: { paddingVertical: 12 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontFamily: 'Nunito_400Regular', color: '#aaa', fontSize: 15 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
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
  counter: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: '#aaa', alignSelf: 'flex-end', marginBottom: 8 },
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

import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TextInput, Pressable, Modal, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, Alert, Keyboard, useColorScheme,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { useChatStore } from '../src/stores/chatStore';
import { useAuthStore } from '../src/stores/authStore';
import { useGameStore } from '../src/stores/gameStore';
import ChatMessage from '../src/components/ChatMessage';
import ReportSheet from '../src/components/ReportSheet';
import GuestWall from '../src/components/GuestWall';
import type { ReportTargetType } from '../src/stores/reportStore';

type Channel = 'global' | 'country';
type SelectedMessage = { id: string; body: string; isOwn: boolean };

const regionToFlag = (code: string) =>
  code.toUpperCase().replace(/./g, (c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65));

function InfoSection({ emoji, title, text }: { emoji: string; title: string; text: string }) {
  const isDark = useColorScheme() === 'dark';
  return (
    <View style={[infoStyles.section, isDark && { borderBottomColor: 'rgba(255,255,255,0.08)' }]}>
      <Text style={infoStyles.sectionEmoji}>{emoji}</Text>
      <View style={infoStyles.sectionBody}>
        <Text style={[infoStyles.sectionTitle, isDark && { color: '#DDE8D8' }]}>{title}</Text>
        <Text style={[infoStyles.sectionText, isDark && { color: '#8A9A80' }]}>{text}</Text>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const router = useRouter();
  const { t } = useTranslation('tabs');
  const insets = useSafeAreaInsets();
  const { messages, isLoading, isSending, sendMessage, editMessage, deleteMessage, startPolling, stopPolling } =
    useChatStore();
  const player = useAuthStore((s) => s.player);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isTemporary = useAuthStore((s) => s.player?.isTemporary ?? false);
  const playerLevel = useGameStore((s) => s.playerLevel);
  const isAdmin = player?.isAdmin === true;

  const isDark = useColorScheme() === 'dark';
  const [inputText, setInputText] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [channel, setChannel] = useState<Channel>('global');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<SelectedMessage | null>(null);
  const [infoVisible, setInfoVisible] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: ReportTargetType; id: string } | null>(null);

  const countryCode = getLocales()[0]?.regionCode ?? null;
  const activeCountry = channel === 'country' ? (countryCode ?? undefined) : undefined;

  useFocusEffect(
    useCallback(() => {
      startPolling(activeCountry);
      return () => stopPolling();
    }, [activeCountry, startPolling, stopPolling]),
  );

  React.useEffect(() => {
    const showSub = Keyboard.addListener('keyboardWillShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardWillHide', () => setKeyboardVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const reversed = useMemo(() => [...messages].reverse(), [messages]);

  const handleSend = async () => {
    const body = inputText.trim();
    if (!body || isSending || !player) return;
    setInputText('');
    if (editingId) {
      const id = editingId;
      setEditingId(null);
      try {
        await editMessage(id, body, activeCountry);
      } catch (e) {
        Alert.alert(t('chat.editError'), (e as Error).message);
      }
    } else {
      try {
        await sendMessage(body, player.playerName, playerLevel, activeCountry);
      } catch (e) {
        Alert.alert(t('chat.sendError'), (e as Error).message);
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setInputText('');
  };

  const handleLongPress = (id: string, body: string, isOwn: boolean) => {
    setSelectedMessage({ id, body, isOwn });
  };

  const handleActionEdit = () => {
    if (!selectedMessage) return;
    setSelectedMessage(null);
    setEditingId(selectedMessage.id);
    setInputText(selectedMessage.body);
  };

  const handleActionReport = () => {
    if (!selectedMessage) return;
    const { id } = selectedMessage;
    setSelectedMessage(null);
    setReportTarget({ type: 'CHAT_MESSAGE', id });
  };

  const handleActionDelete = () => {
    if (!selectedMessage) return;
    const { id } = selectedMessage;
    setSelectedMessage(null);
    Alert.alert(t('chat.deleteConfirm'), t('chat.deleteConfirmBody'), [
      { text: t('chat.cancel'), style: 'cancel' },
      {
        text: t('chat.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMessage(id);
          } catch (e) {
            Alert.alert(t('chat.deleteError'), (e as Error).message);
          }
        },
      },
    ]);
  };

  const handleAvatarPress = useCallback((playerId: string) => {
    if (playerId === player?.id) {
      router.push('/(tabs)/profile');
    } else {
      router.push(`/user-profile/${playerId}`);
    }
  }, [player?.id, router]);

  if (!isAuthenticated || isTemporary) {
    return (
      <View style={[styles.container, isDark && { backgroundColor: '#1A1E24' }]}>
        <View style={[styles.topBar, { paddingTop: insets.top }, isDark && { backgroundColor: '#1E2028' }]}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.headerBtn} hitSlop={8}>
              <Text style={styles.backIcon}>‹</Text>
            </Pressable>
            <Text style={[styles.headerTitle, isDark && { color: '#DDE8D8' }]}>{t('chat.title')}</Text>
            <View style={styles.headerBtn} />
          </View>
        </View>
        <GuestWall message="Create a free account to read and write messages" />
      </View>
    );
  }

  return (
    <View style={[styles.container, isDark && { backgroundColor: '#1A1E24' }]}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top }, isDark && { backgroundColor: '#1E2028' }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerBtn} hitSlop={8}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          <Text style={[styles.headerTitle, isDark && { color: '#DDE8D8' }]}>{t('chat.title')}</Text>
          <Pressable onPress={() => setInfoVisible(true)} style={styles.headerBtn} hitSlop={8}>
            <Image
              source={require('../assets/img/InformationIcon.png')}
              style={styles.infoIconImg}
              contentFit="contain"
            />
          </Pressable>
        </View>

        <View style={styles.divider} />
        <View style={styles.pills}>
          <Pressable
            style={[styles.pill, channel === 'global' && styles.pillActive, isDark && channel !== 'global' && { backgroundColor: '#252A36' }]}
            onPress={() => setChannel('global')}
          >
            <Text style={[styles.pillText, channel === 'global' && styles.pillTextActive]}>
              {t('chat.global')}
            </Text>
          </Pressable>
          {countryCode && (
            <Pressable
              style={[styles.pill, channel === 'country' && styles.pillActive, isDark && channel !== 'country' && { backgroundColor: '#252A36' }]}
              onPress={() => setChannel('country')}
            >
              <Text style={[styles.pillText, channel === 'country' && styles.pillTextActive]}>
                {regionToFlag(countryCode)} {countryCode}
              </Text>
            </Pressable>
          )}
        </View>
        <View style={styles.divider} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
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
              canReport={item.playerId !== player?.id && isAuthenticated}
              onLongPress={handleLongPress}
              onAvatarPress={() => handleAvatarPress(item.playerId)}
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
          <View>
            {editingId && (
              <View style={[styles.editBanner, isDark && { backgroundColor: 'rgba(30,64,24,0.5)', borderTopColor: '#3C9A34' }]}>
                <Text style={styles.editBannerText}>{t('chat.editing')}</Text>
                <Pressable onPress={handleCancelEdit} hitSlop={8}>
                  <Text style={styles.editBannerCancel}>✕</Text>
                </Pressable>
              </View>
            )}
            <View style={[styles.inputBar, { paddingBottom: keyboardVisible ? 8 : Math.max(insets.bottom + 8, 16) }, isDark && { backgroundColor: '#1E2028', borderTopColor: 'rgba(255,255,255,0.08)' }]}>
              <TextInput
                style={[styles.input, isDark && { backgroundColor: '#2A2F38', color: '#DDE8D8' }]}
                value={inputText}
                onChangeText={(v) => setInputText(v.slice(0, 300))}
                placeholder={t('chat.placeholder')}
                placeholderTextColor={isDark ? '#4A5468' : '#aaa'}
                multiline
                maxLength={300}
              />
              {keyboardVisible && !inputText.trim() ? (
                <Pressable style={styles.sendBtn} onPress={() => Keyboard.dismiss()}>
                  <Text style={styles.sendIcon}>↓</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={[
                    styles.sendBtn,
                    editingId && styles.sendBtnEdit,
                    (!inputText.trim() || isSending) && styles.sendBtnDisabled,
                  ]}
                  onPress={handleSend}
                  disabled={!inputText.trim() || isSending}
                >
                  <Text style={styles.sendIcon}>{editingId ? '✓' : '➤'}</Text>
                </Pressable>
              )}
            </View>
          </View>
        ) : (
          <View style={[styles.guestBanner, { paddingBottom: Math.max(insets.bottom, 16) }, isDark && { backgroundColor: '#1E2028', borderTopColor: 'rgba(255,255,255,0.08)' }]}>
            <Text style={styles.guestText}>{t('chat.guestBanner')}</Text>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Info overlay — hotel-style, absolutely positioned inside the screen */}
      {infoVisible && (
        <View style={styles.infoScrim}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setInfoVisible(false)} />
          <View style={[styles.infoCard, isDark && { backgroundColor: '#2A2F38' }]}>
            <LinearGradient colors={isDark ? ['#1E4018', '#143010'] : ['#5E8F42', '#4D7836']} style={styles.infoCardHeader}>
              <Text style={styles.infoCardTitle}>{t('chat.infoTitle')}</Text>
              <Pressable onPress={() => setInfoVisible(false)} style={styles.infoCardClose} hitSlop={10}>
                <Text style={styles.infoCardCloseText}>✕</Text>
              </Pressable>
            </LinearGradient>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.infoCardBody}>
                <InfoSection emoji="🌍" title={t('chat.infoGlobalTitle')} text={t('chat.infoGlobal')} />
                <InfoSection emoji="🏳️" title={t('chat.infoCountryTitle')} text={t('chat.infoCountry')} />
                <InfoSection emoji="✏️" title={t('chat.infoEditTitle')} text={t('chat.infoEdit')} />
                <InfoSection emoji="⏱" title={t('chat.infoCooldownTitle')} text={t('chat.infoCooldown')} />
                <InfoSection emoji="⏳" title={t('chat.infoExpiryTitle')} text={t('chat.infoExpiry')} />
              </View>
            </ScrollView>
          </View>
        </View>
      )}

      {/* Action sheet modal on long press */}
      <Modal
        visible={!!selectedMessage}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMessage(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setSelectedMessage(null)}>
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }, isDark && { backgroundColor: '#2A2F38' }]}>
            {selectedMessage?.isOwn && (
              <Pressable style={styles.sheetItem} onPress={handleActionEdit}>
                <Image source={require('../assets/img/edit.png')} style={styles.sheetItemIcon} contentFit="contain" />
                <Text style={[styles.sheetItemText, isDark && { color: '#DDE8D8' }]}>{t('chat.actionEdit')}</Text>
              </Pressable>
            )}
            {!selectedMessage?.isOwn && isAuthenticated && (
              <Pressable style={styles.sheetItem} onPress={handleActionReport}>
                <Image source={require('../assets/img/warningIcon.png')} style={styles.sheetItemIcon} contentFit="contain" />
                <Text style={[styles.sheetItemText, isDark && { color: '#DDE8D8' }]}>{t('chat.actionReport')}</Text>
              </Pressable>
            )}
            {(selectedMessage?.isOwn || isAdmin) && (
              <Pressable style={styles.sheetItem} onPress={handleActionDelete}>
                <Image source={require('../assets/img/delete.png')} style={styles.sheetItemIcon} contentFit="contain" />
                <Text style={[styles.sheetItemText, styles.sheetItemDanger]}>{t('chat.actionDelete')}</Text>
              </Pressable>
            )}
            <View style={[styles.sheetDivider, isDark && { backgroundColor: 'rgba(255,255,255,0.08)' }]} />
            <Pressable style={styles.sheetItem} onPress={() => setSelectedMessage(null)}>
              <Text style={[styles.sheetItemText, styles.sheetItemCancel]}>{t('chat.cancel')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
      {reportTarget && (
        <ReportSheet
          visible={!!reportTarget}
          targetType={reportTarget.type}
          targetId={reportTarget.id}
          onClose={() => setReportTarget(null)}
          onSuccess={() => Alert.alert(t('report.success'))}
          onAlreadyReported={() => Alert.alert(t('report.alreadyReported'))}
        />
      )}
    </View>
  );
}

const infoStyles = StyleSheet.create({
  section: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(60,154,52,0.18)',
  },
  sectionEmoji: {
    fontSize: 22,
    lineHeight: 28,
    width: 28,
    textAlign: 'center',
  },
  sectionBody: {
    flex: 1,
    gap: 2,
  },
  sectionTitle: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    color: '#2A3344',
  },
  sectionText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 13,
    color: '#6A7485',
    lineHeight: 19,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7F0' },
  flex: { flex: 1 },
  topBar: { backgroundColor: '#fff' },
  divider: {
    height: 1,
    backgroundColor: '#3C9A34',
    opacity: 0.9,
    marginHorizontal: 16,
    borderRadius: 2,
    marginVertical: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBtn: { width: 36, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 32, color: '#3C9A34', lineHeight: 36 },
  infoIconImg: { width: 22, height: 22, opacity: 0.85 },
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
  pillActive: { backgroundColor: '#3C9A34' },
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
  sendBtnEdit: { backgroundColor: '#2A7A22' },
  sendBtnDisabled: { backgroundColor: '#ccc' },
  sendIcon: { color: '#fff', fontSize: 16 },
  editBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EAF5E9',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#3C9A34',
  },
  editBannerText: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 13,
    color: '#3C9A34',
  },
  editBannerCancel: {
    fontSize: 16,
    color: '#3C9A34',
    fontWeight: '600',
  },
  guestBanner: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
    alignItems: 'center',
  },
  guestText: { fontFamily: 'Nunito_600SemiBold', color: '#999', fontSize: 14 },

  // Info overlay (hotel-style)
  infoScrim: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(18,26,44,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  infoCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  infoCardTitle: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 17,
    color: '#fff',
    letterSpacing: 0.4,
  },
  infoCardClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCardCloseText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  infoCardBody: {
    padding: 18,
    paddingTop: 6,
  },

  // Action sheet
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  sheetItemIcon: { width: 24, height: 24 },
  sheetItemText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 17,
    color: '#2A3344',
  },
  sheetItemDanger: { color: '#E53935' },
  sheetItemCancel: {
    color: '#888',
    textAlign: 'center',
    flex: 1,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 8,
  },
});

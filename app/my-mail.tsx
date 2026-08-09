import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import AppBackground from '../src/components/AppBackground';
import { useAppTheme } from '../src/hooks/useAppTheme';
import { useMailStore } from '../src/stores/mailStore';
import type { MailMessage } from '../src/services/api';

function formatDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function MailRow({
  mail,
  onDelete,
  onMarkRead,
  theme,
}: {
  mail: MailMessage;
  onDelete: () => void;
  onMarkRead: () => void;
  theme: ReturnType<typeof useAppTheme>;
}) {
  const [expanded, setExpanded] = useState(false);

  const handlePress = () => {
    setExpanded((v) => !v);
    if (!mail.isRead) onMarkRead();
  };

  return (
    <Pressable
      style={({ pressed }) => [
        rowStyles.row,
        { borderBottomColor: theme.divider },
        pressed && { opacity: 0.8 },
      ]}
      onPress={handlePress}
    >
      {!mail.isRead && <View style={rowStyles.unreadDot} />}
      <View style={[rowStyles.content, mail.isRead && rowStyles.contentRead]}>
        <View style={rowStyles.header}>
          <Text style={[rowStyles.fromName, { color: theme.text }]} numberOfLines={1}>
            {mail.fromName}
          </Text>
          <Text style={[rowStyles.date, { color: theme.textMuted }]}>
            {formatDate(mail.createdAt)}
          </Text>
        </View>
        <Text
          style={[
            rowStyles.subject,
            {
              color: theme.text,
              fontFamily: mail.isRead ? 'Fredoka_400Regular' : 'Fredoka_600SemiBold',
            },
          ]}
          numberOfLines={expanded ? undefined : 1}
        >
          {mail.subject}
        </Text>
        {expanded && (
          <>
            <Text style={[rowStyles.body, { color: theme.text }]}>{mail.body}</Text>
            <Pressable
              onPress={onDelete}
              style={({ pressed }) => [rowStyles.deleteBtn, pressed && { opacity: 0.7 }]}
              hitSlop={6}
            >
              <Text style={rowStyles.deleteBtnText}>Delete</Text>
            </Pressable>
          </>
        )}
      </View>
    </Pressable>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3FA535',
    marginTop: 7,
    marginRight: 8,
    flexShrink: 0,
  },
  content: { flex: 1 },
  contentRead: { paddingLeft: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  fromName: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  date: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    flexShrink: 0,
  },
  subject: {
    fontSize: 13,
  },
  body: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    marginTop: 8,
    marginBottom: 10,
    lineHeight: 19,
  },
  deleteBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E05A4A',
  },
  deleteBtnText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 12,
    color: '#E05A4A',
  },
});

export default function MyMailScreen() {
  const theme = useAppTheme();
  const mails = useMailStore((s) => s.mails);
  const fetchInbox = useMailStore((s) => s.fetchInbox);
  const markRead = useMailStore((s) => s.markRead);
  const deleteMail = useMailStore((s) => s.deleteMail);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInbox().finally(() => setLoading(false));
  }, [fetchInbox]);

  return (
    <AppBackground style={{ flex: 1 }}>
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#3FA535" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingTop: 56, paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={[listStyles.card, { backgroundColor: theme.surface }]}>
            {mails.length === 0 ? (
              <Text style={[listStyles.emptyText, { color: theme.textMuted }]}>
                No messages yet
              </Text>
            ) : (
              mails.map((mail) => (
                <MailRow
                  key={mail.id}
                  mail={mail}
                  theme={theme}
                  onMarkRead={() => markRead(mail.id)}
                  onDelete={() => deleteMail(mail.id).catch(() => {})}
                />
              ))
            )}
          </View>
        </ScrollView>
      )}

      <View style={closeStyles.wrap} pointerEvents="box-none">
        <Pressable onPress={() => router.back()} style={closeStyles.btn} hitSlop={8}>
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path
              d="M18 6L6 18M6 6l12 12"
              stroke="#fff"
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          </Svg>
        </Pressable>
      </View>
    </AppBackground>
  );
}

const listStyles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: 'rgba(60,80,45,1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  emptyText: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 15,
    textAlign: 'center',
    padding: 30,
  },
});

const closeStyles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 36,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  btn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1A2030',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
});

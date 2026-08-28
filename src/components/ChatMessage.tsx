import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import type { ChatMessage as ChatMessageType } from '../stores/chatStore';
import { getUserIcon } from '../utils/userIcon';
import { useBlockStore } from '../stores/blockStore';
import { useAppTheme } from '../hooks/useAppTheme';

interface Props {
  message: ChatMessageType;
  isOwn: boolean;
  isAdmin: boolean;
  canReport?: boolean;
  onLongPress?: (id: string, body: string, isOwn: boolean) => void;
  onAvatarPress?: () => void;
}

function formatTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}

export default function ChatMessage({ message, isOwn, isAdmin, canReport, onLongPress, onAvatarPress }: Props) {
  const canInteract = isOwn || isAdmin || !!canReport;
  const theme = useAppTheme();
  const { isDark } = theme;
  const blocked = useBlockStore(s => s.isBlocked(message.playerId));

  return (
    <View style={styles.row}>
      <Pressable onPress={onAvatarPress} disabled={!onAvatarPress} hitSlop={6}>
        <Image
          source={getUserIcon(message.playerLevel)}
          style={[styles.avatar, isDark && { backgroundColor: '#3A3F4A' }, blocked && { borderColor: '#E05A4A', borderWidth: 2 }]}
          contentFit="cover"
        />
      </Pressable>
      <Pressable
        onLongPress={canInteract && onLongPress ? () => onLongPress(message.id, message.body, isOwn) : undefined}
        delayLongPress={350}
        style={[styles.bubble, isOwn ? styles.bubbleOwn : [styles.bubbleOther, isDark && { backgroundColor: theme.surface }]]}
      >
        <View style={styles.header}>
          <Text style={[styles.name, isOwn && styles.nameOwn]}>{message.playerName}</Text>
          <Text style={[styles.time, isOwn ? styles.timeOwn : { color: isDark ? '#5A6470' : '#aaa' }]}>{formatTime(message.createdAt)}</Text>
        </View>
        <Text style={[styles.body, isOwn ? styles.bodyOwn : { color: theme.text }]}>
          {blocked ? <Text style={styles.blockedText}>From blocked user</Text> : message.body}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 4,
    paddingHorizontal: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 8,
    marginTop: 2,
    backgroundColor: '#e8e8e8',
  },
  bubble: {
    flexShrink: 1,
    alignSelf: 'flex-start',
    maxWidth: '85%',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleOwn: {
    backgroundColor: '#3C9A34',
    borderBottomLeftRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  name: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
    color: '#3C9A34',
  },
  nameOwn: {
    color: 'rgba(255,255,255,0.9)',
  },
  time: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: '#aaa',
  },
  timeOwn: {
    color: 'rgba(255,255,255,0.6)',
  },
  body: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: '#1a1a1a',
  },
  bodyOwn: {
    color: '#fff',
  },
  blockedText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: '#aaa',
    fontStyle: 'italic',
  },
});

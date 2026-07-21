import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { ChatMessage as ChatMessageType } from '../stores/chatStore';

interface Props {
  message: ChatMessageType;
  isOwn: boolean;
  isAdmin: boolean;
  onDelete?: (id: string) => void;
}

function formatTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}

function avatarColor(name: string): string {
  const colors = ['#E57373', '#64B5F6', '#81C784', '#FFB74D', '#BA68C8', '#4DB6AC'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function ChatMessage({ message, isOwn, isAdmin, onDelete }: Props) {
  return (
    <View style={[styles.row, isOwn && styles.rowOwn]}>
      {!isOwn && (
        <View style={[styles.avatar, { backgroundColor: avatarColor(message.playerName) }]}>
          <Text style={styles.avatarText}>{message.playerName[0]?.toUpperCase()}</Text>
        </View>
      )}
      <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
        {!isOwn && (
          <Text style={styles.name}>{message.playerName}</Text>
        )}
        <Text style={[styles.body, isOwn && styles.bodyOwn]}>{message.body}</Text>
        <View style={styles.footer}>
          <Text style={[styles.time, isOwn && styles.timeOwn]}>{formatTime(message.createdAt)}</Text>
          {isAdmin && !isOwn && onDelete && (
            <Pressable onPress={() => onDelete(message.id)} style={styles.deleteBtn} hitSlop={8}>
              <Text style={styles.deleteIcon}>🗑</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 4,
    paddingHorizontal: 12,
  },
  rowOwn: {
    flexDirection: 'row-reverse',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  avatarText: {
    color: '#fff',
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
  },
  bubble: {
    maxWidth: '72%',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleOwn: {
    backgroundColor: '#3C9A34',
    borderBottomRightRadius: 4,
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
  name: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 12,
    color: '#3C9A34',
    marginBottom: 2,
  },
  body: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: '#1a1a1a',
  },
  bodyOwn: {
    color: '#fff',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 6,
  },
  time: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: '#999',
  },
  timeOwn: {
    color: 'rgba(255,255,255,0.7)',
  },
  deleteBtn: {
    padding: 2,
  },
  deleteIcon: {
    fontSize: 13,
  },
});

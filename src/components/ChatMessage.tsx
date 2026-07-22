import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import type { ChatMessage as ChatMessageType } from '../stores/chatStore';
import { getUserIcon } from '../utils/userIcon';

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

export default function ChatMessage({ message, isOwn, isAdmin, onDelete }: Props) {
  return (
    <View style={styles.row}>
      <Image
        source={getUserIcon(message.playerLevel)}
        style={styles.avatar}
        contentFit="cover"
      />
      <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
        <View style={styles.header}>
          <Text style={[styles.name, isOwn && styles.nameOwn]}>{message.playerName}</Text>
          <Text style={[styles.time, isOwn && styles.timeOwn]}>{formatTime(message.createdAt)}</Text>
          {isAdmin && onDelete && (
            <Pressable onPress={() => onDelete(message.id)} style={styles.deleteBtn} hitSlop={8}>
              <Text style={styles.deleteIcon}>🗑</Text>
            </Pressable>
          )}
        </View>
        <Text style={[styles.body, isOwn && styles.bodyOwn]}>{message.body}</Text>
      </View>
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
    flex: 1,
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
  deleteBtn: {
    marginLeft: 'auto',
    padding: 2,
  },
  deleteIcon: {
    fontSize: 13,
  },
  body: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: '#1a1a1a',
  },
  bodyOwn: {
    color: '#fff',
  },
});

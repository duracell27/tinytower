import React from 'react';
import { View, Text, Pressable, StyleSheet, useColorScheme } from 'react-native';
import { Image } from 'expo-image';
import type { ForumComment as ForumCommentType } from '../stores/forumStore';
import { getUserIcon } from '../utils/userIcon';

interface Props {
  comment: ForumCommentType;
  isOwn: boolean;
  isAdmin: boolean;
  onLongPress?: (id: string, body: string, isOwn: boolean) => void;
  onAvatarPress?: () => void;
}

function formatTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function ForumComment({ comment, isOwn, isAdmin, onLongPress, onAvatarPress }: Props) {
  const canInteract = isOwn || isAdmin;
  const isDark = useColorScheme() === 'dark';
  return (
    <View style={styles.row}>
      <Pressable onPress={onAvatarPress} disabled={!onAvatarPress} hitSlop={6}>
        <Image source={getUserIcon(comment.playerLevel)} style={[styles.avatar, isDark && { backgroundColor: '#3A3F4A' }]} contentFit="cover" />
      </Pressable>
      <Pressable
        onLongPress={canInteract && onLongPress ? () => onLongPress(comment.id, comment.body, isOwn || isAdmin) : undefined}
        delayLongPress={350}
        style={[styles.bubble, isDark && { backgroundColor: '#2A2F38' }]}
      >
        <View style={styles.header}>
          <Text style={styles.name}>{comment.playerName}</Text>
          <Text style={[styles.level, isDark && { color: '#5A6470' }]}>Lv.{comment.playerLevel}</Text>
          <Text style={[styles.time, isDark && { color: '#5A6470' }]}>{formatTime(comment.createdAt)}</Text>
        </View>
        <Text style={[styles.body, isDark && { color: '#DDE8D8' }]}>{comment.body}</Text>
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
    width: 34,
    height: 34,
    borderRadius: 17,
    marginRight: 8,
    marginTop: 2,
    backgroundColor: '#e8e8e8',
  },
  bubble: {
    flexShrink: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 1,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  name: { fontFamily: 'Fredoka_600SemiBold', fontSize: 13, color: '#3C9A34' },
  level: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: '#bbb' },
  time: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: '#bbb' },
  body: { fontFamily: 'Nunito_400Regular', fontSize: 14, color: '#1a1a1a', lineHeight: 20 },
});

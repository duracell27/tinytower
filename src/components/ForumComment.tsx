import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import LocaleText from './LocaleText';
import { Image } from 'expo-image';
import type { ForumComment as ForumCommentType } from '../stores/forumStore';
import { getUserIcon } from '../utils/userIcon';
import { useBlockStore } from '../stores/blockStore';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { useAppTheme } from '../hooks/useAppTheme';

interface Props {
  comment: ForumCommentType;
  isOwn: boolean;
  isAdmin: boolean;
  canReport?: boolean;
  onLongPress?: (id: string, body: string, isOwn: boolean) => void;
  onAvatarPress?: () => void;
}

function formatTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}с`;
  if (diff < 3600) return `${Math.floor(diff / 60)}хв`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}год`;
  return `${Math.floor(diff / 86400)}дн`;
}

export default function ForumComment({ comment, isOwn, isAdmin, canReport, onLongPress, onAvatarPress }: Props) {
  const canInteract = isOwn || isAdmin || canReport;
  const theme = useAppTheme();
  const styles = getStyles(theme);
  const blocked = useBlockStore(s => s.isBlocked(comment.playerId));
  const playerId = useAuthStore(s => s.player?.id);
  const currentPlayerLevel = useGameStore(s => s.playerLevel);
  const displayLevel = comment.playerId === playerId ? currentPlayerLevel : comment.playerLevel;
  return (
    <View style={styles.row}>
      <Pressable onPress={onAvatarPress} disabled={!onAvatarPress} hitSlop={6}>
        <Image
          source={getUserIcon(comment.playerLevel)}
          style={[styles.avatar, blocked && { borderColor: '#E05A4A', borderWidth: 2 }]}
          contentFit="cover"
        />
      </Pressable>
      <Pressable
        onLongPress={canInteract && onLongPress ? () => onLongPress(comment.id, comment.body, isOwn || isAdmin) : undefined}
        delayLongPress={350}
        style={styles.bubble}
      >
        <View style={styles.header}>
          <LocaleText style={styles.name}>{comment.playerName}</LocaleText>
          <LocaleText style={styles.level}>Lv.{displayLevel}</LocaleText>
          <LocaleText style={styles.time}>{formatTime(comment.createdAt)}</LocaleText>
        </View>
        <LocaleText style={styles.body}>
          {blocked ? <LocaleText style={styles.blockedText}>From blocked user</LocaleText> : comment.body}
        </LocaleText>
      </Pressable>
    </View>
  );
}

function getStyles(theme: ReturnType<typeof useAppTheme>) {
  const { isDark } = theme;
  return StyleSheet.create({
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
      backgroundColor: isDark ? '#3A3F4A' : '#e8e8e8',
    },
    bubble: {
      flexShrink: 1,
      backgroundColor: isDark ? theme.surfaceCard : theme.surface,
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
    level: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: isDark ? '#5A6470' : '#bbb' },
    time: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: isDark ? '#5A6470' : '#bbb' },
    body: { fontFamily: 'Nunito_400Regular', fontSize: 14, color: isDark ? theme.text : '#1a1a1a', lineHeight: 20 },
    blockedText: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: '#aaa', fontStyle: 'italic' },
  });
}

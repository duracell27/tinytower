import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import type { ForumCategory } from '../stores/forumStore';

interface Props {
  category: ForumCategory;
  label: string;
  description: string;
  unreadCount: number;
  onPress: () => void;
}

const CATEGORY_EMOJI: Record<ForumCategory, string> = {
  NEWS: '📢',
  HELP: '❓',
  GENERAL: '💬',
  CITIES: '🏙️',
  PURCHASES: '💎',
};

export default function ForumCategoryCard({ category, label, description, unreadCount, onPress }: Props) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Image
        source={require('../../assets/img/forum/folderwithdocs.png')}
        style={styles.folderIcon}
        contentFit="contain"
      />
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={styles.emoji}>{CATEGORY_EMOJI[category]}</Text>
          <Text style={styles.label}>{label}</Text>
        </View>
        <Text style={styles.description} numberOfLines={1}>{description}</Text>
      </View>
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      )}
      <Text style={styles.arrow}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
    gap: 12,
  },
  folderIcon: { width: 44, height: 44 },
  info: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  emoji: { fontSize: 16 },
  label: { fontFamily: 'Fredoka_600SemiBold', fontSize: 16, color: '#2A3344' },
  description: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: '#888' },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#3C9A34',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 12, color: '#fff' },
  arrow: { fontSize: 24, color: '#ccc', marginLeft: 2 },
});

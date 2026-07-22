import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function ForumScreen() {
  const router = useRouter();
  const { t } = useTranslation('tabs');
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{t('menu.forum')}</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.empty}>
        <Text style={styles.emptyEmoji}>🏗️</Text>
        <Text style={styles.emptyText}>{t('forum.comingSoon')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7F0' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
  },
  backBtn: {
    width: 36,
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 32,
    color: '#3C9A34',
    lineHeight: 36,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 20,
    color: '#2A3344',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyEmoji: {
    fontSize: 56,
  },
  emptyText: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 16,
    color: '#aaa',
  },
});

import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, Pressable, RefreshControl,
  Modal, TextInput, KeyboardAvoidingView, Platform,
  Alert, StyleSheet,
} from 'react-native';
import { useAppTheme } from '../src/hooks/useAppTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import ForumPostRow from '../src/components/ForumPostRow';
import ReportSheet from '../src/components/ReportSheet';
import { useForumStore, type ForumCategory } from '../src/stores/forumStore';
import { useAuthStore } from '../src/stores/authStore';
import type { ReportTargetType } from '../src/stores/reportStore';

export default function ForumCategoryScreen() {
  const router = useRouter();
  const { category } = useLocalSearchParams<{ category: string }>();
  const cat = category as ForumCategory;
  const { t } = useTranslation('tabs');
  const insets = useSafeAreaInsets();

  const { posts, postsLoading, postsHasMore, isSending, fetchPosts, createPost } = useForumStore();
  const player = useAuthStore(s => s.player);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const isAdmin = player?.isAdmin ?? false;
  const canPost = isAuthenticated && (cat !== 'NEWS' || isAdmin);

  const theme = useAppTheme();
  const { isDark } = theme;
  const [modalVisible, setModalVisible] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: ReportTargetType; id: string } | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void fetchPosts(cat, true);
    }, [cat, fetchPosts]),
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetchPosts(cat, true);
    } finally {
      setIsRefreshing(false);
    }
  }, [cat, fetchPosts]);

  const handleSubmit = async () => {
    if (!newTitle.trim() || !newBody.trim() || isSending) return;
    try {
      await createPost(cat, newTitle.trim(), newBody.trim());
      setModalVisible(false);
      setNewTitle('');
      setNewBody('');
    } catch (e) {
      Alert.alert(t('forum.sendError'), (e as Error).message);
    }
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setNewTitle('');
    setNewBody('');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }, isDark && { backgroundColor: '#1A1E24' }]}>
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.divider }]}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn} hitSlop={8}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{t(`forum.categories.${cat}`)}</Text>
        {canPost ? (
          <Pressable onPress={() => setModalVisible(true)} style={styles.headerBtn} hitSlop={8}>
            <Text style={styles.addBtn}>+</Text>
          </Pressable>
        ) : (
          <View style={styles.headerBtn} />
        )}
      </View>

      <FlatList
        data={posts}
        keyExtractor={p => p.id}
        renderItem={({ item }) => (
          <ForumPostRow
            post={item}
            onPress={() => router.push({ pathname: '/forum-post', params: { postId: item.id, category: cat } })}
            onReport={
              isAuthenticated && item.playerId !== player?.id
                ? () => setReportTarget({ type: 'FORUM_POST', id: item.id })
                : undefined
            }
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void handleRefresh()}
            tintColor="#3C9A34"
          />
        }
        ListEmptyComponent={
          !postsLoading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t('forum.noPostsYet')}</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          postsHasMore ? (
            <Pressable style={[styles.loadMore, { backgroundColor: theme.surface, borderColor: theme.divider }]} onPress={() => void fetchPosts(cat)}>
              <Text style={styles.loadMoreText}>{t('forum.loadMore')}</Text>
            </Pressable>
          ) : null
        }
        contentContainerStyle={styles.list}
      />

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

      {/* New post modal */}
      <Modal visible={modalVisible} animationType="slide" onRequestClose={handleCloseModal}>
        <KeyboardAvoidingView
          style={[styles.modalContainer, isDark && { backgroundColor: '#1A1E24' }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalInner, { paddingTop: insets.top }]}>
            <LinearGradient colors={theme.isDark ? ['#1E4018', '#143010'] : ['#5E8F42', '#4D7836']} style={styles.modalHeader}>
              <Pressable onPress={handleCloseModal} style={styles.modalClose} hitSlop={10}>
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
              <Text style={styles.modalTitle}>{t('forum.newPost')}</Text>
              <Pressable
                onPress={handleSubmit}
                disabled={!newTitle.trim() || !newBody.trim() || isSending}
                hitSlop={8}
              >
                <Text style={[styles.modalSubmit, (!newTitle.trim() || !newBody.trim() || isSending) && styles.modalSubmitDisabled]}>
                  {t('forum.submit')}
                </Text>
              </Pressable>
            </LinearGradient>

            <TextInput
              style={[styles.titleInput, { backgroundColor: theme.surface, borderColor: theme.divider, color: theme.text }]}
              value={newTitle}
              onChangeText={v => setNewTitle(v.slice(0, 200))}
              placeholder={t('forum.categories.' + cat)}
              placeholderTextColor={theme.isDark ? '#4A5468' : '#bbb'}
              maxLength={200}
            />
            <TextInput
              style={[styles.bodyInput, { backgroundColor: theme.surface, borderColor: theme.divider, color: theme.text }]}
              value={newBody}
              onChangeText={v => setNewBody(v.slice(0, 5000))}
              placeholder={t('forum.commentPlaceholder')}
              placeholderTextColor={theme.isDark ? '#4A5468' : '#bbb'}
              multiline
              maxLength={5000}
              textAlignVertical="top"
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  headerBtn: { width: 36, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 32, color: '#3C9A34', lineHeight: 36 },
  addBtn: { fontSize: 28, color: '#3C9A34', lineHeight: 34 },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontFamily: 'Fredoka_600SemiBold', fontSize: 20, color: '#2A3344',
  },
  list: { flexGrow: 1 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontFamily: 'Nunito_400Regular', color: '#aaa', fontSize: 15 },
  loadMore: {
    margin: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3C9A34',
  },
  loadMoreText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 15, color: '#3C9A34' },
  // Modal
  modalContainer: { flex: 1, backgroundColor: '#F4F7F0' },
  modalInner: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  modalClose: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  modalCloseText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  modalTitle: { fontFamily: 'Fredoka_700Bold', fontSize: 17, color: '#fff' },
  modalSubmit: { fontFamily: 'Fredoka_600SemiBold', fontSize: 16, color: '#fff' },
  modalSubmitDisabled: { opacity: 0.4 },
  titleInput: {
    margin: 16,
    marginBottom: 8,
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 14,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 16,
    color: '#2A3344',
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  bodyInput: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 14,
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#e8e8e8',
    minHeight: 200,
  },
});

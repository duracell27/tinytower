import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, Pressable, TextInput, Modal,
  KeyboardAvoidingView, Platform, Alert, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import ForumCommentComponent from '../src/components/ForumComment';
import { useForumStore } from '../src/stores/forumStore';
import { useAuthStore } from '../src/stores/authStore';
import { getUserIcon } from '../src/utils/userIcon';

type SelectedItem = { id: string; body: string; isOwn: boolean; type: 'post' | 'comment' };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function ForumPostScreen() {
  const router = useRouter();
  const { postId, category } = useLocalSearchParams<{ postId: string; category: string }>();
  const { t } = useTranslation('tabs');
  const insets = useSafeAreaInsets();

  const {
    activePost, comments, commentsLoading, commentsHasMore, isSending,
    fetchPost, markRead, fetchComments, createComment, updateComment,
    deleteComment, updatePost, deletePost, pinPost, closePost,
  } = useForumStore();
  const player = useAuthStore(s => s.player);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const isAdmin = player?.isAdmin ?? false;

  const [commentText, setCommentText] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [editPostVisible, setEditPostVisible] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');

  useFocusEffect(
    useCallback(() => {
      void fetchPost(postId);
      void fetchComments(postId, true);
      void markRead(postId);
    }, [postId, fetchPost, fetchComments, markRead]),
  );

  const handleSendComment = async () => {
    const body = commentText.trim();
    if (!body || isSending) return;
    setCommentText('');
    if (editingCommentId) {
      const id = editingCommentId;
      setEditingCommentId(null);
      try { await updateComment(id, body); }
      catch (e) { Alert.alert(t('forum.sendError'), (e as Error).message); }
    } else {
      try { await createComment(postId, body); }
      catch (e) { Alert.alert(t('forum.sendError'), (e as Error).message); }
    }
  };

  const handleLongPressComment = (id: string, body: string, isOwn: boolean) => {
    setSelectedItem({ id, body, isOwn, type: 'comment' });
  };

  const handleActionEdit = () => {
    if (!selectedItem) return;
    if (selectedItem.type === 'post') {
      setEditTitle(activePost?.title ?? '');
      setEditBody(activePost?.body ?? '');
      setEditPostVisible(true);
    } else {
      setEditingCommentId(selectedItem.id);
      setCommentText(selectedItem.body);
    }
    setSelectedItem(null);
  };

  const handleActionDelete = () => {
    if (!selectedItem) return;
    const item = selectedItem;
    setSelectedItem(null);
    Alert.alert(
      t('forum.deleteConfirm'),
      item.type === 'post' ? t('forum.deleteConfirmPost') : t('forum.deleteConfirmComment'),
      [
        { text: t('forum.cancel'), style: 'cancel' },
        {
          text: t('forum.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              if (item.type === 'post') {
                await deletePost(item.id);
                router.back();
              } else {
                await deleteComment(item.id);
              }
            } catch (e) {
              Alert.alert(t('forum.sendError'), (e as Error).message);
            }
          },
        },
      ],
    );
  };

  const handleSubmitEditPost = async () => {
    if (!editTitle.trim() || !editBody.trim() || isSending) return;
    try {
      await updatePost(postId, editTitle.trim(), editBody.trim());
      setEditPostVisible(false);
    } catch (e) {
      Alert.alert(t('forum.sendError'), (e as Error).message);
    }
  };

  const isPostOwn = activePost?.playerId === player?.id;
  const canModifyPost = isPostOwn || isAdmin;

  const ListHeader = activePost ? (
    <View style={styles.postCard}>
      <View style={styles.postMeta}>
        <Image source={getUserIcon(activePost.playerLevel)} style={styles.postAvatar} contentFit="cover" />
        <View>
          <Text style={styles.postAuthor}>{activePost.playerName} · Lv.{activePost.playerLevel}</Text>
          <Text style={styles.postDate}>{formatDate(activePost.createdAt)}</Text>
        </View>
        {canModifyPost && (
          <Pressable
            onPress={() => setSelectedItem({ id: postId, body: activePost.body, isOwn: isPostOwn, type: 'post' })}
            style={styles.postMenuBtn}
            hitSlop={8}
          >
            <Text style={styles.postMenuIcon}>•••</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.postTitle}>{activePost.title}</Text>
      <Text style={styles.postBody}>{activePost.body}</Text>
      {isAdmin && (
        <View style={styles.adminActions}>
          <Pressable
            style={[styles.adminBtn, activePost.isPinned && styles.adminBtnActive]}
            onPress={() => void pinPost(postId, !activePost.isPinned)}
          >
            <Text style={styles.adminBtnText}>{activePost.isPinned ? '📌 Unpin' : '📌 Pin'}</Text>
          </Pressable>
          <Pressable
            style={[styles.adminBtn, activePost.isClosed && styles.adminBtnActive]}
            onPress={() => void closePost(postId, !activePost.isClosed)}
          >
            <Text style={styles.adminBtnText}>{activePost.isClosed ? '🔓 Open' : '🔒 Close'}</Text>
          </Pressable>
        </View>
      )}
      <View style={styles.divider} />
      <Text style={styles.commentsLabel}>💬 {activePost.commentCount} comments</Text>
    </View>
  ) : null;

  // Suppress unused warning — category may be used for future analytics/breadcrumb
  void category;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn} hitSlop={8}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {activePost?.title ?? ''}
        </Text>
        <View style={styles.headerBtn} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 56}
      >
        <FlatList
          data={comments}
          keyExtractor={c => c.id}
          ListHeaderComponent={ListHeader}
          renderItem={({ item }) => (
            <ForumCommentComponent
              comment={item}
              isOwn={item.playerId === player?.id}
              isAdmin={isAdmin}
              onLongPress={handleLongPressComment}
            />
          )}
          ListEmptyComponent={
            commentsLoading ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>Loading...</Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            commentsHasMore ? (
              <Pressable style={styles.loadMore} onPress={() => void fetchComments(postId)}>
                <Text style={styles.loadMoreText}>{t('forum.loadMore')}</Text>
              </Pressable>
            ) : null
          }
          contentContainerStyle={styles.list}
        />

        {/* Input area */}
        {isAuthenticated && activePost && !activePost.isClosed ? (
          <View>
            {editingCommentId && (
              <View style={styles.editBanner}>
                <Text style={styles.editBannerText}>{t('forum.editing')}</Text>
                <Pressable onPress={() => { setEditingCommentId(null); setCommentText(''); }} hitSlop={8}>
                  <Text style={styles.editBannerCancel}>✕</Text>
                </Pressable>
              </View>
            )}
            <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom + 8, 16) }]}>
              <TextInput
                style={styles.input}
                value={commentText}
                onChangeText={v => setCommentText(v.slice(0, 1000))}
                placeholder={t('forum.commentPlaceholder')}
                placeholderTextColor="#aaa"
                multiline
                maxLength={1000}
              />
              <Pressable
                style={[styles.sendBtn, (!commentText.trim() || isSending) && styles.sendBtnDisabled]}
                onPress={handleSendComment}
                disabled={!commentText.trim() || isSending}
              >
                <Text style={styles.sendIcon}>{editingCommentId ? '✓' : '➤'}</Text>
              </Pressable>
            </View>
          </View>
        ) : activePost?.isClosed ? (
          <View style={[styles.closedBanner, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <Text style={styles.closedText}>🔒 {t('forum.closedBanner')}</Text>
          </View>
        ) : !isAuthenticated ? (
          <View style={[styles.closedBanner, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <Text style={styles.closedText}>{t('forum.guestBanner')}</Text>
          </View>
        ) : null}
      </KeyboardAvoidingView>

      {/* Action sheet for long-press */}
      <Modal visible={!!selectedItem} transparent animationType="fade" onRequestClose={() => setSelectedItem(null)}>
        <Pressable style={styles.overlay} onPress={() => setSelectedItem(null)}>
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            {selectedItem?.isOwn && (
              <Pressable style={styles.sheetItem} onPress={handleActionEdit}>
                <Image source={require('../assets/img/edit.png')} style={styles.sheetIcon} contentFit="contain" />
                <Text style={styles.sheetText}>{t('forum.actionEdit')}</Text>
              </Pressable>
            )}
            <Pressable style={styles.sheetItem} onPress={handleActionDelete}>
              <Image source={require('../assets/img/delete.png')} style={styles.sheetIcon} contentFit="contain" />
              <Text style={[styles.sheetText, styles.sheetDanger]}>{t('forum.actionDelete')}</Text>
            </Pressable>
            <View style={styles.sheetDivider} />
            <Pressable style={styles.sheetItem} onPress={() => setSelectedItem(null)}>
              <Text style={[styles.sheetText, styles.sheetCancel]}>{t('forum.cancel')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Edit post modal */}
      <Modal visible={editPostVisible} animationType="slide" onRequestClose={() => setEditPostVisible(false)}>
        <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ flex: 1, paddingTop: insets.top }}>
            <LinearGradient colors={['#4BAD42', '#2E8528']} style={styles.modalHeader}>
              <Pressable onPress={() => setEditPostVisible(false)} style={styles.modalClose} hitSlop={10}>
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
              <Text style={styles.modalTitle}>{t('forum.editPost')}</Text>
              <Pressable onPress={handleSubmitEditPost} disabled={isSending} hitSlop={8}>
                <Text style={[styles.modalSubmit, isSending && styles.modalSubmitDisabled]}>{t('forum.submit')}</Text>
              </Pressable>
            </LinearGradient>
            <TextInput
              style={styles.editTitleInput}
              value={editTitle}
              onChangeText={v => setEditTitle(v.slice(0, 200))}
              maxLength={200}
            />
            <TextInput
              style={styles.editBodyInput}
              value={editBody}
              onChangeText={v => setEditBody(v.slice(0, 5000))}
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
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e8e8e8',
  },
  headerBtn: { width: 36, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 32, color: '#3C9A34', lineHeight: 36 },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: 'Fredoka_600SemiBold', fontSize: 18, color: '#2A3344' },
  list: { paddingBottom: 12 },
  postCard: { backgroundColor: '#fff', padding: 16, marginBottom: 8 },
  postMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  postAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#e8e8e8' },
  postAuthor: { fontFamily: 'Fredoka_600SemiBold', fontSize: 14, color: '#2A3344' },
  postDate: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: '#aaa' },
  postMenuBtn: { marginLeft: 'auto' },
  postMenuIcon: { fontSize: 16, color: '#aaa', letterSpacing: 1 },
  postTitle: { fontFamily: 'Fredoka_700Bold', fontSize: 19, color: '#2A3344', marginBottom: 10, lineHeight: 24 },
  postBody: { fontFamily: 'Nunito_400Regular', fontSize: 15, color: '#333', lineHeight: 22 },
  adminActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  adminBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    backgroundColor: '#F4F7F0', borderWidth: 1, borderColor: '#ddd',
  },
  adminBtnActive: { backgroundColor: '#EAF5E9', borderColor: '#3C9A34' },
  adminBtnText: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: '#2A3344' },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 14 },
  commentsLabel: { fontFamily: 'Fredoka_600SemiBold', fontSize: 14, color: '#888' },
  loadMore: {
    margin: 16, padding: 12, borderRadius: 12,
    backgroundColor: '#fff', alignItems: 'center',
    borderWidth: 1, borderColor: '#3C9A34',
  },
  loadMoreText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 15, color: '#3C9A34' },
  // Input bar
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    padding: 8, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#e8e8e8', gap: 8,
  },
  input: {
    flex: 1, minHeight: 40, maxHeight: 120,
    backgroundColor: '#F4F7F0', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    fontFamily: 'Nunito_400Regular', fontSize: 15, color: '#1a1a1a',
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#3C9A34', alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#ccc' },
  sendIcon: { color: '#fff', fontSize: 16 },
  editBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#EAF5E9', paddingHorizontal: 16, paddingVertical: 6,
    borderTopWidth: 1, borderTopColor: '#3C9A34',
  },
  editBannerText: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: '#3C9A34' },
  editBannerCancel: { fontSize: 16, color: '#3C9A34', fontWeight: '600' },
  closedBanner: {
    padding: 16, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#e8e8e8', alignItems: 'center',
  },
  closedText: { fontFamily: 'Nunito_600SemiBold', color: '#999', fontSize: 14, textAlign: 'center' },
  // Action sheet
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 8, paddingHorizontal: 8,
  },
  sheetItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, paddingHorizontal: 16, borderRadius: 12 },
  sheetIcon: { width: 24, height: 24 },
  sheetText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 17, color: '#2A3344' },
  sheetDanger: { color: '#E53935' },
  sheetCancel: { color: '#888', textAlign: 'center', flex: 1 },
  sheetDivider: { height: 1, backgroundColor: '#f0f0f0', marginHorizontal: 8 },
  // Edit post modal
  modalContainer: { flex: 1, backgroundColor: '#F4F7F0' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
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
  editTitleInput: {
    margin: 16, marginBottom: 8, padding: 14,
    backgroundColor: '#fff', borderRadius: 14,
    fontFamily: 'Fredoka_600SemiBold', fontSize: 16, color: '#2A3344',
    borderWidth: 1, borderColor: '#e8e8e8',
  },
  editBodyInput: {
    flex: 1, marginHorizontal: 16, marginBottom: 16, padding: 14,
    backgroundColor: '#fff', borderRadius: 14,
    fontFamily: 'Nunito_400Regular', fontSize: 15, color: '#1a1a1a',
    borderWidth: 1, borderColor: '#e8e8e8', minHeight: 200,
  },
  empty: { alignItems: 'center', paddingTop: 40 },
  emptyText: { fontFamily: 'Nunito_400Regular', color: '#aaa', fontSize: 15 },
});

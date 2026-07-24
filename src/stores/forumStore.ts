import { create } from 'zustand';
import { api } from '../services/api';

export type ForumCategory = 'NEWS' | 'HELP' | 'GENERAL' | 'CITIES' | 'PURCHASES';

export interface ForumPost {
  id: string;
  category: ForumCategory;
  title: string;
  body: string;
  playerId: string;
  playerName: string;
  playerLevel: number;
  isPinned: boolean;
  isClosed: boolean;
  commentCount: number;
  isUnread: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ForumComment {
  id: string;
  postId: string;
  playerId: string;
  playerName: string;
  playerLevel: number;
  body: string;
  createdAt: string;
  updatedAt: string;
}

interface PostsResponse { posts: ForumPost[]; total: number; page: number; hasMore: boolean; }
interface CommentsResponse { comments: ForumComment[]; total: number; page: number; hasMore: boolean; }

interface ForumState {
  posts: ForumPost[];
  postsPage: number;
  postsHasMore: boolean;
  postsLoading: boolean;
  postsCategory: ForumCategory | null;
  activePost: ForumPost | null;
  comments: ForumComment[];
  commentsPage: number;
  commentsHasMore: boolean;
  commentsLoading: boolean;
  isSending: boolean;
  error: string | null;
  unreadCounts: Record<ForumCategory, number>;
}

interface ForumActions {
  fetchPosts(category: ForumCategory, reset?: boolean): Promise<void>;
  loadMorePosts(category: ForumCategory): Promise<void>;
  createPost(category: ForumCategory, title: string, body: string): Promise<void>;
  updatePost(id: string, title: string, body: string): Promise<void>;
  deletePost(id: string): Promise<void>;
  pinPost(id: string, isPinned: boolean): Promise<void>;
  closePost(id: string, isClosed: boolean): Promise<void>;
  fetchPost(id: string): Promise<void>;
  markRead(postId: string): Promise<void>;
  fetchComments(postId: string, reset?: boolean): Promise<void>;
  loadMoreComments(postId: string): Promise<void>;
  createComment(postId: string, body: string): Promise<void>;
  updateComment(id: string, body: string): Promise<void>;
  deleteComment(id: string): Promise<void>;
  fetchUnreadCounts(): Promise<void>;
}

const EMPTY_COUNTS: Record<ForumCategory, number> = { NEWS: 0, HELP: 0, GENERAL: 0, CITIES: 0, PURCHASES: 0 };

export const useForumStore = create<ForumState & ForumActions>((set, get) => ({
  posts: [],
  postsPage: 1,
  postsHasMore: false,
  postsLoading: false,
  postsCategory: null,
  activePost: null,
  comments: [],
  commentsPage: 1,
  commentsHasMore: false,
  commentsLoading: false,
  isSending: false,
  error: null,
  unreadCounts: { ...EMPTY_COUNTS },

  fetchPosts: async (category, reset = false) => {
    const page = reset ? 1 : get().postsPage;
    if (!reset && !get().postsHasMore && page > 1) return;
    if (reset) set({ postsCategory: category });
    set({ postsLoading: true });
    try {
      const data = await api.get<PostsResponse>(`/forum/posts?category=${category}&page=${page}&limit=20`);
      set(s => ({
        posts: reset ? data.posts : [...s.posts, ...data.posts],
        postsPage: data.page + 1,
        postsHasMore: data.hasMore,
      }));
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ postsLoading: false });
    }
  },

  loadMorePosts: async (category) => {
    return get().fetchPosts(category, false);
  },

  createPost: async (category, title, body) => {
    set({ isSending: true, error: null });
    try {
      await api.post('/forum/posts', { category, title, body });
      await get().fetchPosts(category, true);
    } catch (e) {
      set({ error: (e as Error).message });
      throw e;
    } finally {
      set({ isSending: false });
    }
  },

  updatePost: async (id, title, body) => {
    set({ isSending: true, error: null });
    try {
      const data = await api.patch<{ post: ForumPost }>(`/forum/posts/${id}`, { title, body });
      set(s => ({
        posts: s.posts.map(p => p.id === id ? data.post : p),
        activePost: s.activePost?.id === id ? data.post : s.activePost,
      }));
    } catch (e) {
      set({ error: (e as Error).message });
      throw e;
    } finally {
      set({ isSending: false });
    }
  },

  deletePost: async (id) => {
    set(s => ({ posts: s.posts.filter(p => p.id !== id) }));
    try {
      await api.delete(`/forum/posts/${id}`);
    } catch (e) {
      const cat = get().postsCategory;
      if (cat) await get().fetchPosts(cat, true);
      set({ error: (e as Error).message });
      throw e;
    }
  },

  pinPost: async (id, isPinned) => {
    try {
      const data = await api.patch<{ post: ForumPost }>(`/forum/posts/${id}/pin`, { isPinned });
      set(s => ({ posts: s.posts.map(p => p.id === id ? data.post : p) }));
    } catch (e) {
      set({ error: (e as Error).message });
      throw e;
    }
  },

  closePost: async (id, isClosed) => {
    try {
      const data = await api.patch<{ post: ForumPost }>(`/forum/posts/${id}/close`, { isClosed });
      set(s => ({
        posts: s.posts.map(p => p.id === id ? data.post : p),
        activePost: s.activePost?.id === id ? data.post : s.activePost,
      }));
    } catch (e) {
      set({ error: (e as Error).message });
      throw e;
    }
  },

  fetchPost: async (id) => {
    try {
      const data = await api.get<{ post: ForumPost }>(`/forum/posts/${id}`);
      set({ activePost: data.post });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  markRead: async (postId) => {
    try {
      await api.post(`/forum/posts/${postId}/read`);
      set(s => ({
        posts: s.posts.map(p => p.id === postId ? { ...p, isUnread: false } : p),
        activePost: s.activePost?.id === postId ? { ...s.activePost, isUnread: false } : s.activePost,
      }));
    } catch {
      // silent — read tracking is best-effort
    }
  },

  loadMoreComments: async (postId) => {
    return get().fetchComments(postId, false);
  },

  fetchComments: async (postId, reset = false) => {
    const page = reset ? 1 : get().commentsPage;
    if (!reset && !get().commentsHasMore && page > 1) return;
    set({ commentsLoading: true });
    try {
      const data = await api.get<CommentsResponse>(`/forum/posts/${postId}/comments?page=${page}&limit=50`);
      set(s => ({
        comments: reset ? data.comments : [...s.comments, ...data.comments],
        commentsPage: data.page + 1,
        commentsHasMore: data.hasMore,
      }));
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ commentsLoading: false });
    }
  },

  createComment: async (postId, body) => {
    set({ isSending: true, error: null });
    try {
      await api.post(`/forum/posts/${postId}/comments`, { body });
      await get().fetchComments(postId, true);
    } catch (e) {
      set({ error: (e as Error).message });
      throw e;
    } finally {
      set({ isSending: false });
    }
  },

  updateComment: async (id, body) => {
    set({ isSending: true, error: null });
    try {
      const data = await api.patch<{ comment: ForumComment }>(`/forum/comments/${id}`, { body });
      set(s => ({ comments: s.comments.map(c => c.id === id ? data.comment : c) }));
    } catch (e) {
      set({ error: (e as Error).message });
      throw e;
    } finally {
      set({ isSending: false });
    }
  },

  deleteComment: async (id) => {
    set(s => ({
      comments: s.comments.filter(c => c.id !== id),
      activePost: s.activePost ? { ...s.activePost, commentCount: Math.max(0, s.activePost.commentCount - 1) } : null,
    }));
    try {
      await api.delete(`/forum/comments/${id}`);
    } catch (e) {
      const postId = get().activePost?.id;
      if (postId) await get().fetchComments(postId, true);
      set({ error: (e as Error).message });
      throw e;
    }
  },

  fetchUnreadCounts: async () => {
    try {
      const counts = await api.get<Record<ForumCategory, number>>('/forum/unread');
      set({ unreadCounts: counts });
    } catch {
      // silent — badge counts are best-effort
    }
  },
}));

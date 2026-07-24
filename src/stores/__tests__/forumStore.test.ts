import { act } from 'react';
import { useForumStore } from '../forumStore';
import { api } from '../../services/api';

jest.mock('../../services/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockApi = api as jest.Mocked<typeof api>;

const makePost = (arg: string | Record<string, any> = {}) => {
  const overrides = typeof arg === 'string' ? { id: arg } : arg;
  return {
    id: 'post-1', category: 'GENERAL' as const, title: 'Hello', body: 'World',
    playerId: 'p1', playerName: 'Alice', playerLevel: 10,
    isPinned: false, isClosed: false, commentCount: 2, isUnread: true,
    createdAt: '2026-07-24T10:00:00Z', updatedAt: '2026-07-24T10:00:00Z',
    ...overrides,
  };
};

const makeComment = (arg: string | Record<string, any> = {}) => {
  const overrides = typeof arg === 'string' ? { id: arg } : arg;
  return {
    id: 'c1', postId: 'post-1', playerId: 'p1', playerName: 'Alice',
    playerLevel: 10, body: 'Great!', createdAt: '2026-07-24T10:01:00Z', updatedAt: '2026-07-24T10:01:00Z',
    ...overrides,
  };
};

const INITIAL: any = {
  posts: [], postsPage: 1, postsHasMore: false, postsLoading: false, postsCategory: null,
  activePost: null, comments: [], commentsPage: 1, commentsHasMore: false, commentsLoading: false,
  isSending: false, error: null,
  unreadCounts: { NEWS: 0, HELP: 0, GENERAL: 0, CITIES: 0, PURCHASES: 0 },
};

beforeEach(() => {
  jest.clearAllMocks();
  useForumStore.setState(INITIAL);
});

describe('fetchPosts', () => {
  it('loads first page and stores posts', async () => {
    mockApi.get.mockResolvedValue({ posts: [makePost()], total: 1, page: 1, hasMore: false });
    await act(async () => { await useForumStore.getState().fetchPosts('GENERAL', true); });
    expect(useForumStore.getState().posts).toHaveLength(1);
    expect(useForumStore.getState().postsHasMore).toBe(false);
    expect(useForumStore.getState().postsLoading).toBe(false);
  });

  it('appends posts on load-more (reset=false)', async () => {
    useForumStore.setState({ posts: [makePost({ id: 'p1' })], postsPage: 2, postsHasMore: true });
    mockApi.get.mockResolvedValue({ posts: [makePost({ id: 'p2' })], total: 2, page: 2, hasMore: false });
    await act(async () => { await useForumStore.getState().fetchPosts('GENERAL'); });
    expect(useForumStore.getState().posts).toHaveLength(2);
  });

  it('resets list on reset=true', async () => {
    useForumStore.setState({ posts: [makePost(), makePost({ id: 'p2' })], postsPage: 3 });
    mockApi.get.mockResolvedValue({ posts: [makePost()], total: 1, page: 1, hasMore: false });
    await act(async () => { await useForumStore.getState().fetchPosts('GENERAL', true); });
    expect(useForumStore.getState().posts).toHaveLength(1);
  });
});

describe('createPost', () => {
  it('calls api.post and refreshes list', async () => {
    mockApi.post.mockResolvedValue({ post: makePost() });
    mockApi.get.mockResolvedValue({ posts: [makePost()], total: 1, page: 1, hasMore: false });
    await act(async () => { await useForumStore.getState().createPost('GENERAL', 'Hello', 'World'); });
    expect(mockApi.post).toHaveBeenCalledWith('/forum/posts', { category: 'GENERAL', title: 'Hello', body: 'World' });
    expect(useForumStore.getState().isSending).toBe(false);
  });

  it('sets error and rethrows on failure', async () => {
    mockApi.post.mockRejectedValue(new Error('Cooldown'));
    await expect(
      act(async () => { await useForumStore.getState().createPost('GENERAL', 'T', 'B'); })
    ).rejects.toThrow('Cooldown');
    expect(useForumStore.getState().error).toBe('Cooldown');
  });
});

describe('markRead', () => {
  it('calls api.post and clears isUnread on post', async () => {
    useForumStore.setState({ posts: [makePost({ isUnread: true })], activePost: makePost({ isUnread: true }) });
    mockApi.post.mockResolvedValue({ success: true });
    await act(async () => { await useForumStore.getState().markRead('post-1'); });
    expect(useForumStore.getState().posts[0].isUnread).toBe(false);
    expect(useForumStore.getState().activePost?.isUnread).toBe(false);
  });

  it('silently ignores network error', async () => {
    mockApi.post.mockRejectedValue(new Error('network'));
    await act(async () => { await useForumStore.getState().markRead('post-1'); });
    expect(useForumStore.getState().error).toBeNull();
  });
});

describe('deletePost', () => {
  it('removes post optimistically', async () => {
    useForumStore.setState({ posts: [makePost()] });
    mockApi.delete.mockResolvedValue({ success: true });
    await act(async () => { await useForumStore.getState().deletePost('post-1'); });
    expect(useForumStore.getState().posts).toHaveLength(0);
  });
});

describe('createComment', () => {
  it('sends comment to API and refreshes comments from server', async () => {
    useForumStore.setState({ activePost: makePost({ commentCount: 2 }), comments: [] });
    const newComment = makeComment();
    mockApi.post.mockResolvedValue({ comment: newComment });
    mockApi.get.mockResolvedValue({ comments: [newComment], total: 1, page: 1, hasMore: false });
    await act(async () => { await useForumStore.getState().createComment('post-1', 'Great!'); });
    expect(useForumStore.getState().comments).toHaveLength(1);
    expect(useForumStore.getState().isSending).toBe(false);
  });
});

describe('deleteComment', () => {
  it('removes comment optimistically and decrements commentCount', async () => {
    useForumStore.setState({ comments: [makeComment()], activePost: makePost({ commentCount: 1 }) });
    mockApi.delete.mockResolvedValue({ success: true });
    await act(async () => { await useForumStore.getState().deleteComment('c1'); });
    expect(useForumStore.getState().comments).toHaveLength(0);
    expect(useForumStore.getState().activePost?.commentCount).toBe(0);
  });
});

describe('fetchUnreadCounts', () => {
  it('stores unread counts', async () => {
    mockApi.get.mockResolvedValue({ NEWS: 2, HELP: 0, GENERAL: 3, CITIES: 0, PURCHASES: 1 });
    await act(async () => { await useForumStore.getState().fetchUnreadCounts(); });
    expect(useForumStore.getState().unreadCounts.NEWS).toBe(2);
    expect(useForumStore.getState().unreadCounts.GENERAL).toBe(3);
  });

  it('silently ignores errors', async () => {
    mockApi.get.mockRejectedValue(new Error('network'));
    await act(async () => { await useForumStore.getState().fetchUnreadCounts(); });
    expect(useForumStore.getState().unreadCounts.NEWS).toBe(0);
  });
});

describe('loadMorePosts', () => {
  it('appends to existing posts', async () => {
    const existing = { ...makePost('1'), category: 'GENERAL' as const };
    const extra = { ...makePost('2'), category: 'GENERAL' as const };
    useForumStore.setState({ posts: [existing], postsPage: 2, postsHasMore: true });
    mockApi.get.mockResolvedValue({ posts: [extra], total: 2, page: 2, hasMore: false });
    await act(async () => { await useForumStore.getState().loadMorePosts('GENERAL'); });
    expect(useForumStore.getState().posts).toHaveLength(2);
    expect(useForumStore.getState().postsHasMore).toBe(false);
  });
});

describe('loadMoreComments', () => {
  it('appends to existing comments', async () => {
    const existing = makeComment('c1');
    const extra = makeComment('c2');
    useForumStore.setState({ comments: [existing], commentsPage: 2, commentsHasMore: true });
    mockApi.get.mockResolvedValue({ comments: [extra], total: 2, page: 2, hasMore: false });
    await act(async () => { await useForumStore.getState().loadMoreComments('post1'); });
    expect(useForumStore.getState().comments).toHaveLength(2);
  });
});

describe('deletePost error revert', () => {
  it('reverts optimistic removal on error', async () => {
    const post = makePost('1');
    useForumStore.setState({ posts: [post], postsCategory: 'GENERAL' });
    mockApi.delete.mockRejectedValue(new Error('server error'));
    mockApi.get.mockResolvedValue({ posts: [post], total: 1, page: 1, hasMore: false });
    await act(async () => {
      await useForumStore.getState().deletePost('1').catch(() => {});
    });
    expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining('/forum/posts'));
  });
});

describe('deleteComment error revert', () => {
  it('reverts optimistic removal on error', async () => {
    const comment = makeComment('c1');
    const post = makePost('post1');
    useForumStore.setState({ comments: [comment], activePost: post });
    mockApi.delete.mockRejectedValue(new Error('server error'));
    mockApi.get.mockResolvedValue({ comments: [comment], total: 1, page: 1, hasMore: false });
    await act(async () => {
      await useForumStore.getState().deleteComment('c1').catch(() => {});
    });
    expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining('/forum/posts'));
  });
});

describe('createComment server refresh', () => {
  it('refreshes comments after success', async () => {
    const comment = makeComment('c1');
    useForumStore.setState({ activePost: makePost('post1') });
    mockApi.post.mockResolvedValue({ comment });
    mockApi.get.mockResolvedValue({ comments: [comment], total: 1, page: 1, hasMore: false });
    await act(async () => { await useForumStore.getState().createComment('post1', 'hello'); });
    expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining('/forum/posts/post1/comments'));
    expect(useForumStore.getState().comments).toEqual([comment]);
  });
});

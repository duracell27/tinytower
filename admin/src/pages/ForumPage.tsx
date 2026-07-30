import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Layout } from '../components/Layout';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { api } from '../lib/api';
import { cn } from '../lib/utils';

const CATEGORIES = ['NEWS', 'HELP', 'GENERAL', 'CITIES', 'PURCHASES'] as const;
type Category = typeof CATEGORIES[number];

interface ForumPost {
  id: string;
  playerId: string;
  playerName: string;
  playerLevel: number;
  category: Category;
  title: string;
  body: string;
  isPinned: boolean;
  isClosed: boolean;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ForumComment {
  id: string;
  postId: string;
  playerId: string;
  playerName: string;
  playerLevel: number;
  body: string;
  createdAt: string;
  updatedAt: string;
}

interface PostsResponse {
  data: ForumPost[];
  total: number;
  page: number;
  totalPages: number;
}

interface CommentsResponse {
  data: ForumComment[];
  total: number;
  page: number;
  totalPages: number;
}

function CreatePostForm({ category, onClose }: { category: Category; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const createMutation = useMutation({
    mutationFn: () =>
      api.post<ForumPost>('/admin/forum/posts', { category, title: title.trim(), body: body.trim() }),
    onSuccess: () => {
      toast.success('Post created');
      qc.invalidateQueries({ queryKey: ['admin-forum', category] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="border rounded-lg p-4 bg-white mb-4">
      <h3 className="font-medium mb-3 text-sm">New post in {category}</h3>
      <div className="space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (max 200 chars)"
          maxLength={200}
          className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Content (max 5000 chars)"
          maxLength={5000}
          rows={5}
          className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        />
        <div className="flex gap-2">
          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !title.trim() || !body.trim()}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating…' : 'Create Post'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border text-sm rounded hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function CommentsModal({ post, onClose }: { post: ForumPost; onClose: () => void }) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-forum-comments', post.id, page],
    queryFn: () =>
      api.get<CommentsResponse>(`/admin/forum/posts/${post.id}/comments?page=${page}&limit=50`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete<{ ok: true }>(`/admin/forum/comments/${id}`),
    onSuccess: () => {
      toast.success('Comment deleted');
      setConfirmId(null);
      qc.invalidateQueries({ queryKey: ['admin-forum-comments', post.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-start justify-between p-4 border-b gap-3">
          <div className="min-w-0">
            <p className="text-xs text-gray-500 mb-0.5">{post.category} · {post.playerName}</p>
            <h3 className="font-semibold leading-snug">{post.title}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0 mt-0.5">✕</button>
        </div>

        <div className="p-4 border-b bg-gray-50">
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{post.body}</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-2 border-b bg-gray-50">
            <span className="text-xs font-medium text-gray-500">COMMENTS ({post.commentCount})</span>
          </div>
          <div className="p-4 space-y-3">
            {isLoading ? (
              <p className="text-gray-400 text-sm">Loading…</p>
            ) : data?.data.length === 0 ? (
              <p className="text-gray-400 text-sm">No comments yet</p>
            ) : (
              data?.data.map((c) => (
                <div key={c.id} className="border rounded p-3 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-800">
                      {c.playerName}
                      <span className="font-normal text-gray-500 ml-1">Lv.{c.playerLevel}</span>
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400 text-xs">{new Date(c.createdAt).toLocaleString()}</span>
                      <button
                        onClick={() => setConfirmId(c.id)}
                        className="text-xs text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap">{c.body}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t text-sm">
            <span className="text-gray-500">Page {page} of {data.totalPages}</span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50"
              >
                Prev
              </button>
              <button
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmId}
        onOpenChange={(o) => !o && setConfirmId(null)}
        title="Delete comment"
        description="Permanently delete this comment?"
        onConfirm={() => confirmId && deleteMutation.mutate(confirmId)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

export function ForumPage() {
  const [category, setCategory] = useState<Category>('NEWS');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPost, setSelectedPost] = useState<ForumPost | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ForumPost | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-forum', category, page],
    queryFn: () =>
      api.get<PostsResponse>(`/admin/forum/posts?category=${category}&page=${page}&limit=20`),
  });

  const pinMutation = useMutation({
    mutationFn: ({ id, isPinned }: { id: string; isPinned: boolean }) =>
      api.patch<ForumPost>(`/admin/forum/posts/${id}/pin`, { isPinned }),
    onSuccess: () => { toast.success('Updated'); qc.invalidateQueries({ queryKey: ['admin-forum', category] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const closeMutation = useMutation({
    mutationFn: ({ id, isClosed }: { id: string; isClosed: boolean }) =>
      api.patch<ForumPost>(`/admin/forum/posts/${id}/close`, { isClosed }),
    onSuccess: () => { toast.success('Updated'); qc.invalidateQueries({ queryKey: ['admin-forum', category] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete<{ ok: true }>(`/admin/forum/posts/${id}`),
    onSuccess: () => {
      toast.success('Post deleted');
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ['admin-forum', category] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleCategoryChange = (cat: Category) => {
    setCategory(cat);
    setPage(1);
    setShowCreate(false);
  };

  return (
    <Layout>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Forum</h1>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {showCreate ? 'Cancel' : '+ Create Post'}
        </button>
      </div>

      <div className="flex gap-1 border-b mb-4">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => handleCategoryChange(cat)}
            className={cn(
              'px-4 py-2 text-sm',
              category === cat
                ? 'text-blue-600 font-medium border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-blue-600',
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {showCreate && (
        <CreatePostForm category={category} onClose={() => setShowCreate(false)} />
      )}

      {isLoading ? (
        <p className="text-gray-400">Loading…</p>
      ) : (
        <>
          <div className="rounded-md border bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-3 py-3 text-left font-medium text-gray-700 w-8">📌</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Title</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Author</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 text-center">💬</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.data.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                      No posts in {category}
                    </td>
                  </tr>
                ) : (
                  data?.data.map((post) => (
                    <tr key={post.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-3 py-3 text-center text-base">
                        {post.isPinned ? '📌' : ''}
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <button
                          onClick={() => setSelectedPost(post)}
                          className="text-blue-600 hover:underline text-left line-clamp-1"
                          title={post.title}
                        >
                          {post.title}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {post.playerName}
                        <span className="text-gray-400 ml-1 text-xs">Lv.{post.playerLevel}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">{post.commentCount}</td>
                      <td className="px-4 py-3">
                        {post.isClosed ? (
                          <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                            Closed
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs bg-green-50 text-green-700 rounded-full">
                            Open
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                        {new Date(post.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          <button
                            onClick={() => pinMutation.mutate({ id: post.id, isPinned: !post.isPinned })}
                            disabled={pinMutation.isPending}
                            className="px-2 py-1 text-xs bg-yellow-50 text-yellow-700 rounded hover:bg-yellow-100 disabled:opacity-50"
                          >
                            {post.isPinned ? 'Unpin' : 'Pin'}
                          </button>
                          <button
                            onClick={() => closeMutation.mutate({ id: post.id, isClosed: !post.isClosed })}
                            disabled={closeMutation.isPending}
                            className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                          >
                            {post.isClosed ? 'Open' : 'Close'}
                          </button>
                          <button
                            onClick={() => setDeleteTarget(post)}
                            className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <span className="text-gray-500">Page {page} of {data.totalPages}</span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-100"
                >
                  Previous
                </button>
                <button
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-100"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {selectedPost && (
        <CommentsModal post={selectedPost} onClose={() => setSelectedPost(null)} />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete post"
        description={`Delete "${deleteTarget?.title}"? Comments will be hidden.`}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        loading={deleteMutation.isPending}
      />
    </Layout>
  );
}

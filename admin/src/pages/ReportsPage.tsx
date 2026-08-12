import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Layout } from '../components/Layout';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { api } from '../lib/api';

type TargetType = 'CHAT_MESSAGE' | 'FORUM_POST' | 'FORUM_COMMENT';

interface ReportListItem {
  targetType: TargetType;
  targetId: string;
  playerName: string;
  preview: string;
  reportCount: number;
  createdAt: string;
  categories: Record<string, number>;
}

interface ReportDetail {
  targetType: TargetType;
  targetId: string;
  content: { playerName: string; body: string; title?: string };
  reports: { id: string; category: string; createdAt: string; reporter: { playerName: string } }[];
}

interface ReportsResponse {
  data: ReportListItem[];
  total: number;
  page: number;
  totalPages: number;
}

const TYPE_LABELS: Record<TargetType, string> = {
  CHAT_MESSAGE: 'CHAT',
  FORUM_POST: 'POST',
  FORUM_COMMENT: 'COMMENT',
};

const TYPE_COLORS: Record<TargetType, string> = {
  CHAT_MESSAGE: 'bg-blue-100 text-blue-700',
  FORUM_POST: 'bg-purple-100 text-purple-700',
  FORUM_COMMENT: 'bg-green-100 text-green-700',
};

function formatCategories(cats: Record<string, number>): string {
  return Object.entries(cats)
    .map(([k, v]) => `${k.toLowerCase()}×${v}`)
    .join(' ');
}

export function ReportsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-reports', page],
    queryFn: () => api.get<ReportsResponse>(`/admin/reports?page=${page}&limit=50`),
  });

  const detailKey = expandedKey;
  const { data: detail } = useQuery({
    queryKey: ['admin-report-detail', detailKey],
    queryFn: () => {
      if (!detailKey) return null;
      const [type, id] = detailKey.split('::');
      return api.get<ReportDetail>(`/admin/reports/${type}/${id}`);
    },
    enabled: !!detailKey,
  });

  const deleteMutation = useMutation({
    mutationFn: ({ targetType, targetId }: { targetType: TargetType; targetId: string }) =>
      api.delete<{ ok: true }>(`/admin/reports/${targetType}/${targetId}/content`),
    onSuccess: () => {
      toast.success('Content deleted');
      setExpandedKey(null);
      qc.invalidateQueries({ queryKey: ['admin-reports'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dismissMutation = useMutation({
    mutationFn: ({ targetType, targetId }: { targetType: TargetType; targetId: string }) =>
      api.post<{ ok: true }>(`/admin/reports/${targetType}/${targetId}/dismiss`, undefined),
    onSuccess: () => {
      toast.success('Reports dismissed');
      setExpandedKey(null);
      qc.invalidateQueries({ queryKey: ['admin-reports'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">Reports</h1>
          <span className="text-sm text-gray-500">{total} item{total !== 1 ? 's' : ''} with reports</span>
        </div>

        {isLoading && <div className="text-sm text-gray-500">Loading…</div>}

        {!isLoading && data?.data.length === 0 && (
          <div className="text-sm text-gray-500 py-8 text-center">No reported content.</div>
        )}

        <div className="space-y-2">
          {data?.data.map((item) => {
            const key = `${item.targetType}::${item.targetId}`;
            const isExpanded = expandedKey === key;

            return (
              <div key={key} className="border rounded-lg bg-white overflow-hidden">
                {/* Row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedKey(isExpanded ? null : key)}
                >
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${TYPE_COLORS[item.targetType]}`}>
                    {TYPE_LABELS[item.targetType]}
                  </span>
                  <span className="text-sm text-gray-600 shrink-0">{item.playerName}</span>
                  <span className="text-sm text-gray-400 flex-1 truncate">{item.preview}</span>
                  <span className="text-sm font-bold text-red-600 shrink-0">{item.reportCount}</span>
                  <span className="text-xs text-gray-400 shrink-0">{formatCategories(item.categories)}</span>
                  <div className="flex gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                    <button
                      className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100"
                      onClick={() => setConfirmAction({
                        title: 'Delete content?',
                        description: `This ${TYPE_LABELS[item.targetType].toLowerCase()} will be permanently deleted.`,
                        onConfirm: () => deleteMutation.mutate({ targetType: item.targetType, targetId: item.targetId }),
                      })}
                    >
                      Видалити
                    </button>
                    <button
                      className="text-xs px-2 py-1 bg-gray-50 text-gray-600 rounded hover:bg-gray-100"
                      onClick={() => setConfirmAction({
                        title: 'Dismiss reports?',
                        description: 'The content will be kept and all reports cleared.',
                        onConfirm: () => dismissMutation.mutate({ targetType: item.targetType, targetId: item.targetId }),
                      })}
                    >
                      Залишити
                    </button>
                  </div>
                  <span className="text-gray-400 text-sm">{isExpanded ? '▲' : '▼'}</span>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t px-4 py-3 bg-gray-50 space-y-3">
                    {detail && detail.targetId === item.targetId ? (
                      <>
                        <div className="bg-white border rounded p-3">
                          {detail.content.title && (
                            <p className="font-semibold text-sm mb-1">{detail.content.title}</p>
                          )}
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{detail.content.body}</p>
                          <p className="text-xs text-gray-400 mt-1">by {detail.content.playerName}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-gray-500">Individual reports ({detail.reports.length})</p>
                          {detail.reports.map(r => (
                            <div key={r.id} className="flex gap-3 text-xs text-gray-500">
                              <span className="font-medium text-gray-700">{r.reporter.playerName}</span>
                              <span className="uppercase">{r.category}</span>
                              <span>{new Date(r.createdAt).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-gray-400">Loading details…</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex gap-2 justify-center pt-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-40"
            >
              ‹ Prev
            </button>
            <span className="px-3 py-1 text-sm text-gray-500">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-40"
            >
              Next ›
            </button>
          </div>
        )}
      </div>

      {confirmAction && (
        <ConfirmDialog
          open={!!confirmAction}
          onOpenChange={(open) => { if (!open) setConfirmAction(null); }}
          title={confirmAction.title}
          description={confirmAction.description}
          onConfirm={() => { confirmAction.onConfirm(); setConfirmAction(null); }}
        />
      )}
    </Layout>
  );
}

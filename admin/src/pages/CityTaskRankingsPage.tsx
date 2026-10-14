import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { api } from '../lib/api';
import { cn } from '../lib/utils';

type WeekStatus = 'CURRENT' | 'PENDING' | 'OVERDUE' | 'APPROVED';

interface WeekSummary {
  weekStart: string;
  status: WeekStatus;
  rankingId?: string;
}

interface PreviewEntry {
  cityId: string;
  cityName: string;
  rank: number;
  totalTickets: number;
  baseReward: number;
  placementBonus: number;
  superBonus: number;
  totalReward: number;
}

const STATUS_LABELS: Record<WeekStatus, string> = {
  CURRENT:  'Current week',
  PENDING:  'Awaiting approval',
  OVERDUE:  'Overdue',
  APPROVED: 'Approved & Paid',
};

const STATUS_COLORS: Record<WeekStatus, string> = {
  CURRENT:  'bg-blue-100 text-blue-700',
  PENDING:  'bg-yellow-100 text-yellow-700',
  OVERDUE:  'bg-red-100 text-red-700',
  APPROVED: 'bg-green-100 text-green-700',
};

const PLACEMENT_BONUSES: Record<number, number> = {
  1: 2000, 2: 1900, 3: 1800,
  4: 1600, 5: 1500, 6: 1400,
  7: 1300, 8: 1200, 9: 1100, 10: 1000,
};

function fmtWeek(iso: string) {
  const d = new Date(iso);
  const mon = d;
  const fri = new Date(d.getTime() + 4 * 86_400_000);
  const fmt = (x: Date) => x.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  return `${fmt(mon)} – ${fmt(fri)}`;
}

export function CityTaskRankingsPage() {
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const qc = useQueryClient();

  const { data: weeks, isLoading: weeksLoading } = useQuery<WeekSummary[]>({
    queryKey: ['admin-city-task-ranking-weeks'],
    queryFn: () => api.get('/admin/city-task-rankings'),
  });

  const { data: preview, isLoading: previewLoading } = useQuery<PreviewEntry[]>({
    queryKey: ['admin-city-task-ranking-preview', selectedWeek],
    queryFn: () => api.get(`/admin/city-task-rankings/preview?weekStart=${encodeURIComponent(selectedWeek!)}`),
    enabled: !!selectedWeek,
  });

  const selectedStatus = weeks?.find((w) => w.weekStart === selectedWeek)?.status;

  const approveMutation = useMutation({
    mutationFn: (weekStart: string) => api.post('/admin/city-task-rankings/approve', { weekStart }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-city-task-ranking-weeks'] });
      qc.invalidateQueries({ queryKey: ['admin-city-task-ranking-preview', selectedWeek] });
      setConfirmOpen(false);
    },
  });

  const totalRewardSum = preview?.reduce((s, e) => s + e.totalReward, 0) ?? 0;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">City Tasks — Weekly Rankings</h1>

        <div className="flex gap-6">
          {/* Week list */}
          <div className="w-72 shrink-0">
            <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Weeks</h2>
            {weeksLoading ? (
              <p className="text-gray-400 text-sm">Loading…</p>
            ) : (
              <div className="flex flex-col gap-1">
                {weeks?.map((w) => (
                  <button
                    key={w.weekStart}
                    onClick={() => setSelectedWeek(w.weekStart)}
                    className={cn(
                      'text-left px-3 py-2.5 rounded-lg border text-sm transition-colors',
                      selectedWeek === w.weekStart
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:bg-gray-50',
                    )}
                  >
                    <div className="font-medium text-gray-800">{fmtWeek(w.weekStart)}</div>
                    <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium mt-0.5 inline-block', STATUS_COLORS[w.status])}>
                      {STATUS_LABELS[w.status]}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Preview / detail */}
          <div className="flex-1">
            {!selectedWeek ? (
              <div className="bg-white border rounded-xl p-8 text-center text-gray-400">
                Select a week to preview the ranking
              </div>
            ) : previewLoading ? (
              <p className="text-gray-400">Loading…</p>
            ) : !preview || preview.length === 0 ? (
              <div className="bg-white border rounded-xl p-8 text-center text-gray-400">
                No ticket data for this week yet.
              </div>
            ) : (
              <div className="bg-white border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-gray-800">{fmtWeek(selectedWeek)}</span>
                    <span className={cn('ml-2 text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[selectedStatus ?? 'CURRENT'])}>
                      {STATUS_LABELS[selectedStatus ?? 'CURRENT']}
                    </span>
                  </div>
                  {(selectedStatus === 'PENDING' || selectedStatus === 'OVERDUE') && (
                    <button
                      onClick={() => setConfirmOpen(true)}
                      className="px-4 py-1.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Approve & Pay Out
                    </button>
                  )}
                </div>

                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-2 text-left">Rank</th>
                      <th className="px-4 py-2 text-left">City</th>
                      <th className="px-4 py-2 text-right">🎫 Tickets</th>
                      <th className="px-4 py-2 text-right">Base</th>
                      <th className="px-4 py-2 text-right">Placement</th>
                      <th className="px-4 py-2 text-right">Super</th>
                      <th className="px-4 py-2 text-right font-semibold">Total 💎</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {preview.map((e) => (
                      <tr key={e.cityId} className={cn('hover:bg-gray-50', e.rank <= 3 && 'bg-yellow-50/40')}>
                        <td className="px-4 py-2.5 font-bold text-gray-700">
                          {e.rank <= 3 ? ['🥇','🥈','🥉'][e.rank - 1] : `#${e.rank}`}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-gray-800">{e.cityName}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{e.totalTickets.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">+{e.baseReward.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right text-blue-600">
                          {e.placementBonus > 0 ? `+${e.placementBonus.toLocaleString()}` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right text-purple-600">
                          {e.superBonus > 0 ? `+${e.superBonus.toLocaleString()}` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-green-700">
                          {e.totalReward.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t">
                    <tr>
                      <td colSpan={6} className="px-4 py-2 text-right text-sm font-semibold text-gray-600">
                        Total payout
                      </td>
                      <td className="px-4 py-2 text-right font-bold text-green-700">
                        {totalRewardSum.toLocaleString()} 💎
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {/* Super bonus legend */}
                <div className="px-4 py-3 border-t bg-gray-50 text-xs text-gray-500 flex gap-4">
                  <span>⭐ ≥250 tickets → +500 💎</span>
                  <span>⭐⭐ ≥500 tickets → +5,000 💎</span>
                  {Object.entries(PLACEMENT_BONUSES).slice(0, 3).map(([r, b]) => (
                    <span key={r}>#{r} → +{Number(b).toLocaleString()} 💎</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirm dialog */}
      {confirmOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Approve & Pay Out?</h3>
            <p className="text-sm text-gray-600 mb-1">Week: <strong>{fmtWeek(selectedWeek!)}</strong></p>
            <p className="text-sm text-gray-600 mb-4">
              This will add <strong>{totalRewardSum.toLocaleString()} 💎</strong> to city budgets.
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => approveMutation.mutate(selectedWeek!)}
                disabled={approveMutation.isPending}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
              >
                {approveMutation.isPending ? 'Processing…' : 'Confirm Payout'}
              </button>
            </div>
            {approveMutation.isError && (
              <p className="text-red-500 text-xs mt-2">{String((approveMutation.error as Error)?.message)}</p>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}

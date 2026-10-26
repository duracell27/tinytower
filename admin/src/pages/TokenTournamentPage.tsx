import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { api } from '../lib/api';
import { cn } from '../lib/utils';

type WeekStatus = 'CURRENT' | 'PENDING' | 'PUBLISHED';

interface TournamentWeekSummary {
  weekStart: string;
  status: WeekStatus;
  participants: number;
}

interface LeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  playerLevel: number;
  tokenCount: number;
  gemsReward: number;
  bonusTokens: number;
  coinsReward: number;
}

interface LeaderboardDto {
  weekStart: string;
  alreadyPublished: boolean;
  totalParticipants: number;
  entries: LeaderboardEntry[];
}

const STATUS_LABELS: Record<WeekStatus, string> = {
  CURRENT:   'Current week',
  PENDING:   'Awaiting publish',
  PUBLISHED: 'Published',
};

const STATUS_COLORS: Record<WeekStatus, string> = {
  CURRENT:   'bg-blue-100 text-blue-700',
  PENDING:   'bg-yellow-100 text-yellow-700',
  PUBLISHED: 'bg-green-100 text-green-700',
};

function fmtWeek(iso: string) {
  const d = new Date(iso);
  const fri = new Date(d.getTime() + 4 * 86_400_000);
  const fmt = (x: Date) => x.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  return `${fmt(d)} – ${fmt(fri)}`;
}

export function TokenTournamentPage() {
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const qc = useQueryClient();

  const { data: weeks, isLoading: weeksLoading } = useQuery<TournamentWeekSummary[]>({
    queryKey: ['admin-token-tournament-weeks'],
    queryFn: () => api.get('/admin/tournament/tokens/weeks'),
  });

  const { data, isLoading: leaderboardLoading } = useQuery<LeaderboardDto>({
    queryKey: ['admin-token-tournament', selectedWeek],
    queryFn: () => api.get(`/admin/tournament/tokens/leaderboard?weekStart=${encodeURIComponent(selectedWeek!)}`),
    enabled: !!selectedWeek,
  });

  const publishMutation = useMutation({
    mutationFn: (weekStart: string) => api.post('/admin/tournament/tokens/result', { weekStart }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-token-tournament-weeks'] });
      qc.invalidateQueries({ queryKey: ['admin-token-tournament', selectedWeek] });
      setConfirmOpen(false);
    },
  });

  const selectedStatus = weeks?.find((w) => w.weekStart === selectedWeek)?.status;
  const canPublish = data && !data.alreadyPublished && data.totalParticipants > 0 && selectedStatus === 'PENDING';

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Token Tournament</h1>

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
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', STATUS_COLORS[w.status])}>
                        {STATUS_LABELS[w.status]}
                      </span>
                      {w.participants > 0 && (
                        <span className="text-xs text-gray-400">{w.participants} players</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Leaderboard detail */}
          <div className="flex-1">
            {!selectedWeek ? (
              <div className="bg-white border rounded-xl p-8 text-center text-gray-400">
                Select a week to view the leaderboard
              </div>
            ) : leaderboardLoading ? (
              <p className="text-gray-400">Loading…</p>
            ) : !data || data.entries.length === 0 ? (
              <div className="bg-white border rounded-xl p-8 text-center text-gray-400">
                No token data for this week.
              </div>
            ) : (
              <div className="bg-white border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-800">{fmtWeek(selectedWeek)}</span>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[selectedStatus ?? 'CURRENT'])}>
                      {STATUS_LABELS[selectedStatus ?? 'CURRENT']}
                    </span>
                    <span className="text-sm text-gray-500">{data.totalParticipants} participants</span>
                  </div>
                  {canPublish && (
                    <button
                      onClick={() => setConfirmOpen(true)}
                      className="px-4 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Publish Results
                    </button>
                  )}
                </div>

                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-2 text-left">Rank</th>
                      <th className="px-4 py-2 text-left">Player</th>
                      <th className="px-4 py-2 text-center">Lvl</th>
                      <th className="px-4 py-2 text-right">🔑 Tokens</th>
                      <th className="px-4 py-2 text-right">💎 Gems</th>
                      <th className="px-4 py-2 text-right">Bonus 🔑</th>
                      <th className="px-4 py-2 text-right">🪙 Coins</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.entries.map((e) => (
                      <tr key={e.playerId} className={cn('hover:bg-gray-50', e.rank <= 3 && 'bg-yellow-50/40')}>
                        <td className="px-4 py-2.5 font-bold text-gray-700">
                          {e.rank <= 3 ? ['🥇', '🥈', '🥉'][e.rank - 1] : `#${e.rank}`}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-gray-800">{e.playerName}</td>
                        <td className="px-4 py-2.5 text-center text-gray-600">{e.playerLevel}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{e.tokenCount.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right text-blue-600">
                          {e.gemsReward > 0 ? `+${e.gemsReward.toLocaleString()}` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right text-purple-600">
                          {e.bonusTokens > 0 ? `+${e.bonusTokens}` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-green-700">
                          +{e.coinsReward.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirm dialog */}
      {confirmOpen && data && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Publish Tournament Results?</h3>
            <p className="text-sm text-gray-600 mb-1">Week: <strong>{fmtWeek(selectedWeek!)}</strong></p>
            <p className="text-sm text-gray-600 mb-4">
              This will send in-game mail to <strong>{data.totalParticipants}</strong> participants and distribute rewards.
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
                onClick={() => publishMutation.mutate(selectedWeek!)}
                disabled={publishMutation.isPending}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {publishMutation.isPending ? 'Publishing…' : 'Confirm'}
              </button>
            </div>
            {publishMutation.isError && (
              <p className="text-red-500 text-xs mt-2">{String((publishMutation.error as Error)?.message)}</p>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { api } from '../lib/api';
import { cn } from '../lib/utils';

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

function currentWeekStart(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 1=Mon, …
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((day + 6) % 7)));
  return monday.toISOString();
}

function fmtWeek(iso: string) {
  const d = new Date(iso);
  const fri = new Date(d.getTime() + 4 * 86_400_000);
  const fmt = (x: Date) => x.toUTCString().slice(5, 11);
  return `${fmt(d)} – ${fmt(fri)}`;
}

function WeekPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const weeks: string[] = [];
  const start = new Date(currentWeekStart());
  for (let i = 0; i < 8; i++) {
    weeks.push(new Date(start.getTime() - i * 7 * 86_400_000).toISOString());
  }
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {weeks.map((w) => (
        <option key={w} value={w}>
          {fmtWeek(w)}
        </option>
      ))}
    </select>
  );
}

export function TokenTournamentPage() {
  const [selectedWeek, setSelectedWeek] = useState<string>(currentWeekStart());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery<LeaderboardDto>({
    queryKey: ['admin-token-tournament', selectedWeek],
    queryFn: () => api.get(`/admin/tournament/tokens/leaderboard?weekStart=${encodeURIComponent(selectedWeek)}`),
    enabled: !!selectedWeek,
  });

  const publishMutation = useMutation({
    mutationFn: (weekStart: string) => api.post('/admin/tournament/tokens/result', { weekStart }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-token-tournament', selectedWeek] });
      setConfirmOpen(false);
    },
  });

  const canPublish = data && !data.alreadyPublished && data.totalParticipants > 0;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Token Tournament</h1>
          <WeekPicker value={selectedWeek} onChange={setSelectedWeek} />
        </div>

        {isLoading ? (
          <p className="text-gray-400">Loading…</p>
        ) : error ? (
          <p className="text-red-500 text-sm">{String((error as Error).message)}</p>
        ) : !data || data.entries.length === 0 ? (
          <div className="bg-white border rounded-xl p-8 text-center text-gray-400">
            No token data for this week.
          </div>
        ) : (
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-gray-800">{fmtWeek(selectedWeek)}</span>
                <span className="text-sm text-gray-500">{data.totalParticipants} participants</span>
                {data.alreadyPublished && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                    Published
                  </span>
                )}
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

      {confirmOpen && data && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Publish Tournament Results?</h3>
            <p className="text-sm text-gray-600 mb-1">Week: <strong>{fmtWeek(selectedWeek)}</strong></p>
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
                onClick={() => publishMutation.mutate(selectedWeek)}
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

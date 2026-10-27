import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { api } from '../lib/api';

interface MonthEntry {
  key: string;
  year: number;
  month: number;
  status: 'ok' | 'missing' | 'upcoming';
  citiesCount: number;
  totalXp: number;
}

function fmtMonth(year: number, month: number) {
  return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function fmtXp(xp: number) {
  if (xp >= 1_000_000_000) return `${(xp / 1_000_000_000).toFixed(1)}b`;
  if (xp >= 1_000_000) return `${(xp / 1_000_000).toFixed(1)}m`;
  if (xp >= 1_000) return `${(xp / 1_000).toFixed(1)}k`;
  return String(xp);
}

const STATUS_BADGE: Record<MonthEntry['status'], { label: string; cls: string }> = {
  ok:       { label: '✅ OK',      cls: 'bg-green-100 text-green-800' },
  missing:  { label: '❌ Missing', cls: 'bg-red-100 text-red-800' },
  upcoming: { label: '⏳ Upcoming', cls: 'bg-gray-100 text-gray-600' },
};

export function CronMonitorPage() {
  const qc = useQueryClient();
  const [runResult, setRunResult] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['cron-city-xp'],
    queryFn: () => api.get<{ months: MonthEntry[] }>('/admin/cron/city-xp-monthly'),
  });

  const runNow = useMutation({
    mutationFn: () => api.post('/admin/cron/city-xp-monthly/run', {}),
    onSuccess: () => {
      setRunResult('Cron executed. Refreshing…');
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['cron-city-xp'] });
        setRunResult(null);
      }, 1500);
    },
    onError: (e: Error) => setRunResult(`Error: ${e.message}`),
  });

  const months = data?.months ?? [];
  const missing = months.filter((m) => m.status === 'missing');
  const ok = months.filter((m) => m.status === 'ok');

  return (
    <Layout>
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">City XP Monthly Cron</h1>
            <p className="text-sm text-gray-500 mt-1">
              Runs on the 1st of each month at 00:05 UTC. Snapshots total city XP gained per month.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={() => runNow.mutate()}
              disabled={runNow.isPending}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {runNow.isPending ? 'Running…' : 'Run now'}
            </button>
            {runResult && <span className="text-xs text-gray-600">{runResult}</span>}
          </div>
        </div>

        {/* Summary row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white border rounded-lg p-4">
            <div className="text-2xl font-bold text-green-700">{ok.length}</div>
            <div className="text-xs text-gray-500 mt-1">Months executed</div>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <div className="text-2xl font-bold text-red-600">{missing.length}</div>
            <div className="text-xs text-gray-500 mt-1">Months missing</div>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <div className="text-2xl font-bold text-gray-700">{months.length}</div>
            <div className="text-xs text-gray-500 mt-1">Total expected</div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cities</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total XP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-400">Loading…</td>
                </tr>
              )}
              {!isLoading && months.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-400">No cities exist yet</td>
                </tr>
              )}
              {months.map((m) => {
                const badge = STATUS_BADGE[m.status];
                return (
                  <tr key={m.key} className={m.status === 'missing' ? 'bg-red-50' : ''}>
                    <td className="px-4 py-3 font-medium text-gray-800">{fmtMonth(m.year, m.month)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {m.status === 'ok' ? m.citiesCount : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">
                      {m.status === 'ok' ? fmtXp(m.totalXp) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}

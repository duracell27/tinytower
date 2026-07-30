import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { Layout } from '../components/Layout';
import { DataTable, Pagination } from '../components/DataTable';
import { api } from '../lib/api';
import type { CommandLogItem, PlayerListItem, PaginatedResponse } from '../types';

const COMMAND_TYPES = [
  'buy', 'list', 'collect', 'assign_worker', 'fire_worker', 'evict_worker',
  'upgrade_to_specialist', 'fire_and_evict_worker', 'spawn_visitor', 'lift_visitor',
  'collect_tip', 'deliver_all', 'upgrade_elevator', 'upgrade_lobby', 'claim_daily_reward',
  'expand_hotel', 'fill_lobby', 'buy_floor', 'open_floor', 'exchange_gems',
  'speed_up_construction', 'speed_up_delivery', 'dev_add_gems', 'evict_low_level_workers',
  'collect_all', 'list_all', 'buy_all', 'claim_daily_task', 'upgrade_business_category',
];

export function CommandLogsPage() {
  const [page, setPage] = useState(1);
  const [playerId, setPlayerId] = useState('');
  const [type, setType] = useState('');

  const { data: playersData } = useQuery({
    queryKey: ['admin-players-all'],
    queryFn: () => api.get<PaginatedResponse<PlayerListItem>>('/admin/players?limit=200'),
    staleTime: 60_000,
  });

  const buildUrl = () => {
    const params = new URLSearchParams({ page: String(page), limit: '50' });
    if (playerId) params.set('playerId', playerId);
    if (type) params.set('type', type);
    return `/admin/commands?${params.toString()}`;
  };

  const { data, isLoading } = useQuery({
    queryKey: ['admin-commands', page, playerId, type],
    queryFn: () => api.get<PaginatedResponse<CommandLogItem>>(buildUrl()),
  });

  const columns: ColumnDef<CommandLogItem, any>[] = [
    { accessorKey: 'playerName', header: 'Player' },
    { accessorKey: 'type', header: 'Type' },
    {
      accessorKey: 'floorId',
      header: 'Floor',
      cell: ({ getValue }) => getValue() ?? '—',
    },
    {
      accessorKey: 'typeId',
      header: 'TypeId',
      cell: ({ getValue }) => getValue() ?? '—',
    },
    {
      accessorKey: 'workerId',
      header: 'Worker',
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v ? v.slice(0, 8) + '…' : '—';
      },
    },
    {
      accessorKey: 'timestamp',
      header: 'Client Time',
      cell: ({ getValue }) => new Date(Number(getValue())).toLocaleString(),
    },
    {
      accessorKey: 'processedAt',
      header: 'Server Time',
      cell: ({ getValue }) => new Date(getValue()).toLocaleString(),
    },
  ];

  const selectClass = 'border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <Layout>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-xl font-semibold">Command Logs</h1>
        <div className="flex gap-3 flex-wrap">
          <select
            value={playerId}
            onChange={(e) => { setPlayerId(e.target.value); setPage(1); }}
            className={selectClass}
          >
            <option value="">All players</option>
            {playersData?.data.map((p) => (
              <option key={p.id} value={p.id}>{p.playerName}</option>
            ))}
          </select>
          <select
            value={type}
            onChange={(e) => { setType(e.target.value); setPage(1); }}
            className={selectClass}
          >
            <option value="">All types</option>
            {COMMAND_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-gray-400">Loading…</p>
      ) : (
        <>
          <DataTable columns={columns} data={data?.data ?? []} />
          <Pagination
            page={page}
            totalPages={data?.totalPages ?? 1}
            onPageChange={setPage}
          />
        </>
      )}
    </Layout>
  );
}

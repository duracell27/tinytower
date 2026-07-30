import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { type ColumnDef } from '@tanstack/react-table';
import { Layout } from '../components/Layout';
import { DataTable, Pagination } from '../components/DataTable';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { api } from '../lib/api';
import type { PlayerListItem, PaginatedResponse } from '../types';

export function PlayersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<PlayerListItem | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    clearTimeout((handleSearchChange as any)._t);
    (handleSearchChange as any)._t = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 300);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-players', page, debouncedSearch],
    queryFn: () =>
      api.get<PaginatedResponse<PlayerListItem>>(
        `/admin/players?page=${page}&limit=20${debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ''}`,
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete<{ ok: true }>(`/admin/players/${id}`),
    onSuccess: () => {
      toast.success('Player deleted');
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ['admin-players'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: ColumnDef<PlayerListItem, any>[] = [
    { accessorKey: 'playerName', header: 'Name' },
    { accessorKey: 'email', header: 'Email' },
    { accessorKey: 'playerLevel', header: 'Level' },
    { accessorKey: 'balance', header: 'Coins' },
    { accessorKey: 'gems', header: 'Gems' },
    {
      accessorKey: 'isAdmin',
      header: 'Admin',
      cell: ({ getValue }) => (getValue() ? '✓' : ''),
    },
    {
      accessorKey: 'lastSeenAt',
      header: 'Last Seen',
      cell: ({ getValue }) => new Date(getValue()).toLocaleDateString(),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/players/${row.original.id}`)}
            className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
          >
            View
          </button>
          <button
            onClick={() => setDeleteTarget(row.original)}
            className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100"
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <Layout>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Players</h1>
        <input
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search by name or email…"
          className="border rounded px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
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

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete player"
        description={`Permanently delete "${deleteTarget?.playerName}"? This cannot be undone.`}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        loading={deleteMutation.isPending}
      />
    </Layout>
  );
}

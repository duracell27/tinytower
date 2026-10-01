import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import { Layout } from '../components/Layout';
import { api } from '../lib/api';
import type { CityListItem, CityDetail, PaginatedResponse } from '../types';

function BudgetBadges({ budget }: { budget: CityListItem['budget'] }) {
  const items = [
    { label: 'coins', val: budget.coins },
    { label: 'gems', val: budget.gems },
    { label: 'briks', val: budget.briks },
    { label: 'glass', val: budget.glass },
    { label: 'nails', val: budget.nails },
    { label: 'screw', val: budget.screw },
  ].filter((i) => i.val > 0);

  if (!items.length) return <span className="text-gray-300 text-xs">—</span>;
  return (
    <div className="flex gap-1 flex-wrap">
      {items.map((i) => (
        <span key={i.label} className="px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
          {i.label}: {i.val.toLocaleString()}
        </span>
      ))}
    </div>
  );
}

function CityDetailModal({ cityId, open, onClose }: { cityId: string; open: boolean; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-city', cityId],
    queryFn: () => api.get<CityDetail>(`/admin/cities/${cityId}`),
    enabled: open,
  });

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] overflow-y-auto p-6">
          {isLoading || !data ? (
            <p className="text-gray-400">Loading…</p>
          ) : (
            <>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <Dialog.Title className="text-lg font-semibold">{data.name}</Dialog.Title>
                  {data.description && <p className="text-sm text-gray-500 mt-0.5">{data.description}</p>}
                  <p className="text-xs text-gray-400 mt-1">XP: {data.cityXp.toLocaleString()} · Created {new Date(data.createdAt).toLocaleDateString()}</p>
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
              </div>

              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Budget</p>
                <BudgetBadges budget={data.budget} />
              </div>

              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Buildings ({data.buildings.length})</p>
                {data.buildings.length === 0 ? (
                  <p className="text-gray-400 text-sm">No buildings</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {data.buildings.map((b) => (
                      <div key={b.buildingType} className="border rounded px-3 py-2 text-xs">
                        <p className="font-medium text-gray-700">{b.buildingType}</p>
                        <p className="text-gray-500">Level {b.level} · <span className={
                          b.state === 'ACTIVE' ? 'text-green-600' :
                          b.state === 'BUILDING' ? 'text-yellow-600' : 'text-gray-400'
                        }>{b.state}</span></p>
                        {b.buildFinishesAt && (
                          <p className="text-gray-400">Finishes: {new Date(b.buildFinishesAt).toLocaleString()}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Members ({data.members.length})</p>
                <div className="rounded-md border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="px-3 py-2 text-left font-medium text-gray-700">Player</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700">Level</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700">Role</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700">City XP</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.members.map((m) => (
                        <tr key={m.playerId} className="border-b last:border-0">
                          <td className="px-3 py-2">{m.playerName}</td>
                          <td className="px-3 py-2">{m.playerLevel}</td>
                          <td className="px-3 py-2">
                            <span className={`px-1.5 py-0.5 rounded text-xs ${
                              m.role === 'LEADER' ? 'bg-yellow-100 text-yellow-700' :
                              m.role === 'OFFICER' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>{m.role}</span>
                          </td>
                          <td className="px-3 py-2">{m.cityXp.toLocaleString()}</td>
                          <td className="px-3 py-2 text-xs text-gray-500">{new Date(m.joinedAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function CitiesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    clearTimeout((handleSearchChange as any)._t);
    (handleSearchChange as any)._t = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 300);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['admin-cities', page, debouncedSearch],
    queryFn: () =>
      api.get<PaginatedResponse<CityListItem>>(
        `/admin/cities?page=${page}&limit=20${debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ''}`,
      ),
  });

  return (
    <Layout>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Cities</h1>
        <input
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search by name…"
          className="border rounded px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {isLoading ? (
        <p className="text-gray-400">Loading…</p>
      ) : !data?.data.length ? (
        <p className="text-gray-400">No cities found</p>
      ) : (
        <>
          <div className="rounded-md border bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Members</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Buildings</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">City XP</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Budget</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Created</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((city) => (
                  <tr key={city.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{city.name}</td>
                    <td className="px-4 py-3">{city.memberCount}</td>
                    <td className="px-4 py-3">{city.buildingCount}</td>
                    <td className="px-4 py-3">{city.cityXp.toLocaleString()}</td>
                    <td className="px-4 py-3"><BudgetBadges budget={city.budget} /></td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(city.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedCityId(city.id)}
                        className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.totalPages > 1 && (
            <div className="flex items-center gap-2 mt-4 text-sm">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border rounded disabled:opacity-40"
              >
                ←
              </button>
              <span className="text-gray-500">{page} / {data.totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page === data.totalPages}
                className="px-3 py-1 border rounded disabled:opacity-40"
              >
                →
              </button>
            </div>
          )}
        </>
      )}

      {selectedCityId && (
        <CityDetailModal
          cityId={selectedCityId}
          open={!!selectedCityId}
          onClose={() => setSelectedCityId(null)}
        />
      )}
    </Layout>
  );
}

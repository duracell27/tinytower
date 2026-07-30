import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as Tabs from '@radix-ui/react-tabs';
import { toast } from 'sonner';
import { Layout } from '../components/Layout';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import type { PlayerDetail, WorkerItem, FloorItem } from '../types';

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn('w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500', className)}
    />
  );
}

function SaveButton({ loading }: { loading: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
    >
      {loading ? 'Saving…' : 'Save'}
    </button>
  );
}

// --- Info Tab ---
const InfoSchema = z.object({
  playerName: z.string().min(3).max(30),
  email: z.string().email(),
  playerLevel: z.coerce.number().int().positive(),
  playerXp: z.coerce.number().int().nonnegative(),
  isAdmin: z.boolean(),
});
type InfoForm = z.infer<typeof InfoSchema>;

function InfoTab({ player, playerId }: { player: PlayerDetail; playerId: string }) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<InfoForm>({
    resolver: zodResolver(InfoSchema),
    defaultValues: {
      playerName: player.playerName,
      email: player.email,
      playerLevel: player.playerLevel,
      playerXp: player.playerXp,
      isAdmin: player.isAdmin,
    },
  });

  const onSubmit = async (data: InfoForm) => {
    try {
      await api.patch(`/admin/players/${playerId}/info`, data);
      toast.success('Info updated');
      qc.invalidateQueries({ queryKey: ['admin-player', playerId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
      <Field label="Player Name" error={errors.playerName?.message}>
        <Input {...register('playerName')} />
      </Field>
      <Field label="Email" error={errors.email?.message}>
        <Input {...register('email')} type="email" />
      </Field>
      <Field label="Level" error={errors.playerLevel?.message}>
        <Input {...register('playerLevel')} type="number" />
      </Field>
      <Field label="XP" error={errors.playerXp?.message}>
        <Input {...register('playerXp')} type="number" />
      </Field>
      <div className="flex items-center gap-2">
        <input type="checkbox" {...register('isAdmin')} id="isAdmin" />
        <label htmlFor="isAdmin" className="text-sm">Admin</label>
      </div>
      <SaveButton loading={isSubmitting} />
    </form>
  );
}

// --- Economy Tab ---
const EconomySchema = z.object({
  balance: z.coerce.number().int().nonnegative(),
  gems: z.coerce.number().int().nonnegative(),
});
type EconomyForm = z.infer<typeof EconomySchema>;

function EconomyTab({ player, playerId }: { player: PlayerDetail; playerId: string }) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<EconomyForm>({
    resolver: zodResolver(EconomySchema),
    defaultValues: { balance: player.balance, gems: player.gems },
  });

  const onSubmit = async (data: EconomyForm) => {
    try {
      await api.patch(`/admin/players/${playerId}/economy`, data);
      toast.success('Economy updated');
      qc.invalidateQueries({ queryKey: ['admin-player', playerId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
      <Field label="Balance (coins)" error={errors.balance?.message}>
        <Input {...register('balance')} type="number" />
      </Field>
      <Field label="Gems" error={errors.gems?.message}>
        <Input {...register('gems')} type="number" />
      </Field>
      <SaveButton loading={isSubmitting} />
    </form>
  );
}

// --- Materials Tab ---
const MaterialsSchema = z.object({
  briks: z.coerce.number().int().nonnegative(),
  glass: z.coerce.number().int().nonnegative(),
  nails: z.coerce.number().int().nonnegative(),
  screw: z.coerce.number().int().nonnegative(),
});
type MaterialsForm = z.infer<typeof MaterialsSchema>;

function MaterialsTab({ player, playerId }: { player: PlayerDetail; playerId: string }) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<MaterialsForm>({
    resolver: zodResolver(MaterialsSchema),
    defaultValues: player.tools,
  });

  const onSubmit = async (data: MaterialsForm) => {
    try {
      await api.patch(`/admin/players/${playerId}/materials`, data);
      toast.success('Materials updated');
      qc.invalidateQueries({ queryKey: ['admin-player', playerId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
      {(['briks', 'glass', 'nails', 'screw'] as const).map((key) => (
        <Field key={key} label={key.charAt(0).toUpperCase() + key.slice(1)} error={errors[key]?.message}>
          <Input {...register(key)} type="number" />
        </Field>
      ))}
      <SaveButton loading={isSubmitting} />
    </form>
  );
}

// --- Tokens Tab ---
const TokensSchema = z.object({
  green: z.coerce.number().int().nonnegative(),
  blue: z.coerce.number().int().nonnegative(),
  yellow: z.coerce.number().int().nonnegative(),
  purple: z.coerce.number().int().nonnegative(),
  red: z.coerce.number().int().nonnegative(),
});
type TokensForm = z.infer<typeof TokensSchema>;

function TokensTab({ player, playerId }: { player: PlayerDetail; playerId: string }) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<TokensForm>({
    resolver: zodResolver(TokensSchema),
    defaultValues: player.tokens,
  });

  const onSubmit = async (data: TokensForm) => {
    try {
      await api.patch(`/admin/players/${playerId}/tokens`, data);
      toast.success('Tokens updated');
      qc.invalidateQueries({ queryKey: ['admin-player', playerId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
      {(['green', 'blue', 'yellow', 'purple', 'red'] as const).map((color) => (
        <Field key={color} label={color.charAt(0).toUpperCase() + color.slice(1)} error={errors[color]?.message}>
          <Input {...register(color)} type="number" />
        </Field>
      ))}
      <SaveButton loading={isSubmitting} />
    </form>
  );
}

// --- Workers Tab (placeholder for Task 8) ---
function WorkersTab({ workers, playerId }: { workers: WorkerItem[]; playerId: string }) {
  return <p className="text-gray-400 text-sm">Workers tab — implemented in Task 8</p>;
}

// --- Floors Tab (placeholder for Task 8) ---
function FloorsTab({ floors, playerId }: { floors: FloorItem[]; playerId: string }) {
  return <p className="text-gray-400 text-sm">Floors tab — implemented in Task 8</p>;
}

// --- Main Page ---
const TAB_ITEMS = [
  { value: 'info', label: 'Info' },
  { value: 'economy', label: 'Economy' },
  { value: 'materials', label: 'Materials' },
  { value: 'tokens', label: 'Tokens' },
  { value: 'workers', label: 'Workers' },
  { value: 'floors', label: 'Floors' },
];

export function PlayerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: player, isLoading } = useQuery({
    queryKey: ['admin-player', id],
    queryFn: () => api.get<PlayerDetail>(`/admin/players/${id}`),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete<{ ok: true }>(`/admin/players/${id}`),
    onSuccess: () => {
      toast.success('Player deleted');
      qc.invalidateQueries({ queryKey: ['admin-players'] });
      navigate('/players');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <Layout><p className="text-gray-400">Loading…</p></Layout>;
  if (!player) return <Layout><p className="text-red-500">Player not found</p></Layout>;

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => navigate('/players')} className="text-sm text-gray-500 hover:text-blue-600 mb-1">
            ← Players
          </button>
          <h1 className="text-xl font-semibold">{player.playerName}</h1>
          <p className="text-sm text-gray-500">{player.email} · Level {player.playerLevel}</p>
        </div>
        <button
          onClick={() => setConfirmDelete(true)}
          className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700"
        >
          Delete Player
        </button>
      </div>

      <Tabs.Root defaultValue="info">
        <Tabs.List className="flex gap-1 border-b mb-6">
          {TAB_ITEMS.map((tab) => (
            <Tabs.Trigger
              key={tab.value}
              value={tab.value}
              className="px-4 py-2 text-sm text-gray-600 hover:text-blue-600 data-[state=active]:text-blue-600 data-[state=active]:border-b-2 data-[state=active]:border-blue-600"
            >
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="info"><InfoTab player={player} playerId={id!} /></Tabs.Content>
        <Tabs.Content value="economy"><EconomyTab player={player} playerId={id!} /></Tabs.Content>
        <Tabs.Content value="materials"><MaterialsTab player={player} playerId={id!} /></Tabs.Content>
        <Tabs.Content value="tokens"><TokensTab player={player} playerId={id!} /></Tabs.Content>
        <Tabs.Content value="workers"><WorkersTab workers={player.workers} playerId={id!} /></Tabs.Content>
        <Tabs.Content value="floors"><FloorsTab floors={player.floors} playerId={id!} /></Tabs.Content>
      </Tabs.Root>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete player"
        description={`Permanently delete "${player.playerName}"? This cannot be undone.`}
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
      />
    </Layout>
  );
}

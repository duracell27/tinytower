import { act } from 'react';
import { useCityTaskStore } from '../cityTaskStore';
import { api } from '../../services/api';
import type { CityTaskSummary } from '../../services/api';

jest.mock('../../services/api', () => ({
  api: {
    fetchCityTasks: jest.fn(),
    joinCityTask: jest.fn(),
    collectCityTask: jest.fn(),
    cancelCityTask: jest.fn(),
  },
}));

const mockApi = api as jest.Mocked<typeof api>;

const makeTask = (id: string, status: CityTaskSummary['status'] = 'AVAILABLE'): CityTaskSummary => ({
  id,
  taskType: 'CARRIER',
  status,
  requiredCount: 100,
  currentProgress: 0,
  participants: [],
  takenAt: null,
  canDoubleUntil: null,
  rewardStars: null,
  finalStars: null,
});

beforeEach(() => {
  jest.clearAllMocks();
  useCityTaskStore.setState({ tasks: [], myActiveTaskId: null, cityStyleStars: 0, loading: false, error: null });
});

describe('setFromSync', () => {
  it('replaces tasks from sync payload', () => {
    const tasks = [makeTask('t1'), makeTask('t2')];
    act(() => useCityTaskStore.getState().setFromSync(tasks));
    expect(useCityTaskStore.getState().tasks).toHaveLength(2);
    expect(useCityTaskStore.getState().tasks[0].id).toBe('t1');
  });
});

describe('fetchTasks', () => {
  it('updates tasks, myActiveTaskId and cityStyleStars on success', async () => {
    mockApi.fetchCityTasks.mockResolvedValue({
      tasks: [makeTask('t1')],
      myActiveTaskId: 't1',
      cityStyleStars: 42,
    });
    await act(() => useCityTaskStore.getState().fetchTasks());
    const s = useCityTaskStore.getState();
    expect(s.tasks).toHaveLength(1);
    expect(s.myActiveTaskId).toBe('t1');
    expect(s.cityStyleStars).toBe(42);
    expect(s.loading).toBe(false);
  });

  it('sets error on failure', async () => {
    mockApi.fetchCityTasks.mockRejectedValue(new Error('Network error'));
    await act(() => useCityTaskStore.getState().fetchTasks());
    expect(useCityTaskStore.getState().error).toBe('Network error');
  });
});

describe('joinTask', () => {
  it('updates the joined task and sets myActiveTaskId', async () => {
    const existing = makeTask('t1');
    useCityTaskStore.setState({ tasks: [existing, makeTask('t2')], myActiveTaskId: null });
    const updated = { ...existing, status: 'IN_PROGRESS' as const, participants: [{ playerId: 'p1', progress: 0 }] };
    mockApi.joinCityTask.mockResolvedValue(updated);
    await act(() => useCityTaskStore.getState().joinTask('t1'));
    const s = useCityTaskStore.getState();
    expect(s.myActiveTaskId).toBe('t1');
    expect(s.tasks[0].status).toBe('IN_PROGRESS');
  });
});

describe('collectTask', () => {
  it('returns finalStars and refreshes tasks', async () => {
    mockApi.collectCityTask.mockResolvedValue({ finalStars: 8 });
    mockApi.fetchCityTasks.mockResolvedValue({ tasks: [], myActiveTaskId: null, cityStyleStars: 8 });
    const result = await act(() => useCityTaskStore.getState().collectTask('t1'));
    expect(result).toEqual({ finalStars: 8 });
    expect(mockApi.fetchCityTasks).toHaveBeenCalled();
  });
});

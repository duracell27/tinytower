import { act } from 'react';
import { useChatStore } from '../chatStore';
import { api } from '../../services/api';

jest.mock('../../services/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockApi = api as jest.Mocked<typeof api>;

const globalMessage = { id: 'm1', playerId: 'p1', playerName: 'Alice', playerLevel: 5,  country: null, body: 'Hello', createdAt: '2026-07-21T10:00:00Z' };
const uaMessage    = { id: 'm2', playerId: 'p2', playerName: 'Bob',   playerLevel: 12, country: 'UA', body: 'Hi',    createdAt: '2026-07-21T10:01:00Z' };

beforeEach(() => {
  jest.clearAllMocks();
  useChatStore.setState({ messages: [], isLoading: false, isSending: false, error: null });
});

describe('fetchMessages', () => {
  it('stores messages returned by server for global channel', async () => {
    // Server returns only null-country messages for global (no ?country param)
    mockApi.get.mockResolvedValue({ messages: [globalMessage] });
    await act(async () => { await useChatStore.getState().fetchMessages(); });
    expect(useChatStore.getState().messages).toEqual([globalMessage]);
  });

  it('stores messages returned by server for country channel', async () => {
    // Server returns only country-tagged messages for ?country=UA
    mockApi.get.mockResolvedValue({ messages: [uaMessage] });
    await act(async () => { await useChatStore.getState().fetchMessages('UA'); });
    expect(useChatStore.getState().messages).toEqual([uaMessage]);
  });

  it('silently ignores network errors', async () => {
    mockApi.get.mockRejectedValue(new Error('network'));
    await act(async () => { await useChatStore.getState().fetchMessages(); });
    expect(useChatStore.getState().messages).toEqual([]);
    expect(useChatStore.getState().error).toBeNull();
    expect(useChatStore.getState().isLoading).toBe(false);
  });
});

describe('sendMessage', () => {
  it('calls API post with country and refreshes messages', async () => {
    mockApi.post.mockResolvedValue({});
    mockApi.get.mockResolvedValue({ messages: [uaMessage] });
    await act(async () => {
      await useChatStore.getState().sendMessage('Hi', 'Bob', 12, 'UA');
    });
    expect(mockApi.post).toHaveBeenCalledWith('/chat/messages', { body: 'Hi', playerLevel: 12, country: 'UA' });
    expect(useChatStore.getState().isSending).toBe(false);
    expect(useChatStore.getState().messages).toEqual([uaMessage]);
  });

  it('calls API post without country for global channel', async () => {
    mockApi.post.mockResolvedValue({});
    mockApi.get.mockResolvedValue({ messages: [globalMessage] });
    await act(async () => {
      await useChatStore.getState().sendMessage('Hello', 'Alice', 5, undefined);
    });
    expect(mockApi.post).toHaveBeenCalledWith('/chat/messages', { body: 'Hello', playerLevel: 5 });
    expect(useChatStore.getState().messages).toEqual([globalMessage]);
  });

  it('sets error on failure', async () => {
    mockApi.post.mockRejectedValue(new Error('Cooldown'));
    await act(async () => {
      await useChatStore.getState().sendMessage('spam', 'Alice', 1, undefined).catch(() => {});
    });
    expect(useChatStore.getState().error).toBe('Cooldown');
    expect(useChatStore.getState().isSending).toBe(false);
  });
});

describe('deleteMessage', () => {
  it('removes message optimistically before API call', async () => {
    useChatStore.setState({ messages: [globalMessage, uaMessage] });
    mockApi.delete.mockResolvedValue({ success: true });
    mockApi.get.mockResolvedValue({ messages: [] });
    await act(async () => { await useChatStore.getState().deleteMessage('m1'); });
    const remaining = useChatStore.getState().messages;
    expect(remaining.find((m) => m.id === 'm1')).toBeUndefined();
    expect(mockApi.delete).toHaveBeenCalledWith('/chat/messages/m1');
  });
});

import { create } from 'zustand';
import { api, type MailMessage } from '../services/api';

interface MailState {
  unreadCount: number;
  mails: MailMessage[];
}

interface MailActions {
  fetchUnreadCount: () => Promise<void>;
  fetchInbox: () => Promise<void>;
  sendMail: (toId: string, subject: string, body: string) => Promise<void>;
  markRead: (id: string) => Promise<void>;
  deleteMail: (id: string) => Promise<void>;
}

export const useMailStore = create<MailState & MailActions>((set, get) => ({
  unreadCount: 0,
  mails: [],

  fetchUnreadCount: async () => {
    try {
      const { count } = await api.getMailUnreadCount();
      set({ unreadCount: count });
    } catch {
      // silent — keep last known value
    }
  },

  fetchInbox: async () => {
    try {
      const mails = await api.getMailInbox();
      set({ mails });
    } catch {
      // silent
    }
  },

  sendMail: async (toId, subject, body) => {
    await api.sendMail(toId, subject, body);
  },

  markRead: async (id) => {
    const mail = get().mails.find((m) => m.id === id);
    if (!mail || mail.isRead) return;
    set((s) => ({
      mails: s.mails.map((m) => (m.id === id ? { ...m, isRead: true } : m)),
      unreadCount: Math.max(0, s.unreadCount - 1),
    }));
    try {
      await api.markMailRead(id);
    } catch {
      set((s) => ({
        mails: s.mails.map((m) => (m.id === id ? { ...m, isRead: false } : m)),
        unreadCount: s.unreadCount + 1,
      }));
    }
  },

  deleteMail: async (id) => {
    const prevMails = get().mails;
    const mail = prevMails.find((m) => m.id === id);
    set((s) => ({ mails: s.mails.filter((m) => m.id !== id) }));
    if (mail && !mail.isRead) {
      set((s) => ({ unreadCount: Math.max(0, s.unreadCount - 1) }));
    }
    try {
      await api.deleteMail(id);
    } catch {
      set({ mails: prevMails });
      if (mail && !mail.isRead) {
        set((s) => ({ unreadCount: s.unreadCount + 1 }));
      }
      throw new Error('Failed to delete mail');
    }
  },
}));

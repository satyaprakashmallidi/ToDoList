import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface DraftMessage {
  id: string;
  location: string; // channel name or DM recipient
  message: string;
  timestamp: string;
  type: 'channel' | 'dm';
  recipient?: string;
  channelId?: string;
  lastUpdated: string;
}

export interface SentMessage {
  id: string;
  location: string;
  message: string;
  timestamp: string;
  type: 'channel' | 'dm';
  recipient?: string;
  channelId?: string;
  sentAt: string;
}

export interface ScheduledMessage {
  id: string;
  location: string;
  message: string;
  timestamp: string;
  type: 'channel' | 'dm';
  recipient?: string;
  channelId?: string;
  scheduledFor: string;
  status: 'pending' | 'sent' | 'cancelled';
}

interface DraftContextType {
  drafts: DraftMessage[];
  sentMessages: SentMessage[];
  scheduledMessages: ScheduledMessage[];
  addDraft: (draft: Omit<DraftMessage, 'id' | 'timestamp' | 'lastUpdated'>) => void;
  updateDraft: (id: string, message: string) => void;
  deleteDraft: (id: string) => void;
  sendDraft: (id: string) => void;
  addScheduledMessage: (message: Omit<ScheduledMessage, 'id' | 'timestamp' | 'status'>) => void;
  cancelScheduledMessage: (id: string) => void;
  clearAllDrafts: () => void;
  getDraft: (id: string) => DraftMessage | undefined;
  searchDrafts: (query: string) => DraftMessage[];
  searchSent: (query: string) => SentMessage[];
  searchScheduled: (query: string) => ScheduledMessage[];
}

const DraftContext = createContext<DraftContextType | undefined>(undefined);

const DRAFTS_STORAGE_KEY = 'magicteams_drafts';
const SENT_STORAGE_KEY = 'magicteams_sent_messages';
const SCHEDULED_STORAGE_KEY = 'magicteams_scheduled_messages';

export const DraftProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [drafts, setDrafts] = useState<DraftMessage[]>(() => {
    const stored = localStorage.getItem(DRAFTS_STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        console.error('Error loading drafts:', error);
        return [];
      }
    }
    return [];
  });

  const [sentMessages, setSentMessages] = useState<SentMessage[]>(() => {
    const stored = localStorage.getItem(SENT_STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        console.error('Error loading sent messages:', error);
        return [];
      }
    }
    return [];
  });

  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>(() => {
    const stored = localStorage.getItem(SCHEDULED_STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        console.error('Error loading scheduled messages:', error);
        return [];
      }
    }
    return [];
  });

  // Save to localStorage whenever drafts change
  useEffect(() => {
    localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
  }, [drafts]);

  // Save to localStorage whenever sent messages change
  useEffect(() => {
    localStorage.setItem(SENT_STORAGE_KEY, JSON.stringify(sentMessages));
  }, [sentMessages]);

  // Save to localStorage whenever scheduled messages change
  useEffect(() => {
    localStorage.setItem(SCHEDULED_STORAGE_KEY, JSON.stringify(scheduledMessages));
  }, [scheduledMessages]);

  const addDraft = (draft: Omit<DraftMessage, 'id' | 'timestamp' | 'lastUpdated'>) => {
    const newDraft: DraftMessage = {
      ...draft,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    };
    setDrafts(prev => [newDraft, ...prev]);
  };

  const updateDraft = (id: string, message: string) => {
    setDrafts(prev =>
      prev.map(draft =>
        draft.id === id
          ? { ...draft, message, lastUpdated: new Date().toISOString() }
          : draft
      )
    );
  };

  const deleteDraft = (id: string) => {
    setDrafts(prev => prev.filter(draft => draft.id !== id));
  };

  const sendDraft = (id: string) => {
    const draft = drafts.find(d => d.id === id);
    if (draft) {
      const sentMessage: SentMessage = {
        id: draft.id,
        location: draft.location,
        message: draft.message,
        timestamp: draft.timestamp,
        type: draft.type,
        recipient: draft.recipient,
        channelId: draft.channelId,
        sentAt: new Date().toISOString(),
      };
      setSentMessages(prev => [sentMessage, ...prev]);
      deleteDraft(id);
    }
  };

  const addScheduledMessage = (message: Omit<ScheduledMessage, 'id' | 'timestamp' | 'status'>) => {
    const newScheduledMessage: ScheduledMessage = {
      ...message,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      status: 'pending',
    };
    setScheduledMessages(prev => [newScheduledMessage, ...prev]);
  };

  const cancelScheduledMessage = (id: string) => {
    setScheduledMessages(prev => prev.filter(message => message.id !== id));
  };

  const clearAllDrafts = () => {
    setDrafts([]);
    localStorage.removeItem(DRAFTS_STORAGE_KEY);
  };

  const getDraft = (id: string) => {
    return drafts.find(d => d.id === id);
  };

  const searchDrafts = (query: string) => {
    if (!query.trim()) return drafts;
    const lowerQuery = query.toLowerCase();
    return drafts.filter(
      draft =>
        draft.message.toLowerCase().includes(lowerQuery) ||
        draft.location.toLowerCase().includes(lowerQuery)
    );
  };

  const searchSent = (query: string) => {
    if (!query.trim()) return sentMessages;
    const lowerQuery = query.toLowerCase();
    return sentMessages.filter(
      message =>
        message.message.toLowerCase().includes(lowerQuery) ||
        message.location.toLowerCase().includes(lowerQuery)
    );
  };

  const searchScheduled = (query: string) => {
    if (!query.trim()) return scheduledMessages;
    const lowerQuery = query.toLowerCase();
    return scheduledMessages.filter(
      message =>
        message.message.toLowerCase().includes(lowerQuery) ||
        message.location.toLowerCase().includes(lowerQuery)
    );
  };

  return (
    <DraftContext.Provider
      value={{
        drafts,
        sentMessages,
        scheduledMessages,
        addDraft,
        updateDraft,
        deleteDraft,
        sendDraft,
        addScheduledMessage,
        cancelScheduledMessage,
        clearAllDrafts,
        getDraft,
        searchDrafts,
        searchSent,
        searchScheduled,
      }}
    >
      {children}
    </DraftContext.Provider>
  );
};

export const useDrafts = () => {
  const context = useContext(DraftContext);
  if (!context) {
    throw new Error('useDrafts must be used within a DraftProvider');
  }
  return context;
};
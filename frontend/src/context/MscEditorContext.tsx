import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useLocalStorage } from '@mantine/hooks';
import type { MscSequence, MscMessage } from '../domain/msc/types';

interface MscEditorContextState {
  // Current editing state
  currentSequence: MscSequence | null;
  selectedMessageIndex: number | null;
  protocol: string;
  
  // UI state
  showMessageDetail: boolean;
  showAddMessage: boolean;
  
  // Recent sequences (for quick access)
  recentSequences: string[]; // Sequence IDs
  
  // Last saved timestamp
  lastSaved: number | null;
}

interface MscEditorContextValue extends MscEditorContextState {
  // Setters
  setCurrentSequence: (sequence: MscSequence | null) => void;
  setSelectedMessageIndex: (index: number | null) => void;
  setProtocol: (protocol: string) => void;
  setShowMessageDetail: (show: boolean) => void;
  setShowAddMessage: (show: boolean) => void;
  
  // Actions
  updateCurrentSequence: (updates: Partial<MscSequence>) => void;
  addMessageToCurrent: (message: Partial<MscMessage>, index?: number) => void;
  removeMessageFromCurrent: (messageId: string) => void;
  updateMessageInCurrent: (messageId: string, updates: Partial<MscMessage>) => void;
  
  // Persistence
  saveState: () => void;
  loadState: () => MscEditorContextState | null;
  clearState: () => void;
}

const MscEditorContext = createContext<MscEditorContextValue | null>(null);

const STORAGE_KEY = 'msc-editor-context';
const STORAGE_VERSION = 1;

interface StoredState {
  version: number;
  state: MscEditorContextState;
  timestamp: number;
}

export const MscEditorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load initial state from localStorage
  const loadStoredState = useCallback((): MscEditorContextState | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      
      const parsed: StoredState = JSON.parse(stored);
      
      // Version check for future migrations
      if (parsed.version !== STORAGE_VERSION) {
        console.warn(`Storage version mismatch: ${parsed.version} vs ${STORAGE_VERSION}. Clearing state.`);
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      
      return parsed.state;
    } catch (error) {
      console.error('Failed to load stored state:', error);
      return null;
    }
  }, []);

  const storedState = loadStoredState();
  
  // Initialize state from storage or defaults
  const [currentSequence, setCurrentSequence] = useState<MscSequence | null>(
    storedState?.currentSequence || null
  );
  const [selectedMessageIndex, setSelectedMessageIndex] = useState<number | null>(
    storedState?.selectedMessageIndex ?? null
  );
  const [protocol, setProtocol] = useState<string>(
    storedState?.protocol || 'rrc_demo'
  );
  const [showMessageDetail, setShowMessageDetail] = useState<boolean>(
    storedState?.showMessageDetail ?? false
  );
  const [showAddMessage, setShowAddMessage] = useState<boolean>(
    storedState?.showAddMessage ?? false
  );
  const [recentSequences, setRecentSequences] = useLocalStorage<string[]>({
    key: `${STORAGE_KEY}-recent`,
    defaultValue: storedState?.recentSequences || [],
  });
  const [lastSaved, setLastSaved] = useState<number | null>(
    storedState?.lastSaved || null
  );

  // Auto-save state to localStorage
  const saveState = useCallback(() => {
    try {
      const stateToSave: MscEditorContextState = {
        currentSequence,
        selectedMessageIndex,
        protocol,
        showMessageDetail,
        showAddMessage,
        recentSequences,
        lastSaved: Date.now(),
      };

      const stored: StoredState = {
        version: STORAGE_VERSION,
        state: stateToSave,
        timestamp: Date.now(),
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      setLastSaved(Date.now());
    } catch (error) {
      console.error('Failed to save state:', error);
    }
  }, [currentSequence, selectedMessageIndex, protocol, showMessageDetail, showAddMessage, recentSequences]);

  // Auto-save on state changes (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      saveState();
    }, 500); // Debounce saves by 500ms

    return () => clearTimeout(timeoutId);
  }, [currentSequence, selectedMessageIndex, protocol, showMessageDetail, showAddMessage, saveState]);

  // Also save before page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveState();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveState]);

  // Update current sequence
  const updateCurrentSequence = useCallback((updates: Partial<MscSequence>) => {
    setCurrentSequence(prev => {
      if (!prev) return prev;
      return { ...prev, ...updates, updatedAt: new Date().toISOString() };
    });
  }, []);

  // Add message to current sequence
  const addMessageToCurrent = useCallback((message: Partial<MscMessage>, index?: number) => {
    if (!currentSequence) return;

    const newMessage: MscMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type_name: message.type_name || '',
      data: message.data || {},
      sourceActor: message.sourceActor || message.source_actor || 'UE',
      targetActor: message.targetActor || message.target_actor || 'gNB',
      timestamp: message.timestamp || Date.now() / 1000,
      validationErrors: [],
    };

    const messages = [...currentSequence.messages];
    if (index !== undefined) {
      messages.splice(index, 0, newMessage);
    } else {
      messages.push(newMessage);
    }

    updateCurrentSequence({ messages });
  }, [currentSequence, updateCurrentSequence]);

  // Remove message from current sequence
  const removeMessageFromCurrent = useCallback((messageId: string) => {
    if (!currentSequence) return;

    const messages = currentSequence.messages.filter(m => m.id !== messageId);
    updateCurrentSequence({ messages });
    
    // Clear selection if removed message was selected
    if (selectedMessageIndex !== null) {
      const removedIndex = currentSequence.messages.findIndex(m => m.id === messageId);
      if (removedIndex === selectedMessageIndex) {
        setSelectedMessageIndex(null);
      } else if (removedIndex < selectedMessageIndex) {
        setSelectedMessageIndex(selectedMessageIndex - 1);
      }
    }
  }, [currentSequence, selectedMessageIndex, updateCurrentSequence]);

  // Update message in current sequence
  const updateMessageInCurrent = useCallback((messageId: string, updates: Partial<MscMessage>) => {
    if (!currentSequence) return;

    const messages = currentSequence.messages.map(msg =>
      msg.id === messageId ? { ...msg, ...updates } : msg
    );

    updateCurrentSequence({ messages });
  }, [currentSequence, updateCurrentSequence]);

  // Add to recent sequences
  useEffect(() => {
    if (currentSequence?.id) {
      setRecentSequences(prev => {
        const filtered = prev.filter(id => id !== currentSequence.id);
        return [currentSequence.id, ...filtered].slice(0, 10); // Keep last 10
      });
    }
  }, [currentSequence?.id, setRecentSequences]);

  // Load state (for explicit restore)
  const loadState = useCallback((): MscEditorContextState | null => {
    return loadStoredState();
  }, [loadStoredState]);

  // Clear state
  const clearState = useCallback(() => {
    setCurrentSequence(null);
    setSelectedMessageIndex(null);
    setProtocol('rrc_demo');
    setShowMessageDetail(false);
    setShowAddMessage(false);
    setRecentSequences([]);
    setLastSaved(null);
    localStorage.removeItem(STORAGE_KEY);
  }, [setRecentSequences]);

  const value: MscEditorContextValue = useMemo(() => ({
    // State
    currentSequence,
    selectedMessageIndex,
    protocol,
    showMessageDetail,
    showAddMessage,
    recentSequences,
    lastSaved,
    
    // Setters
    setCurrentSequence,
    setSelectedMessageIndex,
    setProtocol,
    setShowMessageDetail,
    setShowAddMessage,
    
    // Actions
    updateCurrentSequence,
    addMessageToCurrent,
    removeMessageFromCurrent,
    updateMessageInCurrent,
    
    // Persistence
    saveState,
    loadState,
    clearState,
  }), [
    currentSequence,
    selectedMessageIndex,
    protocol,
    showMessageDetail,
    showAddMessage,
    recentSequences,
    lastSaved,
    updateCurrentSequence,
    addMessageToCurrent,
    removeMessageFromCurrent,
    updateMessageInCurrent,
    saveState,
    loadState,
    clearState,
  ]);

  return (
    <MscEditorContext.Provider value={value}>
      {children}
    </MscEditorContext.Provider>
  );
};

export const useMscEditorContext = (): MscEditorContextValue => {
  const context = useContext(MscEditorContext);
  if (!context) {
    throw new Error('useMscEditorContext must be used within MscEditorProvider');
  }
  return context;
};


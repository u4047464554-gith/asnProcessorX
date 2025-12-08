import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocalStorage } from '@mantine/hooks';
import type {
  MscSequence,
  MscMessage,
  ValidationResult,
  IdentifierSuggestion
} from '../domain/msc/types';
import { normalizeSequence } from '../domain/msc/types';
import MscService from '../services/mscService';

interface MscEditorState {
  currentSequence: MscSequence | null;
  sequences: MscSequence[];
  isLoading: boolean;
  error: string | null;
  validationResults: ValidationResult[];
  suggestions: IdentifierSuggestion[];
  selectedMessageIndex: number | null;
  isValidating: boolean;
}

interface UseMscEditorReturn {
  // State
  state: MscEditorState;

  // Sequence operations
  createSequence: (name: string, protocol: string, sessionId?: string | null) => Promise<MscSequence>;
  loadSequence: (sequenceId: string) => Promise<MscSequence | null>;
  updateSequence: (updates: any) => Promise<MscSequence | null>;
  deleteSequence: (sequenceId: string) => Promise<boolean>;
  addMessage: (message: Partial<MscMessage>, index?: number) => Promise<MscSequence>;
  updateMessage: (messageId: string, newData: any) => Promise<MscSequence | null>;
  removeMessage: (messageId: string) => Promise<boolean>;
  duplicateMessage: (messageId: string) => Promise<void>;

  // Validation
  validateSequence: () => Promise<any>;
  clearValidation: () => void;

  // Suggestions
  getFieldSuggestions: (fieldName: string, messageIndex: number) => Promise<IdentifierSuggestion[]>;
  applySuggestion: (suggestion: IdentifierSuggestion) => void;

  // Identifiers
  detectIdentifiers: (typeName: string) => Promise<string[]>;

  // UI actions
  selectMessage: (index: number | null) => void;
  setSequenceName: (name: string) => void;
  duplicateSequence: () => Promise<MscSequence>;

  // Utils
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  exportSequence: () => string;
  importSequence: (data: string) => Promise<MscSequence>;
  loadAllSequences: (sessionId?: string | null) => Promise<void>;

  // Initialization
  isInitialized: boolean;
}

const LOCAL_STORAGE_KEY = 'msc-editor-state';
const DEFAULT_PROTOCOL = 'rrc_demo';

export const useMscEditor = (): UseMscEditorReturn => {
  // Core state
  const [state, setState] = useState<MscEditorState>({
    currentSequence: null,
    sequences: [],
    isLoading: false,
    error: null,
    validationResults: [],
    suggestions: [],
    selectedMessageIndex: null,
    isValidating: false,
  });

  // Persistence
  const [persistedSequences, setPersistedSequences] = useLocalStorage<MscSequence[]>({
    key: `${LOCAL_STORAGE_KEY}-sequences`,
    defaultValue: [],
    serialize: JSON.stringify,
    deserialize: (value: string | undefined) => {
      if (!value) return [];
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    },
  });

  // Persist current sequence state
  const [persistedCurrentSequence, setPersistedCurrentSequence] = useLocalStorage<MscSequence | null>({
    key: `${LOCAL_STORAGE_KEY}-current-sequence`,
    defaultValue: null,
    serialize: (value) => value ? JSON.stringify(value) : '',
    deserialize: (value: string | undefined) => {
      if (!value) return null;
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    },
  });

  // Persist selected message index
  const [persistedSelectedIndex, setPersistedSelectedIndex] = useLocalStorage<number | null>({
    key: `${LOCAL_STORAGE_KEY}-selected-index`,
    defaultValue: null,
  });

  // Persist protocol
  const [_persistedProtocol, setPersistedProtocol] = useLocalStorage<string>({
    key: `${LOCAL_STORAGE_KEY}-protocol`,
    defaultValue: DEFAULT_PROTOCOL,
  });

  // Services
  const mscService = useMemo(() => new MscService(), []);

  // Track if initialization is complete
  const [isInitialized, setIsInitialized] = useState(false);

  // Effects
  useEffect(() => {
    // Load sequences on mount
    loadAllSequences();

    // Restore current sequence from persistence if available
    // Only restore if we don't already have a current sequence (to avoid overwriting)
    if (persistedCurrentSequence && !state.currentSequence) {
      // Normalize persisted sequence to ensure consistent format
      const normalizedSequence = normalizeSequence(persistedCurrentSequence);

      // Check if persisted sequence exists in loaded sequences
      const localSeqs = Array.isArray(persistedSequences) ? persistedSequences : [];
      const existsInLoaded = localSeqs.some(seq => seq.id === normalizedSequence.id);

      setState(prev => ({
        ...prev,
        currentSequence: normalizedSequence,
        selectedMessageIndex: persistedSelectedIndex,
        // Add to sequences if not already there
        sequences: existsInLoaded
          ? prev.sequences
          : [...prev.sequences, normalizedSequence],
      }));

      // Update persisted sequence with normalized version
      setPersistedCurrentSequence(normalizedSequence);
    }

    // Mark as initialized after restoring from persistence
    setIsInitialized(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save current sequence to localStorage (debounced to avoid excessive writes)
  useEffect(() => {
    if (!state.currentSequence) return;

    const timeoutId = setTimeout(() => {
      setPersistedCurrentSequence(state.currentSequence);
    }, 300); // Debounce by 300ms

    return () => clearTimeout(timeoutId);
  }, [state.currentSequence, setPersistedCurrentSequence]);

  // Also save on beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (state.currentSequence) {
        setPersistedCurrentSequence(state.currentSequence);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state.currentSequence, setPersistedCurrentSequence]);

  // Auto-save selected index
  useEffect(() => {
    setPersistedSelectedIndex(state.selectedMessageIndex);
  }, [state.selectedMessageIndex, setPersistedSelectedIndex]);

  // Auto-save is handled by local storage persistence via setPersistedSequences
  // No explicit save needed since updateSequence already persists to backend

  // Sequence Operations

  const createSequence = useCallback(async (name: string, protocol: string = DEFAULT_PROTOCOL, sessionId?: string | null) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const newSequence = await mscService.createSequence(name, protocol, sessionId || undefined);
      const normalizedSequence = normalizeSequence(newSequence);

      setState(prev => ({
        ...prev,
        currentSequence: normalizedSequence,
        sequences: [...prev.sequences, normalizedSequence],
        selectedMessageIndex: null,
        validationResults: [],
        suggestions: []
      }));

      // Update persisted sequences and protocol
      setPersistedSequences(prev => [...prev, normalizedSequence]);
      setPersistedProtocol(protocol);
      setPersistedCurrentSequence(normalizedSequence);

      return normalizedSequence;
    } catch (error: any) {
      setState(prev => ({ ...prev, error: error.message }));
      throw error;
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [mscService, setPersistedSequences, setPersistedProtocol, setPersistedCurrentSequence]);

  const loadSequence = useCallback(async (sequenceId: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const sequence = await mscService.getSequence(sequenceId);
      if (!sequence) {
        throw new Error('Sequence not found');
      }

      // Normalize sequence from backend format
      const normalizedSequence = normalizeSequence(sequence);

      // Validate on load
      const validation = await mscService.validateSequence(sequenceId);

      setState(prev => ({
        ...prev,
        currentSequence: normalizedSequence,
        validationResults: validation.results,
        selectedMessageIndex: null,
        suggestions: [],
        error: null
      }));

      // Update persisted sequence
      setPersistedCurrentSequence(normalizedSequence);

      return normalizedSequence;
    } catch (error: any) {
      setState(prev => ({ ...prev, error: error.message }));
      throw error;
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [mscService, setPersistedCurrentSequence]);

  const loadAllSequences = useCallback(async (sessionId?: string | null) => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const sequences = await mscService.listSequences(undefined, sessionId || undefined);

      // Ensure sequences is an array and normalize them
      const apiSequences = Array.isArray(sequences)
        ? sequences.map(normalizeSequence)
        : [];
      const localSequences = Array.isArray(persistedSequences)
        ? persistedSequences
          .filter(seq => !sessionId || (seq as any).session_id === sessionId)
          .map(normalizeSequence)
        : [];

      // Merge with local storage (prioritize API data)
      const mergedSequences = [
        ...apiSequences,
        ...localSequences.filter(localSeq =>
          !apiSequences.some(apiSeq => apiSeq.id === localSeq.id)
        )
      ];

      setState(prev => ({
        ...prev,
        sequences: mergedSequences,
        error: null
      }));

      setPersistedSequences(mergedSequences);
    } catch (error: any) {
      console.error('Failed to load sequences:', error);
      // Fallback to local storage
      const localSeqs = Array.isArray(persistedSequences)
        ? persistedSequences
          .filter(seq => !sessionId || (seq as any).session_id === sessionId)
          .map(normalizeSequence)
        : [];
      setState(prev => ({
        ...prev,
        sequences: localSeqs,
        error: 'Failed to load sequences from server, using local data'
      }));
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [mscService, persistedSequences, setPersistedSequences]);

  const updateSequence = useCallback(async (updates: any) => {
    if (!state.currentSequence) {
      throw new Error('No current sequence to update');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const updated = await mscService.updateSequence(state.currentSequence.id, updates);
      if (!updated) {
        throw new Error('Failed to update sequence');
      }

      setState(prev => ({
        ...prev,
        currentSequence: updated,
        sequences: prev.sequences.map(seq =>
          seq.id === updated.id ? updated : seq
        ),
        error: null
      }));

      // Update local storage (both sequences list and current sequence)
      setPersistedSequences(prev =>
        prev.map(seq => seq.id === updated.id ? updated : seq)
      );
      // Current sequence is auto-saved by the useEffect above

      return updated;
    } catch (error: any) {
      setState(prev => ({ ...prev, error: error.message }));
      throw error;
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [state.currentSequence, mscService, setPersistedSequences]);

  const deleteSequence = useCallback(async (sequenceId: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const success = await mscService.deleteSequence(sequenceId);

      if (success) {
        setState(prev => ({
          ...prev,
          sequences: prev.sequences.filter(seq => seq.id !== sequenceId),
          currentSequence: prev.currentSequence?.id === sequenceId ? null : prev.currentSequence,
          selectedMessageIndex: null,
          error: null
        }));

        setPersistedSequences(prev => prev.filter(seq => seq.id !== sequenceId));
      }

      return success;
    } catch (error: any) {
      setState(prev => ({ ...prev, error: error.message }));
      throw error;
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [mscService, setPersistedSequences]);

  const addMessage = useCallback(async (message: Partial<MscMessage>, index?: number) => {
    if (!state.currentSequence) {
      throw new Error('No current sequence to add message to');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const messageData = {
        type_name: message.type_name || '',
        data: message.data || {},
        source_actor: message.source_actor || 'UE',
        target_actor: message.target_actor || 'gNB'
      };

      const updated = await mscService.addMessageToSequence(state.currentSequence.id, messageData);

      setState(prev => ({
        ...prev,
        currentSequence: updated,
        sequences: prev.sequences.map(seq =>
          seq.id === updated.id ? updated : seq
        ),
        selectedMessageIndex: index !== undefined ? index : updated.messages.length - 1,
        error: null
      }));

      // Update persisted sequences
      setPersistedSequences(prev =>
        prev.map(seq => seq.id === updated.id ? updated : seq)
      );

      // Revalidate after adding message
      await validateSequence();

      return updated;
    } catch (error: any) {
      setState(prev => ({ ...prev, error: error.message }));
      throw error;
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [state.currentSequence, mscService]);

  const updateMessage = useCallback(async (messageId: string, newData: any) => {
    if (!state.currentSequence) {
      throw new Error('No current sequence');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const updates = {
        update_message: { id: messageId, data: newData }
      };

      const updated = await mscService.updateSequence(state.currentSequence.id, updates);

      if (updated) {
        setState(prev => ({
          ...prev,
          currentSequence: updated,
          sequences: prev.sequences.map(seq =>
            seq.id === updated.id ? updated : seq
          ),
          error: null
        }));

        setPersistedSequences(prev =>
          prev.map(seq => seq.id === updated.id ? updated : seq)
        );

        // Revalidate after updating message
        await validateSequence();
      }
      return updated;
    } catch (error: any) {
      setState(prev => ({ ...prev, error: error.message }));
      throw error;
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [state.currentSequence, mscService, setPersistedSequences]);

  const removeMessage = useCallback(async (messageId: string) => {
    if (!state.currentSequence) {
      throw new Error('No current sequence to remove message from');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const updates = { remove_message: messageId };
      const updated = await mscService.updateSequence(state.currentSequence.id, updates);

      if (updated) {
        setState(prev => ({
          ...prev,
          currentSequence: updated,
          sequences: prev.sequences.map(seq =>
            seq.id === updated.id ? updated : seq
          ),
          selectedMessageIndex: null,
          error: null
        }));

        // Update persisted sequences
        setPersistedSequences(prev =>
          prev.map(seq => seq.id === updated.id ? updated : seq)
        );

        await validateSequence();
      }

      return updated !== null;
    } catch (error: any) {
      setState(prev => ({ ...prev, error: error.message }));
      throw error;
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [state.currentSequence, mscService]);

  const duplicateMessage = useCallback(async (messageId: string) => {
    if (!state.currentSequence) {
      throw new Error('No current sequence to duplicate message');
    }

    const messageIndex = state.currentSequence.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) {
      throw new Error('Message not found');
    }

    const messageToDuplicate = state.currentSequence.messages[messageIndex];
    const newMessage = {
      ...messageToDuplicate,
      id: undefined,  // Will generate new ID
      timestamp: Date.now() / 1000
    };

    await addMessage(newMessage, messageIndex + 1);
  }, [state.currentSequence, addMessage]);

  // Validation

  const validateSequence = useCallback(async () => {
    if (!state.currentSequence) {
      return;
    }

    setState(prev => ({ ...prev, isValidating: true, error: null }));

    try {
      const validation = await mscService.validateSequence(state.currentSequence.id);

      setState(prev => ({
        ...prev,
        validationResults: validation.results,
        error: null
      }));

      return validation;
    } catch (error: any) {
      setState(prev => ({ ...prev, error: error.message }));
      throw error;
    } finally {
      setState(prev => ({ ...prev, isValidating: false }));
    }
  }, [state.currentSequence, mscService]);

  const clearValidation = useCallback(() => {
    setState(prev => ({
      ...prev,
      validationResults: [],
      suggestions: []
    }));
  }, []);

  // Suggestions

  const getFieldSuggestions = useCallback(async (fieldName: string, messageIndex: number) => {
    if (!state.currentSequence) {
      return [];
    }

    try {
      const suggestions = await mscService.getFieldSuggestions(
        state.currentSequence.id,
        messageIndex,
        fieldName,
        state.currentSequence.protocol,
        state.currentSequence.messages[messageIndex]?.type_name || ''
      );

      setState(prev => ({
        ...prev,
        suggestions
      }));

      return suggestions;
    } catch (error: any) {
      console.error('Failed to get suggestions:', error);
      setState(prev => ({
        ...prev,
        suggestions: [],
        error: error.message
      }));
      return [];
    }
  }, [state.currentSequence, mscService]);

  const applySuggestion = useCallback((suggestion: IdentifierSuggestion) => {
    if (!state.currentSequence || state.selectedMessageIndex === null) {
      return;
    }

    const currentMessage = state.currentSequence.messages[state.selectedMessageIndex];
    const updatedData = {
      ...currentMessage.data,
      [suggestion.identifier]: suggestion.value
    };

    // Update message data
    const updatedMessage = {
      ...currentMessage,
      data: updatedData
    };

    // Update sequence locally first
    const updatedSequence = {
      ...state.currentSequence,
      messages: state.currentSequence.messages.map((msg, index) =>
        index === state.selectedMessageIndex ? updatedMessage : msg
      )
    } as MscSequence;

    setState(prev => ({
      ...prev,
      currentSequence: updatedSequence,
      suggestions: []
    }));

    // Persist update
    updateSequence({
      add_message: updatedMessage  // Use update mechanism
    }).catch(console.error);
  }, [state.currentSequence, state.selectedMessageIndex, updateSequence]);

  // Identifier Detection

  const detectIdentifiers = useCallback(async (typeName: string) => {
    if (!state.currentSequence) {
      return [];
    }

    try {
      const identifiers = await mscService.detectIdentifiers(
        state.currentSequence.protocol,
        typeName
      );
      return identifiers;
    } catch (error: any) {
      console.error('Failed to detect identifiers:', error);
      return [];
    }
  }, [state.currentSequence, mscService]);

  // UI Actions

  const selectMessage = useCallback((index: number | null) => {
    setState(prev => ({
      ...prev,
      selectedMessageIndex: index,
      suggestions: index !== null ? prev.suggestions : []
    }));

    if (index !== null) {
      // Clear suggestions for new selection
      getFieldSuggestions('', index);
    }
  }, [getFieldSuggestions]);

  const setSequenceName = useCallback((name: string) => {
    if (!state.currentSequence) {
      console.warn('Cannot update sequence name: no current sequence');
      return;
    }

    // Only update if name actually changed
    if (name === state.currentSequence.name) {
      return;
    }

    // Update optimistically in state first
    setState(prev => ({
      ...prev,
      currentSequence: prev.currentSequence ? { ...prev.currentSequence, name } : null
    }));

    // Then update in backend
    updateSequence({ name }).catch((error) => {
      console.error('Failed to update sequence name:', error);

      const errorMessage = error.message || 'Failed to update sequence name';

      // If sequence not found (404), clear it from state
      if (errorMessage.toLowerCase().includes('not found')) {
        setState(prev => ({
          ...prev,
          currentSequence: null,
          error: 'Sequence not found on server (it may have been deleted)'
        }));
        return;
      }

      // Revert on error
      setState(prev => ({
        ...prev,
        currentSequence: prev.currentSequence ? { ...prev.currentSequence, name: state.currentSequence?.name || '' } : null,
        error: errorMessage
      }));
    });
  }, [state.currentSequence, updateSequence]);

  const duplicateSequence = useCallback(async () => {
    if (!state.currentSequence) {
      throw new Error('No current sequence');
    }

    try {
      const newName = `${state.currentSequence.name} (Copy)`;
      const duplicated = await createSequence(newName, state.currentSequence.protocol);

      // Copy all messages
      for (const message of state.currentSequence.messages) {
        await addMessage(message, undefined);
      }

      // Reload to get updated sequence
      await loadSequence(duplicated.id);

      return duplicated;
    } catch (error: any) {
      setState(prev => ({ ...prev, error: error.message }));
      throw error;
    }
  }, [state.currentSequence, createSequence, addMessage, loadSequence]);

  // Undo/Redo (simple implementation using history)
  const [history, setHistory] = useState<MscSequence[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [lastSavedSequenceId, setLastSavedSequenceId] = useState<string | null>(null);

  // Save to history only when sequence content actually changes (not just on state update)
  useEffect(() => {
    if (state.currentSequence) {
      // Only save if it's a different sequence or content changed
      const sequenceKey = JSON.stringify({
        id: state.currentSequence.id,
        messages: state.currentSequence.messages.map(m => ({ id: m.id, type_name: m.type_name }))
      });

      if (sequenceKey !== lastSavedSequenceId) {
        setLastSavedSequenceId(sequenceKey);
        setHistory(prev => {
          // Only keep up to current index and add new
          const newHistory = prev.slice(0, Math.max(0, historyIndex + 1));
          newHistory.push(state.currentSequence!);
          // Limit history size
          if (newHistory.length > 50) {
            newHistory.shift();
          }
          return newHistory;
        });
        setHistoryIndex(prev => Math.min(prev + 1, 49));
      }
    }
  }, [state.currentSequence?.id, state.currentSequence?.messages.length]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const undo = useCallback(() => {
    if (canUndo && historyIndex > 0) {
      const previous = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setState(prev => ({
        ...prev,
        currentSequence: previous,
        validationResults: [],  // Revalidate on undo
        suggestions: []
      }));

      // Revalidate
      if (previous) {
        validateSequence();
      }
    }
  }, [history, historyIndex, canUndo, validateSequence]);

  const redo = useCallback(() => {
    if (canRedo && historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setState(prev => ({
        ...prev,
        currentSequence: next,
        validationResults: [],
        suggestions: []
      }));

      if (next) {
        validateSequence();
      }
    }
  }, [history, historyIndex, canRedo, validateSequence]);

  const reset = useCallback(() => {
    setState({
      currentSequence: null,
      sequences: [],
      isLoading: false,
      error: null,
      validationResults: [],
      suggestions: [],
      selectedMessageIndex: null,
      isValidating: false,
    });
    setHistory([]);
    setHistoryIndex(-1);
    setPersistedSequences([]);
  }, [setPersistedSequences]);

  // Export/Import

  const exportSequence = useCallback(() => {
    if (!state.currentSequence) {
      return '';
    }

    const exportData = {
      ...state.currentSequence,
      // Remove non-serializable fields
      created_at: new Date(state.currentSequence.createdAt).toISOString(),
      updated_at: new Date(state.currentSequence.updatedAt).toISOString(),
      // Convert validation results to plain objects
      validation_results: state.currentSequence.validationResults.map(r => ({
        type: r.type,
        message: r.message,
        field: r.field,
        message_index: r.message_index,
        code: r.code
      }))
    };

    return JSON.stringify(exportData, null, 2);
  }, [state.currentSequence]);

  const importSequence = useCallback(async (data: string) => {
    try {
      const parsed = JSON.parse(data);

      // Basic validation of imported data
      if (!parsed.id || !parsed.protocol || !Array.isArray(parsed.messages)) {
        throw new Error('Invalid sequence data format');
      }

      // Create new sequence from imported data
      const importedSequence = await createSequence(
        parsed.name || 'Imported Sequence',
        parsed.protocol
      );

      // Add messages from import
      for (const msgData of parsed.messages) {
        await addMessage({
          type_name: msgData.type_name,
          data: msgData.data,
          source_actor: msgData.source_actor,
          target_actor: msgData.target_actor
        });
      }

      // Set validation results if present
      if (parsed.validation_results) {
        setState(prev => ({
          ...prev,
          validationResults: parsed.validation_results.map((r: any) => ({
            type: r.type,
            message: r.message,
            field: r.field,
            message_index: r.message_index,
            code: r.code
          }))
        }));
      }

      return importedSequence;
    } catch (error: any) {
      setState(prev => ({ ...prev, error: `Import failed: ${error.message}` }));
      throw error;
    }
  }, [createSequence, addMessage]);

  return {
    state,

    // Sequence operations
    createSequence,
    loadSequence,
    updateSequence,
    deleteSequence,
    addMessage,
    updateMessage,
    removeMessage,
    duplicateMessage,

    // Validation
    validateSequence,
    clearValidation,

    // Suggestions
    getFieldSuggestions,
    applySuggestion,

    // Identifiers
    detectIdentifiers,

    // UI actions
    selectMessage,
    setSequenceName,
    duplicateSequence,

    // Utils
    canUndo,
    canRedo,
    undo,
    redo,
    reset,
    exportSequence,
    importSequence,
    loadAllSequences,

    // Initialization
    isInitialized,
  };
};

export default useMscEditor;

/**
 * useMscEditor Hook Tests
 * 
 * Tests the core state management hook for the MSC Editor.
 * Uses behavior-driven testing - tests what the hook DOES, not how.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useMscEditor } from './useMscEditor';
import { createMockMscService, clearAllMocks } from '../test-utils';

// Get the mock service we'll use
const mockService = createMockMscService();

// Mock the service module
vi.mock('../services/mscService', () => ({
  default: class MockMscService {
    createSequence = mockService.createSequence;
    getSequence = mockService.getSequence;
    updateSequence = mockService.updateSequence;
    deleteSequence = mockService.deleteSequence;
    addMessageToSequence = mockService.addMessageToSequence;
    listSequences = mockService.listSequences;
    validateSequence = mockService.validateSequence;
    getFieldSuggestions = mockService.getFieldSuggestions;
    detectIdentifiers = mockService.detectIdentifiers;
    decodeHexToMscMessages = mockService.decodeHexToMscMessages;
  }
}));

describe('useMscEditor Hook', () => {
  beforeEach(() => {
    clearAllMocks();
    // Reset mock implementations
    Object.values(mockService).forEach((fn: any) => {
      if (typeof fn.mockReset === 'function') {
        fn.mockReset();
      }
    });
    // Set default mock behaviors
    mockService.listSequences.mockResolvedValue([]);
    mockService.validateSequence.mockResolvedValue({ results: [], hasErrors: false });
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Initialization', () => {
    it('initializes and becomes ready', async () => {
      const { result } = renderHook(() => useMscEditor());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });
    });

    it('starts with no current sequence', async () => {
      const { result } = renderHook(() => useMscEditor());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      expect(result.current.state.currentSequence).toBeNull();
    });

    it('starts with empty sequences list', async () => {
      const { result } = renderHook(() => useMscEditor());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      expect(result.current.state.sequences).toEqual([]);
    });
  });

  describe('Sequence Creation', () => {
    it('creates a new sequence', async () => {
      const newSequence = {
        id: 'new-seq-1',
        name: 'My Sequence',
        protocol: 'rrc_demo',
        messages: [],
        configurations: {},
        validationResults: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      mockService.createSequence.mockResolvedValue(newSequence);

      const { result } = renderHook(() => useMscEditor());

      await act(async () => {
        await result.current.createSequence('My Sequence', 'rrc_demo');
      });

      expect(mockService.createSequence).toHaveBeenCalledWith('My Sequence', 'rrc_demo', undefined);
      expect(result.current.state.currentSequence?.id).toBe('new-seq-1');
    });

    it('creates sequence with session ID', async () => {
      const newSequence = {
        id: 'sess-seq-1',
        name: 'Session Sequence',
        protocol: 'rrc_demo',
        messages: [],
        session_id: 'session-123',
        configurations: {},
        validationResults: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      mockService.createSequence.mockResolvedValue(newSequence);

      const { result } = renderHook(() => useMscEditor());

      await act(async () => {
        await result.current.createSequence('Session Sequence', 'rrc_demo', 'session-123');
      });

      expect(mockService.createSequence).toHaveBeenCalledWith('Session Sequence', 'rrc_demo', 'session-123');
    });
  });

  describe('Message Operations', () => {
    it('adds a message to the current sequence', async () => {
      // First create a sequence
      const initialSequence = {
        id: 'seq-1',
        name: 'Test',
        protocol: 'rrc_demo',
        messages: [],
        configurations: {},
        validationResults: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      mockService.createSequence.mockResolvedValue(initialSequence);

      const updatedSequence = {
        ...initialSequence,
        messages: [{
          id: 'msg-1',
          type_name: 'RRCConnectionRequest',
          data: {},
          sourceActor: 'UE',
          targetActor: 'gNB',
          timestamp: Date.now() / 1000
        }]
      };
      mockService.addMessageToSequence.mockResolvedValue(updatedSequence);

      const { result } = renderHook(() => useMscEditor());

      // Create sequence first
      await act(async () => {
        await result.current.createSequence('Test', 'rrc_demo');
      });

      // Add message
      await act(async () => {
        await result.current.addMessage({
          type_name: 'RRCConnectionRequest',
          data: {},
          source_actor: 'UE',
          target_actor: 'gNB'
        });
      });

      expect(mockService.addMessageToSequence).toHaveBeenCalled();
    });

    it('requires a sequence before adding messages', async () => {
      const { result } = renderHook(() => useMscEditor());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      // Try to add without sequence - should throw or handle gracefully
      await expect(
        act(async () => {
          await result.current.addMessage({
            type_name: 'Test',
            data: {},
            source_actor: 'UE',
            target_actor: 'gNB'
          });
        })
      ).rejects.toThrow();
    });
  });

  describe('UI State', () => {
    it('can select a message by index', async () => {
      const { result } = renderHook(() => useMscEditor());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      act(() => {
        result.current.selectMessage(2);
      });

      expect(result.current.state.selectedMessageIndex).toBe(2);
    });

    it('can deselect message with null', async () => {
      const { result } = renderHook(() => useMscEditor());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      act(() => {
        result.current.selectMessage(1);
      });
      expect(result.current.state.selectedMessageIndex).toBe(1);

      act(() => {
        result.current.selectMessage(null);
      });
      expect(result.current.state.selectedMessageIndex).toBeNull();
    });
  });

  describe('Export/Import', () => {
    it('exports current sequence as JSON', async () => {
      const sequence = {
        id: 'export-seq',
        name: 'Export Test',
        protocol: 'rrc_demo',
        messages: [],
        configurations: {},
        validationResults: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      mockService.createSequence.mockResolvedValue(sequence);

      const { result } = renderHook(() => useMscEditor());

      await act(async () => {
        await result.current.createSequence('Export Test', 'rrc_demo');
      });

      const exported = result.current.exportSequence();

      // Should be valid JSON
      expect(() => JSON.parse(exported)).not.toThrow();
      const parsed = JSON.parse(exported);
      expect(parsed.name).toBe('Export Test');
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useMscEditor } from './useMscEditor';
import type { MscSequence, MscMessage } from '../domain/msc/types';

// Create mock service instance
const mockMscServiceInstance = {
  createSequence: vi.fn(),
  getSequence: vi.fn(),
  updateSequence: vi.fn(),
  deleteSequence: vi.fn(),
  addMessageToSequence: vi.fn(),
  listSequences: vi.fn(),
  validateSequence: vi.fn(),
  getFieldSuggestions: vi.fn(),
  decodeHexToMscMessages: vi.fn(),
};

// Mock the service as a class
vi.mock('../services/mscService', () => {
  class MockMscService {
    createSequence = mockMscServiceInstance.createSequence;
    getSequence = mockMscServiceInstance.getSequence;
    updateSequence = mockMscServiceInstance.updateSequence;
    deleteSequence = mockMscServiceInstance.deleteSequence;
    addMessageToSequence = mockMscServiceInstance.addMessageToSequence;
    listSequences = mockMscServiceInstance.listSequences;
    validateSequence = mockMscServiceInstance.validateSequence;
    getFieldSuggestions = mockMscServiceInstance.getFieldSuggestions;
    decodeHexToMscMessages = mockMscServiceInstance.decodeHexToMscMessages;
  }
  return { default: MockMscService };
});

describe('useMscEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset all mock functions
    Object.values(mockMscServiceInstance).forEach((fn: any) => {
      if (typeof fn === 'function' && fn.mockClear) {
        fn.mockClear();
      }
    });
  });

  it('initializes with empty state', () => {
    const { result } = renderHook(() => useMscEditor());
    
    expect(result.current.state.currentSequence).toBeNull();
    expect(result.current.state.sequences).toEqual([]);
    expect(result.current.state.isLoading).toBe(false);
  });

  it('creates a new sequence', async () => {
    const mockSequence: MscSequence = {
      id: 'seq-1',
      name: 'Test Sequence',
      protocol: 'rrc_demo',
      messages: [],
      subSequences: [],
      configurations: {},
      validationResults: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockMscServiceInstance.createSequence.mockResolvedValue(mockSequence);

    const { result } = renderHook(() => useMscEditor());

    await act(async () => {
      await result.current.createSequence('Test Sequence', 'rrc_demo');
    });

    expect(mockMscServiceInstance.createSequence).toHaveBeenCalledWith('Test Sequence', 'rrc_demo');
    expect(result.current.state.currentSequence).toEqual(mockSequence);
  });

  it('adds a message to sequence with default data', async () => {
    const mockSequence: MscSequence = {
      id: 'seq-1',
      name: 'Test',
      protocol: 'rrc_demo',
      messages: [],
      subSequences: [],
      configurations: {},
      validationResults: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedSequence: MscSequence = {
      ...mockSequence,
      messages: [
        {
          id: 'msg-1',
          type_name: 'RRCConnectionRequest',
          data: { rrcConnectionRequest: { establishmentCause: 'mo-Signalling' } },
          sourceActor: 'UE',
          targetActor: 'gNB',
          timestamp: Date.now() / 1000,
        },
      ],
    };

    mockMscServiceInstance.getSequence.mockResolvedValue(mockSequence);
    mockMscServiceInstance.addMessageToSequence.mockResolvedValue(updatedSequence);

    const { result } = renderHook(() => useMscEditor());

    // First create a sequence
    await act(async () => {
      await result.current.createSequence('Test', 'rrc_demo');
    });

    // Then add a message
    await act(async () => {
      await result.current.addMessage({
        type_name: 'RRCConnectionRequest',
        data: { rrcConnectionRequest: { establishmentCause: 'mo-Signalling' } },
        source_actor: 'UE',
        target_actor: 'gNB',
      });
    });

    expect(mockMscServiceInstance.addMessageToSequence).toHaveBeenCalledWith(
      'seq-1',
      expect.objectContaining({
        type_name: 'RRCConnectionRequest',
        source_actor: 'UE',
        target_actor: 'gNB',
      })
    );

    await waitFor(() => {
      expect(result.current.state.currentSequence?.messages).toHaveLength(1);
    });
  });

  it('removes a message from sequence', async () => {
    const mockSequence: MscSequence = {
      id: 'seq-1',
      name: 'Test',
      protocol: 'rrc_demo',
      messages: [
        {
          id: 'msg-1',
          type_name: 'RRCConnectionRequest',
          data: {},
          sourceActor: 'UE',
          targetActor: 'gNB',
          timestamp: Date.now() / 1000,
        },
      ],
      subSequences: [],
      configurations: {},
      validationResults: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedSequence: MscSequence = {
      ...mockSequence,
      messages: [],
    };

    mockMscServiceInstance.getSequence.mockResolvedValue(mockSequence);
    mockMscServiceInstance.updateSequence.mockResolvedValue(updatedSequence);

    const { result } = renderHook(() => useMscEditor());

    await act(async () => {
      await result.current.createSequence('Test', 'rrc_demo');
    });

    await act(async () => {
      await result.current.removeMessage('msg-1');
    });

    expect(mockMscServiceInstance.updateSequence).toHaveBeenCalledWith(
      'seq-1',
      expect.objectContaining({
        remove_message: 'msg-1',
      })
    );
  });

  it('validates a sequence', async () => {
    const mockSequence: MscSequence = {
      id: 'seq-1',
      name: 'Test',
      protocol: 'rrc_demo',
      messages: [],
      subSequences: [],
      configurations: {},
      validationResults: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const validationResults = {
      results: [
        { type: 'error' as const, message: 'Test error' },
      ],
      hasErrors: true,
      errorCount: 1,
      warningCount: 0,
    };

    mockMscServiceInstance.getSequence.mockResolvedValue(mockSequence);
    mockMscServiceInstance.validateSequence.mockResolvedValue(validationResults);

    const { result } = renderHook(() => useMscEditor());

    await act(async () => {
      await result.current.createSequence('Test', 'rrc_demo');
    });

    await act(async () => {
      await result.current.validateSequence();
    });

    expect(mockMscServiceInstance.validateSequence).toHaveBeenCalledWith('seq-1');
    expect(result.current.state.currentSequence?.validationResults).toEqual(validationResults.results);
  });

  it('updates sequence name', async () => {
    const mockSequence: MscSequence = {
      id: 'seq-1',
      name: 'Old Name',
      protocol: 'rrc_demo',
      messages: [],
      subSequences: [],
      configurations: {},
      validationResults: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedSequence: MscSequence = {
      ...mockSequence,
      name: 'New Name',
    };

    mockMscServiceInstance.getSequence.mockResolvedValue(mockSequence);
    mockMscServiceInstance.updateSequence.mockResolvedValue(updatedSequence);

    const { result } = renderHook(() => useMscEditor());

    await act(async () => {
      await result.current.createSequence('Old Name', 'rrc_demo');
    });

    await act(async () => {
      await result.current.setSequenceName('New Name');
    });

    expect(mockMscServiceInstance.updateSequence).toHaveBeenCalledWith(
      'seq-1',
      { name: 'New Name' }
    );
  });

  it('handles undo/redo', async () => {
    const mockSequence: MscSequence = {
      id: 'seq-1',
      name: 'Test',
      protocol: 'rrc_demo',
      messages: [],
      subSequences: [],
      configurations: {},
      validationResults: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockMscServiceInstance.getSequence.mockResolvedValue(mockSequence);

    const { result } = renderHook(() => useMscEditor());

    await act(async () => {
      await result.current.createSequence('Test', 'rrc_demo');
    });

    // Initially can't undo
    expect(result.current.canUndo).toBe(false);

    // Add a message to create history
    const updatedSequence: MscSequence = {
      ...mockSequence,
      messages: [
        {
          id: 'msg-1',
          type_name: 'RRCConnectionRequest',
          data: {},
          sourceActor: 'UE',
          targetActor: 'gNB',
          timestamp: Date.now() / 1000,
        },
      ],
    };

    mockMscServiceInstance.addMessageToSequence.mockResolvedValue(updatedSequence);

    await act(async () => {
      await result.current.addMessage({
        type_name: 'RRCConnectionRequest',
        data: {},
        source_actor: 'UE',
        target_actor: 'gNB',
      });
    });

    // Now should be able to undo
    expect(result.current.canUndo).toBe(true);

    await act(() => {
      result.current.undo();
    });

    // After undo, should be able to redo
    expect(result.current.canRedo).toBe(true);
  });

  it('exports sequence as JSON', () => {
    const mockSequence: MscSequence = {
      id: 'seq-1',
      name: 'Test',
      protocol: 'rrc_demo',
      messages: [],
      subSequences: [],
      configurations: {},
      validationResults: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { result } = renderHook(() => useMscEditor());

    act(() => {
      // Manually set the sequence for testing
      (result.current.state as any).currentSequence = mockSequence;
    });

    const exported = result.current.exportSequence();
    expect(exported).toContain('"id":"seq-1"');
    expect(exported).toContain('"name":"Test"');
  });

  it('imports sequence from JSON', async () => {
    const importData = JSON.stringify({
      id: 'seq-2',
      name: 'Imported',
      protocol: 'rrc_demo',
      messages: [],
      subSequences: [],
      configurations: {},
      validationResults: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const mockSequence: MscSequence = JSON.parse(importData);
    mockMscServiceInstance.createSequence.mockResolvedValue(mockSequence);

    const { result } = renderHook(() => useMscEditor());

    await act(async () => {
      await result.current.importSequence(importData);
    });

    expect(mockMscServiceInstance.createSequence).toHaveBeenCalledWith('Imported', 'rrc_demo');
  });
});


/**
 * MSC Editor Integration Tests
 * Tests the main workflows of the MSC Editor
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock dependencies before imports
vi.mock('../services/mscService', () => ({
    default: {
        createSequence: vi.fn(),
        getSequence: vi.fn(),
        updateSequence: vi.fn(),
        deleteSequence: vi.fn(),
        listSequences: vi.fn(),
        addMessage: vi.fn(),
        validateSequence: vi.fn(),
        getFieldSuggestions: vi.fn(),
        detectIdentifiers: vi.fn(),
    }
}));

vi.mock('../services/mscSessionService', () => ({
    default: {
        listSessions: vi.fn().mockResolvedValue([]),
        createSession: vi.fn(),
        getSession: vi.fn(),
        updateSession: vi.fn(),
        deleteSession: vi.fn(),
    }
}));

import { useMscEditor } from '../hooks/useMscEditor';
import MscService from '../services/mscService';

describe('useMscEditor Hook - Main Workflows', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();

        // Default mock implementations
        (MscService.listSequences as any).mockResolvedValue([]);
        (MscService.createSequence as any).mockImplementation(async (name: string, protocol: string) => ({
            id: `seq-${Date.now()}`,
            name,
            protocol,
            messages: [],
            configurations: {},
            validationResults: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }));
    });

    afterEach(() => {
        localStorage.clear();
    });

    describe('Sequence Creation Workflow', () => {
        it('should create a new sequence successfully', async () => {
            const mockSequence = {
                id: 'seq-123',
                name: 'Test Sequence',
                protocol: 'rrc_demo',
                messages: [],
                configurations: {},
                validationResults: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            (MscService.createSequence as any).mockResolvedValue(mockSequence);

            const { result } = renderHook(() => useMscEditor());

            await act(async () => {
                await result.current.createSequence('Test Sequence', 'rrc_demo');
            });

            expect(MscService.createSequence).toHaveBeenCalledWith('Test Sequence', 'rrc_demo', undefined);
            expect(result.current.state.currentSequence).toEqual(mockSequence);
        });

        it('should create sequence with session ID', async () => {
            const mockSequence = {
                id: 'seq-456',
                name: 'Session Sequence',
                protocol: 'rrc_demo',
                messages: [],
                session_id: 'session-123',
                configurations: {},
                validationResults: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            (MscService.createSequence as any).mockResolvedValue(mockSequence);

            const { result } = renderHook(() => useMscEditor());

            await act(async () => {
                await result.current.createSequence('Session Sequence', 'rrc_demo', 'session-123');
            });

            expect(MscService.createSequence).toHaveBeenCalledWith('Session Sequence', 'rrc_demo', 'session-123');
        });

        it('should handle sequence creation error', async () => {
            (MscService.createSequence as any).mockRejectedValue(new Error('Network error'));

            const { result } = renderHook(() => useMscEditor());

            await expect(
                act(async () => {
                    await result.current.createSequence('Fail Sequence', 'rrc_demo');
                })
            ).rejects.toThrow('Network error');

            expect(result.current.state.error).toBeTruthy();
        });
    });

    describe('Add Message Workflow', () => {
        it('should add a message to the current sequence', async () => {
            const initialSequence = {
                id: 'seq-789',
                name: 'Message Test',
                protocol: 'rrc_demo',
                messages: [],
                configurations: {},
                validationResults: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const updatedSequence = {
                ...initialSequence,
                messages: [{
                    id: 'msg-1',
                    type_name: 'RRCConnectionRequest',
                    data: { field: 'value' },
                    source_actor: 'UE',
                    target_actor: 'gNB',
                    timestamp: Date.now() / 1000
                }]
            };

            (MscService.createSequence as any).mockResolvedValue(initialSequence);
            (MscService.addMessage as any).mockResolvedValue(updatedSequence);

            const { result } = renderHook(() => useMscEditor());

            // First create a sequence
            await act(async () => {
                await result.current.createSequence('Message Test', 'rrc_demo');
            });

            // Then add a message
            await act(async () => {
                await result.current.addMessage({
                    type_name: 'RRCConnectionRequest',
                    data: { field: 'value' },
                    source_actor: 'UE',
                    target_actor: 'gNB'
                });
            });

            expect(MscService.addMessage).toHaveBeenCalled();
            expect(result.current.state.currentSequence?.messages).toHaveLength(1);
        });

        it('should fail to add message without a sequence', async () => {
            const { result } = renderHook(() => useMscEditor());

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

    describe('Update Message Workflow', () => {
        it('should update an existing message', async () => {
            const initialSequence = {
                id: 'seq-update',
                name: 'Update Test',
                protocol: 'rrc_demo',
                messages: [{
                    id: 'msg-1',
                    type_name: 'RRCConnectionRequest',
                    data: { original: 'data' },
                    source_actor: 'UE',
                    target_actor: 'gNB',
                    timestamp: Date.now() / 1000
                }],
                configurations: {},
                validationResults: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const updatedSequence = {
                ...initialSequence,
                messages: [{
                    ...initialSequence.messages[0],
                    data: { updated: 'data' }
                }]
            };

            (MscService.createSequence as any).mockResolvedValue(initialSequence);
            (MscService.updateSequence as any).mockResolvedValue(updatedSequence);

            const { result } = renderHook(() => useMscEditor());

            await act(async () => {
                await result.current.createSequence('Update Test', 'rrc_demo');
            });

            await act(async () => {
                await result.current.updateMessage('msg-1', { updated: 'data' });
            });

            expect(MscService.updateSequence).toHaveBeenCalledWith(
                'seq-update',
                expect.objectContaining({
                    update_message: { id: 'msg-1', data: { updated: 'data' } }
                })
            );
        });
    });

    describe('Remove Message Workflow', () => {
        it('should remove a message from the sequence', async () => {
            const initialSequence = {
                id: 'seq-remove',
                name: 'Remove Test',
                protocol: 'rrc_demo',
                messages: [
                    { id: 'msg-1', type_name: 'Msg1', data: {}, source_actor: 'UE', target_actor: 'gNB', timestamp: 1 },
                    { id: 'msg-2', type_name: 'Msg2', data: {}, source_actor: 'gNB', target_actor: 'UE', timestamp: 2 }
                ],
                configurations: {},
                validationResults: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const afterRemove = {
                ...initialSequence,
                messages: [initialSequence.messages[1]]
            };

            (MscService.createSequence as any).mockResolvedValue(initialSequence);
            (MscService.updateSequence as any).mockResolvedValue(afterRemove);

            const { result } = renderHook(() => useMscEditor());

            await act(async () => {
                await result.current.createSequence('Remove Test', 'rrc_demo');
            });

            await act(async () => {
                await result.current.removeMessage('msg-1');
            });

            expect(MscService.updateSequence).toHaveBeenCalledWith(
                'seq-remove',
                expect.objectContaining({ remove_message: 'msg-1' })
            );
            expect(result.current.state.currentSequence?.messages).toHaveLength(1);
        });
    });

    describe('Sequence Validation Workflow', () => {
        it('should validate the current sequence', async () => {
            const mockSequence = {
                id: 'seq-validate',
                name: 'Validate Test',
                protocol: 'rrc_demo',
                messages: [{ id: 'msg-1', type_name: 'Test', data: {}, source_actor: 'UE', target_actor: 'gNB', timestamp: 1 }],
                configurations: {},
                validationResults: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const validationResults = [
                { type: 'warning', message: 'Missing field', field: 'test' }
            ];

            (MscService.createSequence as any).mockResolvedValue(mockSequence);
            (MscService.validateSequence as any).mockResolvedValue(validationResults);

            const { result } = renderHook(() => useMscEditor());

            await act(async () => {
                await result.current.createSequence('Validate Test', 'rrc_demo');
            });

            await act(async () => {
                await result.current.validateSequence();
            });

            expect(MscService.validateSequence).toHaveBeenCalledWith('seq-validate');
            expect(result.current.state.validationResults).toHaveLength(1);
        });
    });

    describe('Delete Sequence Workflow', () => {
        it('should delete a sequence', async () => {
            const mockSequence = {
                id: 'seq-delete',
                name: 'Delete Test',
                protocol: 'rrc_demo',
                messages: [],
                configurations: {},
                validationResults: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            (MscService.createSequence as any).mockResolvedValue(mockSequence);
            (MscService.deleteSequence as any).mockResolvedValue(true);

            const { result } = renderHook(() => useMscEditor());

            await act(async () => {
                await result.current.createSequence('Delete Test', 'rrc_demo');
            });

            expect(result.current.state.currentSequence).not.toBeNull();

            await act(async () => {
                await result.current.deleteSequence('seq-delete');
            });

            expect(MscService.deleteSequence).toHaveBeenCalledWith('seq-delete');
        });
    });

    describe('Load All Sequences Workflow', () => {
        it('should load all sequences for a session', async () => {
            const mockSequences = [
                { id: 'seq-1', name: 'Seq 1', protocol: 'rrc_demo', messages: [], session_id: 'session-1' },
                { id: 'seq-2', name: 'Seq 2', protocol: 'rrc_demo', messages: [], session_id: 'session-1' }
            ];

            (MscService.listSequences as any).mockResolvedValue(mockSequences);

            const { result } = renderHook(() => useMscEditor());

            await act(async () => {
                await result.current.loadAllSequences('session-1');
            });

            expect(MscService.listSequences).toHaveBeenCalledWith('session-1');
            expect(result.current.state.sequences).toHaveLength(2);
        });
    });

    describe('Export/Import Workflow', () => {
        it('should export sequence as JSON string', async () => {
            const mockSequence = {
                id: 'seq-export',
                name: 'Export Test',
                protocol: 'rrc_demo',
                messages: [{ id: 'msg-1', type_name: 'Test', data: { field: 'value' }, source_actor: 'UE', target_actor: 'gNB', timestamp: 1 }],
                configurations: {},
                validationResults: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            (MscService.createSequence as any).mockResolvedValue(mockSequence);

            const { result } = renderHook(() => useMscEditor());

            await act(async () => {
                await result.current.createSequence('Export Test', 'rrc_demo');
            });

            let exported: string = '';
            act(() => {
                exported = result.current.exportSequence();
            });

            const parsed = JSON.parse(exported);
            expect(parsed.name).toBe('Export Test');
            expect(parsed.messages).toHaveLength(1);
        });

        it('should import sequence from JSON string', async () => {
            const importData = JSON.stringify({
                name: 'Imported Sequence',
                protocol: 'rrc_demo',
                messages: [
                    { type_name: 'RRCTest', data: { test: true }, source_actor: 'UE', target_actor: 'gNB' }
                ]
            });

            const createdSeq = {
                id: 'seq-imported',
                name: 'Imported Sequence',
                protocol: 'rrc_demo',
                messages: [],
                configurations: {},
                validationResults: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const afterAddMessage = {
                ...createdSeq,
                messages: [{ id: 'msg-1', type_name: 'RRCTest', data: { test: true }, source_actor: 'UE', target_actor: 'gNB', timestamp: 1 }]
            };

            (MscService.createSequence as any).mockResolvedValue(createdSeq);
            (MscService.addMessage as any).mockResolvedValue(afterAddMessage);

            const { result } = renderHook(() => useMscEditor());

            await act(async () => {
                await result.current.importSequence(importData);
            });

            expect(MscService.createSequence).toHaveBeenCalledWith('Imported Sequence', 'rrc_demo', undefined);
            expect(MscService.addMessage).toHaveBeenCalled();
        });
    });

    describe('Message Selection Workflow', () => {
        it('should select a message by index', async () => {
            const mockSequence = {
                id: 'seq-select',
                name: 'Select Test',
                protocol: 'rrc_demo',
                messages: [
                    { id: 'msg-1', type_name: 'Msg1', data: {}, source_actor: 'UE', target_actor: 'gNB', timestamp: 1 },
                    { id: 'msg-2', type_name: 'Msg2', data: {}, source_actor: 'gNB', target_actor: 'UE', timestamp: 2 }
                ],
                configurations: {},
                validationResults: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            (MscService.createSequence as any).mockResolvedValue(mockSequence);

            const { result } = renderHook(() => useMscEditor());

            await act(async () => {
                await result.current.createSequence('Select Test', 'rrc_demo');
            });

            act(() => {
                result.current.selectMessage(1);
            });

            expect(result.current.state.selectedMessageIndex).toBe(1);
        });

        it('should deselect message when null is passed', async () => {
            const { result } = renderHook(() => useMscEditor());

            act(() => {
                result.current.selectMessage(0);
            });

            expect(result.current.state.selectedMessageIndex).toBe(0);

            act(() => {
                result.current.selectMessage(null);
            });

            expect(result.current.state.selectedMessageIndex).toBeNull();
        });
    });
});

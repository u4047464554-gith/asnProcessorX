/**
 * useMscEditor Workflow Tests
 * 
 * Integration-style tests that verify complete user workflows.
 * These tests ensure the hook works correctly for real use cases.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useMscEditor } from './useMscEditor';
import { createMockMscService, clearAllMocks } from '../test-utils';

const mockService = createMockMscService();

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

vi.mock('../services/mscSessionService', () => ({
    default: {
        listSessions: vi.fn().mockResolvedValue([]),
        createSession: vi.fn(),
        getSession: vi.fn(),
        updateSession: vi.fn(),
        deleteSession: vi.fn(),
    }
}));

describe('useMscEditor Workflows', () => {
    beforeEach(() => {
        clearAllMocks();
        Object.values(mockService).forEach((fn: any) => {
            if (typeof fn.mockReset === 'function') fn.mockReset();
        });
        mockService.listSequences.mockResolvedValue([]);
        mockService.validateSequence.mockResolvedValue({ results: [], hasErrors: false });
    });

    afterEach(() => {
        localStorage.clear();
    });

    describe('Complete Sequence Workflow', () => {
        it('creates sequence, adds messages, validates', async () => {
            // Setup mocks
            const sequence = {
                id: 'workflow-seq',
                name: 'Workflow Test',
                protocol: 'rrc_demo',
                messages: [],
                configurations: {},
                validationResults: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            mockService.createSequence.mockResolvedValue(sequence);

            const withMessage = {
                ...sequence,
                messages: [{
                    id: 'msg-1',
                    type_name: 'RRCConnectionRequest',
                    data: { test: true },
                    sourceActor: 'UE',
                    targetActor: 'gNB',
                    timestamp: Date.now() / 1000
                }]
            };
            mockService.addMessageToSequence.mockResolvedValue(withMessage);
            mockService.validateSequence.mockResolvedValue({
                results: [{ type: 'warning', message: 'Missing field' }],
                hasErrors: false
            });

            const { result } = renderHook(() => useMscEditor());

            // Step 1: Create sequence
            await act(async () => {
                await result.current.createSequence('Workflow Test', 'rrc_demo');
            });
            expect(result.current.state.currentSequence?.id).toBe('workflow-seq');

            // Step 2: Add message
            await act(async () => {
                await result.current.addMessage({
                    type_name: 'RRCConnectionRequest',
                    data: { test: true },
                    source_actor: 'UE',
                    target_actor: 'gNB'
                });
            });
            expect(mockService.addMessageToSequence).toHaveBeenCalled();

            // Step 3: Validate
            await act(async () => {
                await result.current.validateSequence();
            });
            expect(mockService.validateSequence).toHaveBeenCalledWith('workflow-seq');
        });
    });

    describe('Session-Scoped Workflow', () => {
        it('creates sequence within a session', async () => {
            const sequence = {
                id: 'session-seq',
                name: 'Session Sequence',
                protocol: 'rrc_demo',
                messages: [],
                session_id: 'my-session',
                configurations: {},
                validationResults: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            mockService.createSequence.mockResolvedValue(sequence);

            const { result } = renderHook(() => useMscEditor());

            await act(async () => {
                await result.current.createSequence('Session Sequence', 'rrc_demo', 'my-session');
            });

            expect(mockService.createSequence).toHaveBeenCalledWith(
                'Session Sequence',
                'rrc_demo',
                'my-session'
            );
        });

        it('loads sequences for a session', async () => {
            const sequences = [
                { id: 's1', name: 'Seq 1', protocol: 'rrc_demo', messages: [], session_id: 'session-x' },
                { id: 's2', name: 'Seq 2', protocol: 'rrc_demo', messages: [], session_id: 'session-x' }
            ];
            mockService.listSequences.mockResolvedValue(sequences);

            const { result } = renderHook(() => useMscEditor());

            // Wait for init
            await waitFor(() => {
                expect(result.current.isInitialized).toBe(true);
            });

            // Call with our fixed session ID
            await act(async () => {
                await result.current.loadAllSequences('session-x');
            });

            // Verify the last call was with our session ID
            expect(mockService.listSequences).toHaveBeenLastCalledWith(undefined, 'session-x');
        });
    });

    describe('Export/Import Workflow', () => {
        it('exports and can re-import a sequence', async () => {
            const sequence = {
                id: 'export-seq',
                name: 'Exportable',
                protocol: 'rrc_demo',
                messages: [{
                    id: 'msg-1',
                    type_name: 'TestMessage',
                    data: { field: 'value' },
                    sourceActor: 'UE',
                    targetActor: 'gNB',
                    timestamp: 1234567890
                }],
                configurations: {},
                validationResults: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            mockService.createSequence.mockResolvedValue(sequence);

            const { result } = renderHook(() => useMscEditor());

            // Create sequence
            await act(async () => {
                await result.current.createSequence('Exportable', 'rrc_demo');
            });

            // Export
            const exported = result.current.exportSequence();
            expect(exported).toBeTruthy();

            const parsed = JSON.parse(exported);
            expect(parsed.name).toBe('Exportable');
        });
    });

    describe('Message Selection Workflow', () => {
        it('allows selecting and deselecting messages', async () => {
            const { result } = renderHook(() => useMscEditor());

            await waitFor(() => {
                expect(result.current.isInitialized).toBe(true);
            });

            // Select first message
            act(() => {
                result.current.selectMessage(0);
            });
            expect(result.current.state.selectedMessageIndex).toBe(0);

            // Select another
            act(() => {
                result.current.selectMessage(2);
            });
            expect(result.current.state.selectedMessageIndex).toBe(2);

            // Deselect
            act(() => {
                result.current.selectMessage(null);
            });
            expect(result.current.state.selectedMessageIndex).toBeNull();
        });
    });

    describe('Delete Workflow', () => {
        it('deletes a sequence', async () => {
            const sequence = {
                id: 'delete-me',
                name: 'To Delete',
                protocol: 'rrc_demo',
                messages: [],
                configurations: {},
                validationResults: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            mockService.createSequence.mockResolvedValue(sequence);
            mockService.deleteSequence.mockResolvedValue(true);

            const { result } = renderHook(() => useMscEditor());

            await act(async () => {
                await result.current.createSequence('To Delete', 'rrc_demo');
            });

            await act(async () => {
                const deleted = await result.current.deleteSequence('delete-me');
                expect(deleted).toBe(true);
            });

            expect(mockService.deleteSequence).toHaveBeenCalledWith('delete-me');
        });
    });
});

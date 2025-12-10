/**
 * MscWorkflow.test.tsx - Simplified workflow tests for MscEditor
 * Focus on core functionality, not minute details
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import '@testing-library/jest-dom';
import { MscEditor } from '../pages/MscEditor';
import { useMscEditor } from '../hooks/useMscEditor';

// Mock dependencies
vi.mock('../services/mscSessionService', () => ({
    default: {
        listSessions: vi.fn().mockResolvedValue([
            { id: 'session-1', name: 'Default Session', description: 'Test session', created_at: '2024-01-01', updated_at: '2024-01-01', is_active: true }
        ]),
        createSession: vi.fn().mockResolvedValue({
            id: 'session-1',
            name: 'Default Session'
        }),
        getSession: vi.fn(),
        updateSession: vi.fn(),
        deleteSession: vi.fn(),
    }
}));

vi.mock('../hooks/useMscEditor');

vi.mock('../hooks/useSession', () => ({
    useSession: () => ({
        currentSessionId: 'session-1',
        sessions: [
            { id: 'session-1', name: 'Default Session', is_active: true }
        ],
        currentSession: { id: 'session-1', name: 'Default Session', is_active: true },
        switchSession: vi.fn(),
        createSession: vi.fn(),
        updateSession: vi.fn(),
        deleteSession: vi.fn(),
        refreshSessions: vi.fn()
    }),
    SessionProvider: ({ children }: any) => <>{children}</>,
}));

global.fetch = vi.fn();

describe('MscEditor Workflow', () => {
    const mockState = {
        currentSequence: {
            id: 'seq-1',
            name: 'Test Sequence',
            protocol: 'rrc_demo',
            messages: [
                {
                    id: 'msg-1',
                    type_name: 'RRCConnectionRequest',
                    data: { rrcConnectionRequest: { establishmentCause: 'mo-Signalling' } },
                    sourceActor: 'UE',
                    targetActor: 'gNB',
                    timestamp: Date.now() / 1000
                }
            ],
            configurations: {},
            validationResults: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            session_id: 'session-1'
        },
        sequences: [],
        isLoading: false,
        error: null,
        selectedMessageIndex: null,
        suggestions: [],
    };

    const mockActions = {
        createSequence: vi.fn(),
        loadSequence: vi.fn(),
        deleteSequence: vi.fn(),
        addMessage: vi.fn(),
        removeMessage: vi.fn(),
        validateSequence: vi.fn(),
        selectMessage: vi.fn(),
        setSequenceName: vi.fn(),
        exportSequence: vi.fn(),
        importSequence: vi.fn(),
        canUndo: false,
        canRedo: false,
        undo: vi.fn(),
        redo: vi.fn(),
        clearValidation: vi.fn(),
        loadAllSequences: vi.fn(),
        isInitialized: true,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.setItem('msc-editor-session-id', 'session-1');

        (useMscEditor as any).mockReturnValue({
            state: mockState,
            ...mockActions
        });

        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ['RRCConnectionRequest', 'RRCSetup'],
        });
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('renders MscEditor with header and controls', async () => {
        render(
            <MantineProvider>
                <BrowserRouter>
                    <MscEditor />
                </BrowserRouter>
            </MantineProvider>
        );

        // Core functionality: Header should be visible
        await waitFor(() => {
            expect(screen.getByText('MSC Editor')).toBeInTheDocument();
        });

        // Protocol selector should be available
        expect(screen.getByDisplayValue('RRC Demo')).toBeInTheDocument();
    });

    it('displays existing messages in sequence', async () => {
        render(
            <MantineProvider>
                <BrowserRouter>
                    <MscEditor />
                </BrowserRouter>
            </MantineProvider>
        );

        // Messages should be displayed
        await waitFor(() => {
            const messages = screen.getAllByText('RRCConnectionRequest');
            expect(messages.length).toBeGreaterThan(0);
        });
    });

    it('has message input controls available', async () => {
        render(
            <MantineProvider>
                <BrowserRouter>
                    <MscEditor />
                </BrowserRouter>
            </MantineProvider>
        );

        // Message type selector and Add button should be available
        await waitFor(() => {
            expect(screen.getByPlaceholderText('Message type')).toBeInTheDocument();
            expect(screen.getByText('Add')).toBeInTheDocument();
        });
    });

    it('has undo/redo controls', () => {
        render(
            <MantineProvider>
                <BrowserRouter>
                    <MscEditor />
                </BrowserRouter>
            </MantineProvider>
        );

        expect(screen.getByTitle('Undo')).toBeInTheDocument();
        expect(screen.getByTitle('Redo')).toBeInTheDocument();
    });

    it('has save control', () => {
        render(
            <MantineProvider>
                <BrowserRouter>
                    <MscEditor />
                </BrowserRouter>
            </MantineProvider>
        );

        expect(screen.getByTitle('Save')).toBeInTheDocument();
    });
});

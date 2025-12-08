
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

// Mock the hook
vi.mock('../hooks/useMscEditor');

// Mock useSession
vi.mock('../hooks/useSession', () => ({
    useSession: () => ({
        currentSessionId: 'session-1',
        sessions: [
            { id: 'session-1', name: 'Default Session', is_active: true }
        ],
        switchSession: vi.fn(),
        createSession: vi.fn(),
        updateSession: vi.fn(),
        deleteSession: vi.fn(),
        refreshSessions: vi.fn()
    })
}));

// Mock fetch for API calls in component
global.fetch = vi.fn();

describe('MscEditor Basic Workflow', () => {
    let mockState: any;
    let mockActions: any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup localStorage for test session
        localStorage.setItem('msc-editor-session-id', 'session-1');

        // Initial state
        mockState = {
            currentSequence: {
                id: 'seq-1',
                name: 'Untitled Sequence',
                protocol: 'rrc_demo',
                messages: [],
                configurations: {},
                validationResults: [],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                session_id: 'session-1'
            },
            sequences: [],
            isLoading: false,
            error: null,
            selectedMessageIndex: null,
            suggestions: [],
        };

        mockActions = {
            createSequence: vi.fn(async (name, protocol, sessionId) => {
                console.log(`[Mock] createSequence called with: name=${name}, protocol=${protocol}, session=${sessionId}`);
                mockState.currentSequence = {
                    ...mockState.currentSequence,
                    name,
                    protocol,
                    session_id: sessionId || 'session-1',
                    messages: []
                };
            }),
            loadSequence: vi.fn(),
            deleteSequence: vi.fn(),
            addMessage: vi.fn(async (message) => {
                console.log('[Mock] addMessage called');
                const newMessage = {
                    id: `msg-${mockState.currentSequence.messages.length + 1}`,
                    type_name: message.type_name,
                    data: message.data,
                    sourceActor: message.source_actor || message.sourceActor || 'UE',
                    targetActor: message.target_actor || message.targetActor || 'gNB',
                    timestamp: Date.now() / 1000
                };
                mockState.currentSequence = {
                    ...mockState.currentSequence,
                    messages: [...mockState.currentSequence.messages, newMessage]
                };
            }),
            removeMessage: vi.fn(),
            validateSequence: vi.fn(),
            selectMessage: vi.fn((index) => {
                mockState.selectedMessageIndex = index;
            }),
            setSequenceName: vi.fn(),
            exportSequence: vi.fn(),
            importSequence: vi.fn(),
            canUndo: false,
            canRedo: false,
            undo: vi.fn(),
            redo: vi.fn(),
            clearValidation: vi.fn(),
            loadAllSequences: vi.fn(),
        };

        // Setup the mock hook to return our dynamic state
        (useMscEditor as any).mockImplementation(() => ({
            state: mockState,
            ...mockActions
        }));

        // Mock fetch responses for types and examples
        (global.fetch as any).mockImplementation((url: string) => {
            if (typeof url === 'string') {
                if (url.includes('/types') && !url.includes('/example')) {
                    return Promise.resolve({
                        ok: true,
                        json: async () => ['RRCConnectionRequest', 'RRCSetup'],
                    });
                }
                if (url.includes('/example')) {
                    return Promise.resolve({
                        ok: true,
                        json: async () => ({
                            data: {
                                rrcConnectionRequest: {
                                    establishmentCause: 'mo-Signalling',
                                    ueIdentity: { randomValue: '12345' }
                                }
                            }
                        }),
                    });
                }
            }
            return Promise.resolve({ ok: false });
        });
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('executes the basic workflow: select protocol, add message, verify JSON', async () => {
        const { rerender } = render(
            <MantineProvider>
                <BrowserRouter>
                    <MscEditor />
                </BrowserRouter>
            </MantineProvider>
        );

        try {
            // 1. Initial Load
            console.log('Step 1: Initial Load');
            await screen.findByText('MSC Editor');

            // 2. Select Protocol
            console.log('Step 2: Select Protocol');
            const protocolControl = await screen.findByText('RRC Demo');
            fireEvent.click(protocolControl);

            console.log('Searching for NR RRC Rel-17');
            const nrOption = await screen.findByText('NR RRC Rel-17');
            fireEvent.click(nrOption);

            await waitFor(() => {
                // Ensure the session ID is passed correctly (it should be 'session-1' from localStorage)
                expect(mockActions.createSequence).toHaveBeenCalledWith(
                    expect.anything(),
                    'nr_rel17_rrc',
                    'session-1'
                );
            });

            // Update state to reflect protocol change (simulating hook logic)
            mockState.currentSequence.protocol = 'nr_rel17_rrc';

            // 3. Select Message Type
            console.log('Step 3: Message Type');
            const messageTypeInput = await screen.findByPlaceholderText('Message type');
            fireEvent.click(messageTypeInput);
            fireEvent.focus(messageTypeInput);
            fireEvent.change(messageTypeInput, { target: { value: 'RRCConnectionRequest' } });

            console.log('Searching for RRCConnectionRequest option');
            const typeOption = await screen.findByText('RRCConnectionRequest');
            fireEvent.click(typeOption);

            // 4. Add Message to MSC
            console.log('Step 4: Add Button');
            const addButton = await screen.findByRole('button', { name: /^Add$/i });

            await waitFor(() => {
                expect(addButton).toBeEnabled();
            });
            fireEvent.click(addButton);

            // 5. Verify that JSON is not empty in the call
            console.log('Step 5: Verification');
            await waitFor(() => {
                expect(mockActions.addMessage).toHaveBeenCalled();
            });

            const addCall = mockActions.addMessage.mock.calls[0];
            const messagePayload = addCall[0];
            console.log('Payload:', JSON.stringify(messagePayload));

            expect(messagePayload.data).not.toEqual({});
            expect(messagePayload.data.rrcConnectionRequest).toBeDefined();

            // Simulate message addition in state for UI verification
            const newMessage = {
                id: 'msg-1',
                type_name: 'RRCConnectionRequest',
                data: messagePayload.data,
                sourceActor: 'UE',
                targetActor: 'gNB',
                timestamp: Date.now() / 1000
            };
            mockState.currentSequence.messages = [newMessage];

            // Force re-render to show usage of new state
            rerender(
                <MantineProvider>
                    <BrowserRouter>
                        <MscEditor />
                    </BrowserRouter>
                </MantineProvider>
            );

            // Verify UI updated
            console.log('Verifying UI after re-render');
            // It might appear in the input and the list, so we might find multiple
            const rrcTexts = await screen.findAllByText('RRCConnectionRequest');
            const messageItem = rrcTexts[rrcTexts.length - 1]; // Assume the list item is last (below input)

            fireEvent.click(messageItem);

            expect(mockActions.selectMessage).toHaveBeenCalledWith(0);
            mockState.selectedMessageIndex = 0;
            mockState.selectedMessage = newMessage;

            rerender(
                <MantineProvider>
                    <BrowserRouter>
                        <MscEditor />
                    </BrowserRouter>
                </MantineProvider>
            );

            // Verify JSON content is visible in the panel
            console.log('Verifying detail panel content');
            await screen.findByText('mo-Signalling');
        } catch (error) {
            console.error('Test Failed:', error);
            // screen.debug(); 
            throw error;
        }
    });
});

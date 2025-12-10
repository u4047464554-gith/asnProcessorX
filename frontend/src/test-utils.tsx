/**
 * Shared Test Utilities for Frontend Tests
 * 
 * This file provides consistent mocking patterns for all frontend tests,
 * following SOLID principles and avoiding tight coupling to implementation.
 */
import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import React from 'react';

// ============================================================================
// Mock Service Implementations
// ============================================================================

/**
 * Create a fully mocked MscService instance
 */
export const createMockMscService = () => ({
    createSequence: vi.fn().mockResolvedValue({
        id: 'test-seq-1',
        name: 'Test Sequence',
        protocol: 'rrc_demo',
        messages: [],
        configurations: {},
        validationResults: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    }),
    getSequence: vi.fn().mockResolvedValue(null),
    updateSequence: vi.fn().mockResolvedValue(null),
    deleteSequence: vi.fn().mockResolvedValue(true),
    addMessageToSequence: vi.fn().mockResolvedValue(null),
    listSequences: vi.fn().mockResolvedValue([]),
    validateSequence: vi.fn().mockResolvedValue({ results: [], hasErrors: false }),
    getFieldSuggestions: vi.fn().mockResolvedValue([]),
    detectIdentifiers: vi.fn().mockResolvedValue([]),
    decodeHexToMscMessages: vi.fn().mockResolvedValue([]),
});

/**
 * Create a fully mocked Session context
 */
export const createMockSessionContext = () => ({
    currentSessionId: 'test-session-1',
    sessions: [{
        id: 'test-session-1',
        name: 'Test Session',
        description: 'Test session',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active: true
    }],
    currentSession: {
        id: 'test-session-1',
        name: 'Test Session',
        description: 'Test session',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active: true
    },
    isLoading: false,
    error: null,
    createSession: vi.fn().mockResolvedValue({ id: 'new-session', name: 'New Session' }),
    switchSession: vi.fn(),
    updateSession: vi.fn(),
    deleteSession: vi.fn(),
    refreshSessions: vi.fn(),
});

/**
 * Create a mock useMscEditor hook return value
 */
export const createMockUseMscEditor = () => ({
    state: {
        currentSequence: null,
        sequences: [],
        isLoading: false,
        error: null,
        selectedMessageIndex: null,
        suggestions: [],
        validationResults: [],
        isValidating: false,
    },
    createSequence: vi.fn().mockResolvedValue({
        id: 'seq-1',
        name: 'New Sequence',
        protocol: 'rrc_demo',
        messages: []
    }),
    loadSequence: vi.fn().mockResolvedValue(null),
    updateSequence: vi.fn().mockResolvedValue(null),
    deleteSequence: vi.fn().mockResolvedValue(true),
    addMessage: vi.fn().mockResolvedValue(null),
    updateMessage: vi.fn().mockResolvedValue(null),
    removeMessage: vi.fn().mockResolvedValue(true),
    duplicateMessage: vi.fn().mockResolvedValue(undefined),
    validateSequence: vi.fn().mockResolvedValue({ results: [] }),
    clearValidation: vi.fn(),
    getFieldSuggestions: vi.fn().mockResolvedValue([]),
    applySuggestion: vi.fn(),
    detectIdentifiers: vi.fn().mockResolvedValue([]),
    selectMessage: vi.fn(),
    setSequenceName: vi.fn(),
    duplicateSequence: vi.fn().mockResolvedValue(null),
    canUndo: false,
    canRedo: false,
    undo: vi.fn(),
    redo: vi.fn(),
    reset: vi.fn(),
    exportSequence: vi.fn().mockReturnValue('{}'),
    importSequence: vi.fn().mockResolvedValue(null),
    loadAllSequences: vi.fn().mockResolvedValue(undefined),
    isInitialized: true,
});

// ============================================================================
// Test Wrapper Components
// ============================================================================

interface WrapperProps {
    children: React.ReactNode;
}

/**
 * Standard wrapper for all component tests
 * Provides Router, Mantine, and Session context
 */
export const TestWrapper: React.FC<WrapperProps> = ({ children }) => {
    return (
        <MantineProvider>
            <MemoryRouter>
                {children}
            </MemoryRouter>
        </MantineProvider>
    );
};

/**
 * Render with all standard providers
 */
export const renderWithProviders = (ui: React.ReactElement) => {
    return render(ui, { wrapper: TestWrapper });
};

// ============================================================================
// Common Setup Functions
// ============================================================================

/**
 * Setup common browser mocks (ResizeObserver, matchMedia, etc.)
 */
export const setupBrowserMocks = () => {
    // ResizeObserver
    if (typeof window !== 'undefined') {
        class MockResizeObserver {
            observe() { }
            unobserve() { }
            disconnect() { }
        }
        window.ResizeObserver = MockResizeObserver as any;
    }

    // matchMedia
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });

    // scrollTo
    window.scrollTo = vi.fn() as any;
};

/**
 * Setup fetch mock with sensible defaults
 */
export const setupFetchMock = () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
        // Default responses based on URL patterns
        if (url.includes('/types')) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(['RRCConnectionRequest', 'RRCSetup'])
            });
        }
        if (url.includes('/protocols')) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(['rrc_demo', 'nr_rel17_rrc'])
            });
        }
        // Default
        return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({})
        });
    }) as any;
};

/**
 * Clear all mocks in beforeEach
 */
export const clearAllMocks = () => {
    vi.clearAllMocks();
    if (typeof localStorage !== 'undefined') {
        localStorage.clear();
    }
};

/**
 * MscEditor.session.test.tsx - Session management tests
 * Focus on core functionality
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { MscEditor } from './MscEditor';
import { useMscEditor } from '../hooks/useMscEditor';

// Mock dependencies
vi.mock('../hooks/useMscEditor');
vi.mock('../services/mscSessionService', () => ({
  default: {
    listSessions: vi.fn().mockResolvedValue([
      { id: 'session-1', name: 'Default Session', description: 'Test session', created_at: '2024-01-01', updated_at: '2024-01-01', is_active: true }
    ]),
    createSession: vi.fn().mockResolvedValue({
      id: 'session-1',
      name: 'Default Session',
      description: 'Test session',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
      is_active: true,
    }),
    getSession: vi.fn(),
    updateSession: vi.fn(),
    deleteSession: vi.fn(),
  },
}));
vi.mock('../hooks/useSession', () => ({
  useSession: vi.fn(() => ({
    sessions: [{ id: 'session-1', name: 'Default Session', description: 'Test session', created_at: '2024-01-01', updated_at: '2024-01-01', is_active: true }],
    currentSessionId: 'session-1',
    currentSession: { id: 'session-1', name: 'Default Session', description: 'Test session', created_at: '2024-01-01', updated_at: '2024-01-01', is_active: true },
    loading: false,
    createSession: vi.fn().mockResolvedValue({ id: 'new-session', name: 'New' }),
    switchSession: vi.fn(),
    updateSession: vi.fn(),
    deleteSession: vi.fn().mockResolvedValue(true),
    refreshSessions: vi.fn(),
  })),
  SessionProvider: ({ children }: any) => <>{children}</>,
}));

// Mock fetch for protocol types
global.fetch = vi.fn();

const mockMscEditorHook = {
  state: {
    currentSequence: null,
    sequences: [],
    isLoading: false,
    error: null,
    selectedMessageIndex: null,
    suggestions: [],
  },
  createSequence: vi.fn().mockResolvedValue({ id: 'seq-1', name: 'Test' }),
  loadSequence: vi.fn().mockResolvedValue(null),
  deleteSequence: vi.fn().mockResolvedValue(true),
  addMessage: vi.fn().mockResolvedValue(null),
  removeMessage: vi.fn().mockResolvedValue(true),
  validateSequence: vi.fn().mockResolvedValue({ results: [] }),
  selectMessage: vi.fn(),
  setSequenceName: vi.fn(),
  exportSequence: vi.fn().mockReturnValue('{"id":"test","name":"Test"}'),
  importSequence: vi.fn().mockResolvedValue(null),
  canUndo: false,
  canRedo: false,
  undo: vi.fn(),
  redo: vi.fn(),
  clearValidation: vi.fn(),
  loadAllSequences: vi.fn().mockResolvedValue(undefined),
  isInitialized: true,
};

const renderMscEditor = () => {
  return render(
    <MantineProvider>
      <BrowserRouter>
        <MscEditor />
      </BrowserRouter>
    </MantineProvider>
  );
};

describe('MscEditor - Session Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useMscEditor as any).mockReturnValue(mockMscEditorHook);
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ['RRCConnectionRequest', 'EstablishmentCause', 'InitialUE-Identity'],
    });
    localStorage.clear();
    localStorage.setItem('msc-editor-session-id', 'session-1');
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('renders with session context', async () => {
    renderMscEditor();

    await waitFor(() => {
      expect(screen.getByText('MSC Editor')).toBeInTheDocument();
    });
  });

  it('has session controls available', async () => {
    renderMscEditor();

    // New Session button should be present (title is "New Session")
    await waitFor(() => {
      expect(screen.getByTitle('New Session')).toBeInTheDocument();
    });
  });

  it('displays protocol selector', async () => {
    renderMscEditor();

    await waitFor(() => {
      expect(screen.getByDisplayValue('RRC Demo')).toBeInTheDocument();
    });
  });

  it('has message input controls', async () => {
    (useMscEditor as any).mockReturnValue({
      ...mockMscEditorHook,
      state: {
        ...mockMscEditorHook.state,
        currentSequence: {
          id: 'seq-1',
          name: 'Test',
          protocol: 'rrc_demo',
          messages: [],
          sessionId: 'session-1',
        },
      },
    });

    renderMscEditor();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Message type')).toBeInTheDocument();
    });
  });
});

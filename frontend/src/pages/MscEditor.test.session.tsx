import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { MscEditor } from './MscEditor';
import { useMscEditor } from '../hooks/useMscEditor';
import mscSessionService from '../services/mscSessionService';

// Mock dependencies
vi.mock('../hooks/useMscEditor');
vi.mock('../services/mscSessionService', () => ({
  default: {
    listSessions: vi.fn(),
    createSession: vi.fn(),
    getSession: vi.fn(),
    updateSession: vi.fn(),
    deleteSession: vi.fn(),
  },
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
  createSequence: vi.fn(),
  loadSequence: vi.fn(),
  deleteSequence: vi.fn(),
  addMessage: vi.fn(),
  removeMessage: vi.fn(),
  validateSequence: vi.fn(),
  selectMessage: vi.fn(),
  setSequenceName: vi.fn(),
  exportSequence: vi.fn().mockReturnValue('{"id":"test","name":"Test"}'),
  importSequence: vi.fn(),
  canUndo: false,
  canRedo: false,
  undo: vi.fn(),
  redo: vi.fn(),
  clearValidation: vi.fn(),
  loadAllSequences: vi.fn().mockResolvedValue(undefined),
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
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates default session when no sessions exist', async () => {
    (mscSessionService.listSessions as any).mockResolvedValue([]);
    (mscSessionService.createSession as any).mockResolvedValue({
      id: 'session-1',
      name: 'Default Session',
      description: 'Main working session',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
      is_active: true,
    });

    renderMscEditor();

    await waitFor(() => {
      expect(mscSessionService.listSessions).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mscSessionService.createSession).toHaveBeenCalledWith(
        'Default Session',
        'Main working session'
      );
    });
  });

  it('uses existing session when sessions are available', async () => {
    const existingSessions = [
      {
        id: 'session-1',
        name: 'Session 1',
        description: 'Test session',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        is_active: true,
      },
    ];

    (mscSessionService.listSessions as any).mockResolvedValue(existingSessions);

    renderMscEditor();

    await waitFor(() => {
      expect(mscSessionService.listSessions).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Session 1')).toBeInTheDocument();
    });

    // Should not create a new session
    expect(mscSessionService.createSession).not.toHaveBeenCalled();
  });

  it('allows creating a new session via modal', async () => {
    const existingSessions = [
      {
        id: 'session-1',
        name: 'Session 1',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        is_active: true,
      },
    ];

    (mscSessionService.listSessions as any).mockResolvedValue(existingSessions);
    (mscSessionService.createSession as any).mockResolvedValue({
      id: 'session-2',
      name: 'New Session',
      created_at: '2024-01-02',
      updated_at: '2024-01-02',
      is_active: true,
    });

    renderMscEditor();

    await waitFor(() => {
      expect(screen.getByTitle('Create new session')).toBeInTheDocument();
    });

    // Click the + button
    const createButton = screen.getByTitle('Create new session');
    fireEvent.click(createButton);

    // Modal should open
    await waitFor(() => {
      expect(screen.getByText('Create New Session')).toBeInTheDocument();
    });

    // Enter session name
    const input = screen.getByPlaceholderText('Enter session name');
    fireEvent.change(input, { target: { value: 'New Session' } });

    // Click create button
    const createModalButton = screen.getByText('Create');
    fireEvent.click(createModalButton);

    await waitFor(() => {
      expect(mscSessionService.createSession).toHaveBeenCalledWith('New Session');
    });
  });

  it('creates sequence when session is available', async () => {
    const existingSessions = [
      {
        id: 'session-1',
        name: 'Session 1',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        is_active: true,
      },
    ];

    (mscSessionService.listSessions as any).mockResolvedValue(existingSessions);
    localStorage.setItem('msc-editor-session-id', 'session-1');

    renderMscEditor();

    await waitFor(() => {
      expect(mockMscEditorHook.createSequence).toHaveBeenCalledWith(
        'Untitled Sequence',
        'rrc_demo',
        'session-1'
      );
    }, { timeout: 1000 });
  });

  it('allows adding messages when sequence exists', async () => {
    const existingSessions = [
      {
        id: 'session-1',
        name: 'Session 1',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        is_active: true,
      },
    ];

    const mockSequence = {
      id: 'seq-1',
      name: 'Test Sequence',
      protocol: 'rrc_demo',
      messages: [],
      sessionId: 'session-1',
    };

    (mscSessionService.listSessions as any).mockResolvedValue(existingSessions);
    (useMscEditor as any).mockReturnValue({
      ...mockMscEditorHook,
      state: {
        ...mockMscEditorHook.state,
        currentSequence: mockSequence,
      },
    });

    renderMscEditor();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Message type')).toBeInTheDocument();
    });

    // Should be able to add messages
    const messageTypeSelect = screen.getByPlaceholderText('Message type');
    expect(messageTypeSelect).toBeInTheDocument();
  });
});


import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { MscEditor } from './MscEditor';
import { useSession } from '../hooks/useSession';
import { useMscEditor } from '../hooks/useMscEditor';
import mscSessionService from '../services/mscSessionService';
import type { MscSequence } from '../domain/msc/types';

// Mock dependencies
vi.mock('../hooks/useMscEditor');
vi.mock('../hooks/useSession', () => ({
  useSession: vi.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../services/mscSessionService', () => ({
  default: {
    listSessions: vi.fn(),
    createSession: vi.fn(),
    getSession: vi.fn(),
    updateSession: vi.fn(),
    deleteSession: vi.fn(),
  },
}));

// Mock fetch for protocol types and examples
global.fetch = vi.fn();

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

const mockMscEditorHook = {
  state: {
    currentSequence: null,
    sequences: [],
    isLoading: false,
    error: null,
    selectedMessageIndex: null,
    suggestions: [],
  },
  createSequence: vi.fn().mockResolvedValue(mockSequence),
  loadSequence: vi.fn().mockResolvedValue(mockSequence),
  deleteSequence: vi.fn().mockResolvedValue(true),
  addMessage: vi.fn().mockResolvedValue(undefined),
  removeMessage: vi.fn().mockResolvedValue(undefined),
  validateSequence: vi.fn().mockResolvedValue(undefined),
  selectMessage: vi.fn(),
  setSequenceName: vi.fn().mockResolvedValue(undefined),
  exportSequence: vi.fn().mockReturnValue('{"id":"test","name":"Test"}'),
  importSequence: vi.fn().mockResolvedValue(undefined),
  canUndo: false,
  canRedo: false,
  undo: vi.fn(),
  redo: vi.fn(),
  clearValidation: vi.fn(),
  loadAllSequences: vi.fn().mockResolvedValue(undefined),
  isInitialized: true,
};

// Mock useSession hook
const mockSessionHook = {
  sessions: [],
  currentSessionId: null,
  loading: false,
  createSession: vi.fn(),
  switchSession: vi.fn(),
  updateSession: vi.fn(),
  deleteSession: vi.fn(),
  refreshSessions: vi.fn(),
  currentSession: null,
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

describe('MscEditor - Basic Workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useMscEditor as any).mockReturnValue(mockMscEditorHook);
    (useSession as any).mockReturnValue(mockSessionHook);
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ['RRCConnectionRequest', 'EstablishmentCause', 'InitialUE-Identity'],
    });
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Workflow 1: Create Session → Create Sequence', () => {
    it('should create session and sequence on mount', async () => {
      // Step 1: Setup session
      const mockSession = {
        id: 'session-1',
        name: 'Test Session',
        description: 'Test',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        is_active: true,
      };

      (mscSessionService.listSessions as any).mockResolvedValue([mockSession]);
      (useSession as any).mockReturnValue({
        ...mockSessionHook,
        sessions: [mockSession],
        currentSessionId: mockSession.id,
        currentSession: mockSession
      });

      // Step 2: Setup sequence
      const sequenceWithId = { ...mockSequence, id: 'seq-1' };
      (useMscEditor as any).mockReturnValue({
        ...mockMscEditorHook,
        state: {
          ...mockMscEditorHook.state,
          currentSequence: sequenceWithId,
        },
      });

      renderMscEditor();

      // Wait for component to render
      await waitFor(() => {
        expect(screen.getByText('MSC Editor')).toBeInTheDocument();
      });

      // Verify message input UI is available (indicates sequence exists)
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Message type')).toBeInTheDocument();
      });
    });
  });

  describe('Workflow 2: Load Existing Sequence → Update Name', () => {
    it('should load sequence and update name', async () => {
      const existingSession = {
        id: 'session-1',
        name: 'Existing Session',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        is_active: true,
      };

      const existingSequence = { ...mockSequence, name: 'Old Name' };

      (mscSessionService.listSessions as any).mockResolvedValue([existingSession]);
      (useSession as any).mockReturnValue({
        ...mockSessionHook,
        sessions: [existingSession],
        currentSessionId: existingSession.id,
        currentSession: existingSession
      });
      (useMscEditor as any).mockReturnValue({
        ...mockMscEditorHook,
        state: {
          ...mockMscEditorHook.state,
          currentSequence: existingSequence,
        },
      });

      renderMscEditor();

      // Wait for session to load
      await waitFor(() => {
        expect(screen.getByDisplayValue('Existing Session')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Update sequence name
      const nameInput = screen.getByLabelText('Sequence name');
      expect(nameInput).toBeInTheDocument();

      fireEvent.change(nameInput, { target: { value: 'New Name' } });
      fireEvent.blur(nameInput);

      await waitFor(() => {
        expect(mockMscEditorHook.setSequenceName).toHaveBeenCalledWith('New Name');
      });
    });
  });

  describe('Workflow 3: Create Sequence → Verify UI Elements', () => {
    it('should create sequence and show message input UI', async () => {
      const session = {
        id: 'session-1',
        name: 'Test Session',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        is_active: true,
      };

      (mscSessionService.listSessions as any).mockResolvedValue([session]);
      (useMscEditor as any).mockReturnValue({
        ...mockMscEditorHook,
        state: {
          ...mockMscEditorHook.state,
          currentSequence: mockSequence,
        },
      });

      renderMscEditor();

      await waitFor(() => {
        expect(screen.getByText('MSC Editor')).toBeInTheDocument();
      });

      // Verify message input UI is available
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Message type')).toBeInTheDocument();
      });
    });
  });

  describe('Workflow 4: Session Management → Load Sessions', () => {
    it('should load and display sessions', async () => {
      const session1 = {
        id: 'session-1',
        name: 'Session 1',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        is_active: true,
      };

      const session2 = {
        id: 'session-2',
        name: 'Session 2',
        created_at: '2024-01-02',
        updated_at: '2024-01-02',
        is_active: true,
      };

      (mscSessionService.listSessions as any).mockResolvedValue([session1, session2]);
      (useSession as any).mockReturnValue({
        ...mockSessionHook,
        sessions: [session1, session2],
        currentSessionId: session1.id,
        currentSession: session1
      });
      (useMscEditor as any).mockReturnValue({
        ...mockMscEditorHook,
        state: {
          ...mockMscEditorHook.state,
          currentSequence: mockSequence,
        },
      });

      renderMscEditor();

      // Wait for sessions to load (selector to appear)
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Session')).toBeInTheDocument();
      });

      // Verify session selector is present
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Session')).toBeInTheDocument();
      });
    });
  });

  describe('Workflow 5: Error Handling - Missing Sequence', () => {
    it('should handle error when trying to add message without sequence', async () => {
      const session = {
        id: 'session-1',
        name: 'Test Session',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        is_active: true,
      };

      (mscSessionService.listSessions as any).mockResolvedValue([session]);
      (useSession as any).mockReturnValue({
        ...mockSessionHook,
        sessions: [session],
        currentSessionId: session.id,
        currentSession: session
      });
      (useMscEditor as any).mockReturnValue({
        ...mockMscEditorHook,
        state: {
          ...mockMscEditorHook.state,
          currentSequence: null, // No sequence
        },
      });

      renderMscEditor();

      // Try to add message without sequence
      const messageTypeSelect = screen.getByPlaceholderText('Message type');
      fireEvent.change(messageTypeSelect, { target: { value: 'RRCConnectionRequest' } });

      const addButton = screen.getByText('Add');
      fireEvent.click(addButton);

      // Should attempt to create sequence first
      await waitFor(() => {
        expect(mockMscEditorHook.createSequence).toHaveBeenCalled();
      });
    });
  });

  describe('Workflow 6: Sequence Name Update', () => {
    it('should update sequence name and persist changes', async () => {
      const session = {
        id: 'session-1',
        name: 'Test Session',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        is_active: true,
      };

      const sequence = { ...mockSequence, name: 'Original Name' };

      (mscSessionService.listSessions as any).mockResolvedValue([session]);
      (useSession as any).mockReturnValue({
        ...mockSessionHook,
        sessions: [session],
        currentSessionId: session.id,
        currentSession: session
      });
      (useMscEditor as any).mockReturnValue({
        ...mockMscEditorHook,
        state: {
          ...mockMscEditorHook.state,
          currentSequence: sequence,
        },
      });

      renderMscEditor();

      await waitFor(() => {
        expect(screen.getByLabelText('Sequence name')).toBeInTheDocument();
      });

      // Update name
      const nameInput = screen.getByLabelText('Sequence name');
      fireEvent.change(nameInput, { target: { value: 'Updated Name' } });
      fireEvent.blur(nameInput);

      await waitFor(() => {
        expect(mockMscEditorHook.setSequenceName).toHaveBeenCalledWith('Updated Name');
      });
    });
  });

  describe('Workflow 7: Protocol Selection', () => {
    it('should display protocol selector', async () => {
      const session = {
        id: 'session-1',
        name: 'Test Session',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        is_active: true,
      };

      const sequence = { ...mockSequence, protocol: 'rrc_demo' };

      (mscSessionService.listSessions as any).mockResolvedValue([session]);
      (useSession as any).mockReturnValue({
        ...mockSessionHook,
        sessions: [session],
        currentSessionId: session.id,
        currentSession: session
      });
      (useMscEditor as any).mockReturnValue({
        ...mockMscEditorHook,
        state: {
          ...mockMscEditorHook.state,
          currentSequence: sequence,
        },
      });

      renderMscEditor();

      await waitFor(() => {
        expect(screen.getByDisplayValue('RRC Demo')).toBeInTheDocument();
      });
    });
  });
});


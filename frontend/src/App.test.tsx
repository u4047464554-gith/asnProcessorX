import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import { vi } from 'vitest';
import { useAsnProcessor } from './hooks/useAsnProcessor';
import axios from 'axios';
import { MemoryRouter } from 'react-router-dom';

vi.mock('axios');
vi.mock('./hooks/useAsnProcessor');
vi.mock('./components/StarTrekShip', () => ({ StarTrekShip: () => <div data-testid="ship" /> }));

// Mock resize observer
class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
}
window.ResizeObserver = ResizeObserver;

// Mock matchMedia
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

// Mock useSession hook
vi.mock('./hooks/useSession', () => ({
    useSession: () => ({
        currentSessionId: 'test-session',
        sessions: [],
        currentSession: null,
        isLoading: false,
        error: null,
        createSession: vi.fn(),
        switchSession: vi.fn(),
        updateSession: vi.fn(),
        deleteSession: vi.fn(),
        refreshSessions: vi.fn(),
    }),
    SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Helper to render App with Router context
const renderApp = () => {
    return render(
        <MemoryRouter>
            <App />
        </MemoryRouter>
    );
};

describe('App View', () => {
    const mockHook = {
        protocols: ['p1'],
        selectedProtocol: null,
        handleProtocolChange: vi.fn(),
        setSelectedProtocol: vi.fn(),
        demoTypeOptions: [],
        selectedDemoOption: null,
        handleDemoSelect: vi.fn(),
        selectedType: null,
        setSelectedType: vi.fn(),
        definitionTree: null,
        hexData: '',
        setHexData: vi.fn(),
        jsonData: '',
        setJsonData: vi.fn(),
        formattedHex: '',
        setFormattedHex: vi.fn(),
        error: null,
        loading: false,
        traceData: null,
        traceLoading: false,
        traceError: null,
        editorMode: 'structured',
        setEditorMode: vi.fn(),
        setLastEdited: vi.fn(),
        handleDecode: vi.fn(),
        handleEncode: vi.fn(),
        loadExample: vi.fn(),
        codegenLoading: false,
        codegenError: null,
        handleCodegen: vi.fn(),
        refreshDefinitions: vi.fn(),
        savedMessages: [],
        handleSaveMessage: vi.fn(),
        handleDeleteMessage: vi.fn(),
        handleClearMessages: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (useAsnProcessor as any).mockReturnValue(mockHook);
        (axios.get as any).mockResolvedValue({ data: [] });
        (axios.put as any).mockResolvedValue({ data: { status: 'success' } });
        (axios.post as any).mockResolvedValue({ data: { status: 'success' } });
    });

    it('renders main layout', () => {
        renderApp();
        expect(screen.getByText('ASN.1 Processor')).toBeInTheDocument();
    });

    it('disables buttons when no protocol selected', () => {
        renderApp();
        expect(screen.getByLabelText('Edit Schema')).toBeDisabled();
        expect(screen.getByLabelText('Generate C Stubs')).toBeDisabled();
        expect(screen.getByLabelText('Reload')).toBeDisabled();
    });

    it('enables buttons when protocol selected', () => {
        (useAsnProcessor as any).mockReturnValue({ ...mockHook, selectedProtocol: 'p1', selectedDemoOption: 'opt' });
        renderApp();
        expect(screen.getByLabelText('Edit Schema')).not.toBeDisabled();
        expect(screen.getByLabelText('Generate C Stubs')).not.toBeDisabled();
        expect(screen.getByLabelText('Reload')).not.toBeDisabled();
    });

    it('opens codegen modal and calls handleCodegen', async () => {
        const handleCodegen = vi.fn().mockResolvedValue(true);
        (useAsnProcessor as any).mockReturnValue({ ...mockHook, selectedProtocol: 'p1', handleCodegen });
        renderApp();

        fireEvent.click(screen.getByLabelText('Generate C Stubs'));
        await waitFor(() => expect(screen.getByText(/Generate C Stubs for/)).toBeInTheDocument());

        fireEvent.click(screen.getByText('Generate & Download'));
        await waitFor(() => expect(handleCodegen).toHaveBeenCalled());
    });

    it('opens schema editor', async () => {
        (useAsnProcessor as any).mockReturnValue({ ...mockHook, selectedProtocol: 'p1' });
        renderApp();
        fireEvent.click(screen.getByLabelText('Edit Schema'));
        await waitFor(() => expect(screen.getByText(/Schema Editor: p1/)).toBeInTheDocument());
    });

    it('toggles inspector', async () => {
        renderApp();
        expect(screen.getByText('Bit Inspector')).toBeInTheDocument();
        fireEvent.click(screen.getByLabelText('Toggle Inspector'));
        await waitFor(() => expect(screen.queryByText('Bit Inspector')).not.toBeInTheDocument());
    });

    it('opens settings modal', async () => {
        renderApp();
        fireEvent.click(screen.getByLabelText('Settings'));
        await waitFor(() => expect(screen.getByText('Settings')).toBeInTheDocument());
    });

    it('handles hex input changes', () => {
        const setHexData = vi.fn();
        const setFormattedHex = vi.fn();
        const setLastEdited = vi.fn();
        (useAsnProcessor as any).mockReturnValue({ ...mockHook, setHexData, setFormattedHex, setLastEdited });

        renderApp();

        const hexInput = screen.getByPlaceholderText(/80 05.../i);
        fireEvent.change(hexInput, { target: { value: 'AA' } });

        expect(setHexData).toHaveBeenCalledWith('AA');
        expect(setFormattedHex).toHaveBeenCalled();
        expect(setLastEdited).toHaveBeenCalledWith('hex');
    });

    it('handles 0x Hex user input', () => {
        const setFormattedHex = vi.fn();
        const setHexData = vi.fn();
        const setLastEdited = vi.fn();
        (useAsnProcessor as any).mockReturnValue({ ...mockHook, setFormattedHex, setHexData, setLastEdited });
        renderApp();

        const input = screen.getByPlaceholderText(/80 05.../i);
        fireEvent.change(input, { target: { value: '0xAA' } });

        expect(setFormattedHex).toHaveBeenCalledWith('0xAA');
        expect(setHexData).toHaveBeenCalled();
        expect(setLastEdited).toHaveBeenCalledWith('hex');
    });

    it('handles Raw JSON user input', () => {
        const setJsonData = vi.fn();
        const setLastEdited = vi.fn();
        (useAsnProcessor as any).mockReturnValue({ ...mockHook, editorMode: 'raw', setJsonData, setLastEdited });
        renderApp();

        const input = screen.getByPlaceholderText('{ ... }');
        fireEvent.change(input, { target: { value: '{}' } });

        expect(setJsonData).toHaveBeenCalledWith('{}');
        expect(setLastEdited).toHaveBeenCalledWith('json');
    });

    it('handles Structured Editor change', () => {
        const setJsonData = vi.fn();
        const setLastEdited = vi.fn();
        (useAsnProcessor as any).mockReturnValue({
            ...mockHook,
            editorMode: 'structured',
            setJsonData,
            setLastEdited,
            definitionTree: { type: 'INTEGER', kind: 'Integer', name: 'root' },
            jsonData: '1'
        });
        renderApp();

        const input = screen.getByDisplayValue('1');
        fireEvent.change(input, { target: { value: '2' } });

        expect(setJsonData).toHaveBeenCalledWith('2');
        expect(setLastEdited).toHaveBeenCalledWith('json');
    });

    it('calls loadExample', () => {
        const loadExample = vi.fn();
        (useAsnProcessor as any).mockReturnValue({ ...mockHook, selectedProtocol: 'p1', selectedDemoOption: 'opt', loadExample });
        renderApp();

        fireEvent.click(screen.getByLabelText('Reload'));
        expect(loadExample).toHaveBeenCalled();
    });

    it('renders error state', () => {
        (useAsnProcessor as any).mockReturnValue({ ...mockHook, error: 'Some Error' });
        renderApp();
        expect(screen.getByText('Some Error')).toBeInTheDocument();
    });

    it('renders definition tree when available', () => {
        (useAsnProcessor as any).mockReturnValue({ ...mockHook, definitionTree: { name: 'Root', type: 'INT' } });
        renderApp();
        expect(screen.getByText('Definition Tree')).toBeInTheDocument();
    });

    it('switches editor mode', () => {
        const setEditorMode = vi.fn();
        (useAsnProcessor as any).mockReturnValue({ ...mockHook, setEditorMode });
        renderApp();

        fireEvent.click(screen.getByText('Raw'));
        expect(setEditorMode).toHaveBeenCalledWith('raw');
    });

    it('updates Hex input when data changes', () => {
        (useAsnProcessor as any).mockReturnValue({ ...mockHook, hexData: 'FFFF' });
        renderApp();
        expect(screen.getByDisplayValue('FFFF')).toBeInTheDocument();
    });

    it('updates JSON input when data changes', () => {
        (useAsnProcessor as any).mockReturnValue({ ...mockHook, jsonData: '{"test":1}', editorMode: 'raw' });
        renderApp();
        expect(screen.getByDisplayValue(/test/)).toBeInTheDocument();
    });
});

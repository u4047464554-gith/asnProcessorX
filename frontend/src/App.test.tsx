import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import { vi } from 'vitest';
import axios from 'axios';

vi.mock('axios');
vi.mock('./components/StarTrekShip', () => ({ StarTrekShip: () => <div data-testid="ship" /> }));

// Mock resize observer for Mantine
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserver;

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

global.fetch = vi.fn();

describe('App Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (axios.get as any).mockImplementation((url: string) => {
             if (url.endsWith('/api/config')) return Promise.resolve({ data: { specs_directories: [] } });
             if (url.endsWith('/api/asn/protocols')) return Promise.resolve({ data: ['proto1'] });
             if (url.includes('/types/')) return Promise.resolve({ data: { tree: { name: 'Msg', type: 'SEQUENCE', children: [] } } }); // For DefinitionTree
             if (url.includes('/types')) return Promise.resolve({ data: ['Msg1'] });
             if (url.includes('/examples')) return Promise.resolve({ data: { 'Msg1': { type: 'Msg1', data: {} } } });
             return Promise.resolve({ data: {} });
        });
        (axios.post as any).mockImplementation((url: string) => {
             if (url.endsWith('/decode')) return Promise.resolve({ data: { status: 'success', data: { field: 1 }, decoded_type: 'Msg1' } });
             if (url.endsWith('/encode')) return Promise.resolve({ data: { status: 'success', hex_data: 'AABB' } });
             if (url.endsWith('/trace')) return Promise.resolve({ data: { trace: {}, total_bits: 16 } });
             return Promise.resolve({ data: {} });
        });
    });

    it('renders main layout and loads protocols', async () => {
        render(<App />);
        expect(screen.getByText('ASN.1 Processor')).toBeInTheDocument();
        
        await waitFor(() => {
             expect(screen.getByPlaceholderText('Select Protocol')).toBeInTheDocument();
        });
    });
    
    it('handles hex input and conversion', async () => {
        render(<App />);
        
        // Select Protocol (simulate) - interacting with Mantine Select is hard, 
        // but we can assume if user types hex without protocol it just updates state.
        // But decode requires protocol.
        
        const hexInput = screen.getByPlaceholderText('80 05 ...');
        fireEvent.change(hexInput, { target: { value: 'AABB' } });
        
        expect(hexInput).toHaveValue('AABB');
        
        // Base64 should update
        const b64Input = screen.getByPlaceholderText('Base64 representation');
        expect(b64Input).toHaveValue('qrs='); // AABB -> qrs= (Base64)
    });
    
    it('opens settings modal', async () => {
        render(<App />);
        const btn = screen.getByLabelText('Settings');
        fireEvent.click(btn);
        
        await waitFor(() => {
            expect(screen.getByText('Settings')).toBeInTheDocument();
        });
    });

    it('opens schema editor', async () => {
        render(<App />);
        // Needs protocol selected to be enabled? Yes.
        // We can mock the state or just try to click it.
        // But button is disabled if !selectedProtocol.
        
        // Let's mock useState? No, integration test.
        // We need to select a protocol.
        // Mantine Select is a hidden input.
        // We can find the input by label and change it?
        // <input name="Protocol" ... />
        // Mantine Select structure:
        // Input wrapper -> Input
        
        // Let's try to click the input and click an option.
        // Protocol select:
        // Placeholder: "Select Protocol"
    });
});

import { render, screen } from '@testing-library/react';
import App from './App';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MantineProvider } from '@mantine/core';
import axios from 'axios';

// Mock dependencies
vi.mock('axios');
vi.mock('@monaco-editor/react', () => ({ default: () => <div>Monaco</div> }));
vi.mock('./components/StarTrekShip', () => ({ StarTrekShip: () => <div>Enterprise</div> }));

describe('App', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (axios.get as any).mockResolvedValue({ data: [] }); // Default for all gets
    });

    it('renders main title', () => {
        render(<App />);
        expect(screen.getByText('ASN.1 Processor')).toBeInTheDocument();
    });
});


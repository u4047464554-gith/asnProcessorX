import { render, screen, waitFor } from '@testing-library/react';
import { SchemaEditor } from './SchemaEditor';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MantineProvider } from '@mantine/core';
import axios from 'axios';

vi.mock('axios');
vi.mock('@monaco-editor/react', () => ({
    default: ({ value, onChange }: any) => (
        <textarea 
            data-testid="monaco-editor"
            value={value} 
            onChange={e => onChange(e.target.value)} 
        />
    ),
}));

const renderWithMantine = (ui: React.ReactNode) => {
    return render(
        <MantineProvider>{ui}</MantineProvider>
    );
};

describe('SchemaEditor', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('fetches files on mount', async () => {
        (axios.get as any).mockImplementation((url: string) => {
            if (url.endsWith('/files')) {
                 // List files
                 return Promise.resolve({ data: ['file1.asn', 'file2.asn'] });
            }
            if (url.includes('/definitions')) {
                 return Promise.resolve({ data: { 'file1.asn': ['TypeA'], 'file2.asn': [] } });
            }
            if (url.includes('/files/')) {
                 // Content (reading specific file)
                 return Promise.resolve({ data: { content: 'test content' } });
            }
            return Promise.resolve({ data: [] }); // Default array to be safe
        });
        
        renderWithMantine(<SchemaEditor protocol="test_proto" />);
        
        await waitFor(() => {
            expect(axios.get).toHaveBeenCalledWith('/api/files/protocols/test_proto/files');
        });
        
        expect(screen.getAllByText('file1.asn').length).toBeGreaterThan(0);
        expect(screen.getAllByText('file2.asn').length).toBeGreaterThan(0);
    });
});

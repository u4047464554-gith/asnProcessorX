import { render, screen, fireEvent } from '@testing-library/react';
import { StructuredJsonEditor } from './StructuredJsonEditor';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MantineProvider } from '@mantine/core';
import type { DefinitionNode } from '../definition/types';

// Wrapper for Mantine components
const renderWithMantine = (ui: React.ReactNode) => {
    return render(
        <MantineProvider>{ui}</MantineProvider>
    );
};

describe('StructuredJsonEditor', () => {
    const mockOnChange = vi.fn();
    
    beforeEach(() => {
        mockOnChange.mockClear();
        localStorage.clear();
    });

    it('renders simple integer input', () => {
        const schema: DefinitionNode = { type: 'INTEGER', kind: 'Integer', name: 'testInt' };
        renderWithMantine(<StructuredJsonEditor data={123} schema={schema} onChange={mockOnChange} />);
        
        expect(screen.getByDisplayValue('123')).toBeInTheDocument();
    });

    it('renders sequence with children', () => {
        const schema: DefinitionNode = {
            type: 'SEQUENCE',
            kind: 'Sequence',
            name: 'root',
            children: [
                { type: 'INTEGER', kind: 'Integer', name: 'child1' }
            ]
        };
        const data = { child1: 456 };
        renderWithMantine(<StructuredJsonEditor data={data} schema={schema} onChange={mockOnChange} />);
        
        expect(screen.getByText('root')).toBeInTheDocument();
        expect(screen.getByText('child1')).toBeInTheDocument();
        expect(screen.getByDisplayValue('456')).toBeInTheDocument();
    });

    it('renders optional ghost field', () => {
        const schema: DefinitionNode = {
            type: 'SEQUENCE',
            kind: 'Sequence',
            children: [
                { type: 'INTEGER', kind: 'Integer', name: 'optField', optional: true }
            ]
        };
        const data = {};
        renderWithMantine(<StructuredJsonEditor data={data} schema={schema} onChange={mockOnChange} />);
        
        // Should show OPTIONAL badge
        expect(screen.getByText('OPTIONAL')).toBeInTheDocument();
        expect(screen.getByText('optField')).toBeInTheDocument();
        
        // Click to activate (Text element has onClick)
        fireEvent.click(screen.getByText('optField'));
        
        // Should call onChange with default 0 for Integer
        expect(mockOnChange).toHaveBeenCalledWith({ optField: 0 });
    });
    
    it('renders tuple input for OCTET STRING', () => {
         const schema: DefinitionNode = { type: 'OCTET STRING', kind: 'OctetString', name: 'data' };
         const data = ["0xAB", 8];
         renderWithMantine(<StructuredJsonEditor data={data} schema={schema} onChange={mockOnChange} />);
         
         expect(screen.getByDisplayValue('0xAB')).toBeInTheDocument();
         expect(screen.getByDisplayValue('8')).toBeInTheDocument();
    });
});


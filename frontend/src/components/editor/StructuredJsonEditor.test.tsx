import { render, screen, fireEvent } from '@testing-library/react';
import { StructuredJsonEditor } from './StructuredJsonEditor';
import { MantineProvider } from '@mantine/core';
import { vi } from 'vitest';
import type { DefinitionNode } from '../definition/types';

const renderWithMantine = (ui: React.ReactNode) => {
    return render(<MantineProvider>{ui}</MantineProvider>);
};

describe('StructuredJsonEditor', () => {
    const mockOnChange = vi.fn();

    beforeEach(() => {
        mockOnChange.mockClear();
    });

    it('renders integer input', () => {
        const schema: DefinitionNode = { type: 'INTEGER', kind: 'Integer', name: 'testInt' };
        renderWithMantine(<StructuredJsonEditor data={42} schema={schema} onChange={mockOnChange} />);
        expect(screen.getByDisplayValue('42')).toBeInTheDocument();
    });

    it('handles SEQUENCE OF add and remove', () => {
        const schema: DefinitionNode = {
            type: 'SEQUENCE OF', kind: 'SequenceOf', name: 'list',
            children: [{ type: 'INTEGER', kind: 'Integer', name: 'item' }]
        };
        renderWithMantine(<StructuredJsonEditor data={[10]} schema={schema} onChange={mockOnChange} />);
        
        expect(screen.getByDisplayValue('10')).toBeInTheDocument();
        
        // Add item
        fireEvent.click(screen.getByLabelText('Add item'));
        expect(mockOnChange).toHaveBeenCalledWith([10, 0]);

        // Remove item
        fireEvent.click(screen.getByLabelText('Remove item'));
        expect(mockOnChange).toHaveBeenCalledWith([]);
    });
    
    it('handles Optional field activation and removal', () => {
        const schema: DefinitionNode = {
            type: 'SEQUENCE', kind: 'Sequence', name: 'root',
            children: [
                { name: 'optField', type: 'INTEGER', kind: 'Integer', optional: true }
            ]
        };
        
        const { rerender } = renderWithMantine(
            <StructuredJsonEditor data={{}} schema={schema} onChange={mockOnChange} />
        );
        
        expect(screen.getByText('optField')).toBeInTheDocument();
        expect(screen.getByText('OPTIONAL')).toBeInTheDocument();
        
        fireEvent.click(screen.getByLabelText('Activate field'));
        expect(mockOnChange).toHaveBeenCalledWith({ optField: 0 });
        
        rerender(
            <MantineProvider>
                <StructuredJsonEditor data={{ optField: 123 }} schema={schema} onChange={mockOnChange} />
            </MantineProvider>
        );
        expect(screen.getByDisplayValue('123')).toBeInTheDocument();
        
        fireEvent.click(screen.getByLabelText('Remove field'));
        // onChange calls parent handler. Parent handler sees 'undefined' and deletes key.
        // But here we mock the top-level onChange.
        // The component logic: NodeRenderer(SEQUENCE) -> handleChildChange -> onChange(newObj)
        // So it should be called with {}
        expect(mockOnChange).toHaveBeenCalledWith({});
    });

    it('handles Tuple input for OCTET STRING', () => {
         const schema: DefinitionNode = { type: 'OCTET STRING', kind: 'OctetString', name: 'oct' };
         renderWithMantine(<StructuredJsonEditor data={["0xAB", 8]} schema={schema} onChange={mockOnChange} />);
         
         const textInput = screen.getByDisplayValue('0xAB');
         const numInput = screen.getByDisplayValue('8');
         
         fireEvent.change(textInput, { target: { value: '0xCD' } });
         expect(mockOnChange).toHaveBeenCalledWith(['0xCD', 8]);
         
         fireEvent.change(numInput, { target: { value: '16' } });
         expect(mockOnChange).toHaveBeenCalledWith(['0xAB', 16]);
    });
});

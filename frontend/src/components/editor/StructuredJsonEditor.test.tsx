import { render, screen, fireEvent } from '@testing-library/react';
import { StructuredJsonEditor } from './StructuredJsonEditor';
import { MantineProvider } from '@mantine/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
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

    it('renders boolean input', () => {
        const schema: DefinitionNode = { type: 'BOOLEAN', kind: 'Boolean', name: 'bool' };
        renderWithMantine(<StructuredJsonEditor data={true} schema={schema} onChange={mockOnChange} />);

        expect(screen.getByText('true')).toBeInTheDocument();
    });

    it('renders enumerated input', () => {
        const schema: DefinitionNode = { type: 'ENUMERATED', kind: 'Enumerated', name: 'enum' };
        renderWithMantine(<StructuredJsonEditor data={'val1'} schema={schema} onChange={mockOnChange} />);
        expect(screen.getByDisplayValue('val1')).toBeInTheDocument();

        fireEvent.change(screen.getByDisplayValue('val1'), { target: { value: 'val2' } });
        expect(mockOnChange).toHaveBeenCalledWith('val2');
    });

    it('renders unknown type as text input', () => {
        const schema: DefinitionNode = { type: 'MyType', name: 'unknown' };
        renderWithMantine(<StructuredJsonEditor data={'text'} schema={schema} onChange={mockOnChange} />);
        expect(screen.getByDisplayValue('text')).toBeInTheDocument();
    });

    it('renders recursive type as sequence', () => {
        const schema: DefinitionNode = { type: 'MyRec', kind: 'Recursive', name: 'rec' };
        renderWithMantine(<StructuredJsonEditor data={{}} schema={schema} onChange={mockOnChange} />);
        expect(screen.getByText('rec')).toBeInTheDocument();
        expect(screen.getByText('(MyRec)')).toBeInTheDocument();
    });

    it('renders NULL type', () => {
        const schema: DefinitionNode = { type: 'NULL', kind: 'Null', name: 'null' };
        renderWithMantine(<StructuredJsonEditor data={null} schema={schema} onChange={mockOnChange} />);
        expect(screen.getByText('NULL')).toBeInTheDocument();
    });

    it('renders ObjectIdentifier', () => {
        const schema: DefinitionNode = { type: 'OID', kind: 'ObjectIdentifier', name: 'oid' };
        renderWithMantine(<StructuredJsonEditor data={'1.2.3'} schema={schema} onChange={mockOnChange} />);
        expect(screen.getByDisplayValue('1.2.3')).toBeInTheDocument();
    });

    it('renders CHOICE', () => {
        const schema: DefinitionNode = {
            type: 'CHOICE', kind: 'Choice', name: 'ch',
            children: [
                { name: 'opt1', type: 'INTEGER', kind: 'Integer' },
                { name: 'opt2', type: 'BOOLEAN', kind: 'Boolean' }
            ]
        };
        renderWithMantine(<StructuredJsonEditor data={{ opt1: 1 }} schema={schema} onChange={mockOnChange} />);
        expect(screen.getAllByDisplayValue('opt1').length).toBeGreaterThan(0);
        expect(screen.getByDisplayValue('1')).toBeInTheDocument();
    });

    it('handles SEQUENCE child change', () => {
        const schema: DefinitionNode = {
            type: 'SEQUENCE', kind: 'Sequence', name: 'root',
            children: [{ name: 'child', type: 'INTEGER', kind: 'Integer' }]
        };
        renderWithMantine(<StructuredJsonEditor data={{ child: 1 }} schema={schema} onChange={mockOnChange} />);

        fireEvent.change(screen.getByDisplayValue('1'), { target: { value: '2' } });
        expect(mockOnChange).toHaveBeenCalledWith({ child: 2 });
    });

    it('handles SEQUENCE OF add and remove', () => {
        const schema: DefinitionNode = {
            type: 'SEQUENCE OF', kind: 'SequenceOf', name: 'list',
            children: [{ type: 'INTEGER', kind: 'Integer', name: 'item' }]
        };
        renderWithMantine(<StructuredJsonEditor data={[10]} schema={schema} onChange={mockOnChange} />);

        expect(screen.getByDisplayValue('10')).toBeInTheDocument();

        fireEvent.click(screen.getByLabelText('Add item'));
        expect(mockOnChange).toHaveBeenCalledWith([10, 0]);

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

        // Use regex for flexible label matching ("optField" or "Field")
        expect(screen.getByText(/optField|Field/)).toBeInTheDocument();
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
        expect(mockOnChange).toHaveBeenCalledWith({});
    });

    it('handles Tuple input for OCTET STRING (Bytes read-only)', () => {
        const schema: DefinitionNode = { type: 'OCTET STRING', kind: 'OctetString', name: 'oct' };
        renderWithMantine(<StructuredJsonEditor data={["0xAB", 8]} schema={schema} onChange={mockOnChange} />);

        const textInput = screen.getByDisplayValue('0xAB');
        // Expect byte length (1), not bits (8)
        const numInput = screen.getByDisplayValue('1');
        expect(numInput).toHaveAttribute('readonly');

        fireEvent.change(textInput, { target: { value: '0xCD' } });
        expect(mockOnChange).toHaveBeenCalledWith(['0xCD', 8]);
    });

    it('handles Tuple input for BIT STRING (Bits editable)', () => {
        const schema: DefinitionNode = { type: 'BIT STRING', kind: 'BitString', name: 'bits', constraints: { size: 8 } };
        renderWithMantine(<StructuredJsonEditor data={["0xAB", 8]} schema={schema} onChange={mockOnChange} />);

        // Should show Dec 171, Hex AB
        expect(screen.getByText(/171/)).toBeInTheDocument();
        expect(screen.getByText(/AB/i)).toBeInTheDocument();

        // Switch to hex edit mode
        fireEvent.click(screen.getByText(/AB/i));

        // Find input and change
        const hexInput = screen.getByDisplayValue(/AB/i);
        fireEvent.change(hexInput, { target: { value: 'FF' } });

        // onChange should be called with updated tuple.
        expect(mockOnChange).toHaveBeenCalledWith(['0xFF', 8]);
    });

    it('auto-repairs missing mandatory nested fields when editing', () => {
        const schema: DefinitionNode = {
            type: 'SEQUENCE', kind: 'Sequence', name: 'Parent',
            children: [
                {
                    type: 'SEQUENCE', kind: 'Sequence', name: 'MandatoryChild', optional: false,
                    children: [
                        { type: 'INTEGER', kind: 'Integer', name: 'GrandChild', optional: false }
                    ]
                },
                { type: 'INTEGER', kind: 'Integer', name: 'OptionalSibling', optional: true }
            ]
        };

        renderWithMantine(
            <StructuredJsonEditor data={{}} schema={schema} onChange={mockOnChange} />
        );

        // Activate OptionalSibling (ghost)
        fireEvent.click(screen.getByLabelText('Activate field'));

        // onChange should include BOTH OptionalSibling and repaired MandatoryChild
        expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
            OptionalSibling: 0,
            MandatoryChild: { GrandChild: 0 }
        }));
    });
});

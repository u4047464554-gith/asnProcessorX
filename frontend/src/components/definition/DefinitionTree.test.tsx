import { render, screen, fireEvent } from '@testing-library/react';
import { DefinitionTree } from './DefinitionTree';
import { MantineProvider } from '@mantine/core';
import type { DefinitionNode } from './types';

const renderWithMantine = (ui: React.ReactNode) => {
    return render(<MantineProvider>{ui}</MantineProvider>);
};

describe('DefinitionTree', () => {
    const rootNode: DefinitionNode = {
        name: 'Root',
        type: 'SEQUENCE',
        kind: 'Sequence',
        children: [
            { name: 'child1', type: 'INTEGER', kind: 'Integer', constraints: { range: { min: 0, max: 10 } } },
            { name: 'child2', type: 'BOOLEAN', kind: 'Boolean', optional: true },
            { 
                name: 'nested', 
                type: 'SEQUENCE', 
                kind: 'Sequence', 
                children: [
                    { name: 'leaf', type: 'OCTET STRING', kind: 'OctetString' }
                ] 
            }
        ]
    };

    it('renders root node', () => {
        renderWithMantine(<DefinitionTree root={rootNode} />);
        expect(screen.getByText('Root')).toBeInTheDocument();
        expect(screen.getAllByText('SEQUENCE').length).toBeGreaterThan(0);
    });

    it('renders children when expanded', () => {
        renderWithMantine(<DefinitionTree root={rootNode} />);
        // Root is expanded by default (depth < 1)
        expect(screen.getByText('child1')).toBeInTheDocument();
        expect(screen.getByText('INTEGER')).toBeInTheDocument();
        // Mantine Text might break up text, check partial match
        expect(screen.getByText(/range: \[0, 10\]/)).toBeInTheDocument();
    });

    it('renders optional badge', () => {
        renderWithMantine(<DefinitionTree root={rootNode} />);
        expect(screen.getByText('OPTIONAL')).toBeInTheDocument();
    });

    it('collapses and expands', () => {
        renderWithMantine(<DefinitionTree root={rootNode} />);
        const collapseBtn = screen.getByLabelText('Collapse definition node');
        fireEvent.click(collapseBtn);
        
        expect(screen.queryByText('child1')).not.toBeInTheDocument();
        
        fireEvent.click(screen.getByLabelText('Expand definition node'));
        expect(screen.getByText('child1')).toBeInTheDocument();
    });
    
    it('renders nested nodes collapsed by default', () => {
        renderWithMantine(<DefinitionTree root={rootNode} />);
        expect(screen.getByText('nested')).toBeInTheDocument();
        expect(screen.queryByText('leaf')).not.toBeInTheDocument();
        
        const expandBtns = screen.getAllByLabelText('Expand definition node');
        fireEvent.click(expandBtns[0]);
        
        expect(screen.getByText('leaf')).toBeInTheDocument();
    });
});


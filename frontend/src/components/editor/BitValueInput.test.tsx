import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { BitValueInput } from './BitValueInput';
import { renderWithProviders } from '../../test-utils';

describe('BitValueInput', () => {
    describe('rendering', () => {
        it('renders Dec/Hex/Bin labels', () => {
            renderWithProviders(<BitValueInput value={0} onChange={vi.fn()} bitLength={8} />);
            expect(screen.getByText('Dec')).toBeInTheDocument();
            expect(screen.getByText('Hex')).toBeInTheDocument();
            expect(screen.getByText('Bin')).toBeInTheDocument();
        });

        it('displays bit length indicator', () => {
            renderWithProviders(<BitValueInput value={0} onChange={vi.fn()} bitLength={24} />);
            expect(screen.getByText('24b')).toBeInTheDocument();
        });
    });

    describe('value formatting', () => {
        it('formats 8-bit value correctly', () => {
            renderWithProviders(<BitValueInput value={255} onChange={vi.fn()} bitLength={8} />);
            expect(screen.getByText('255')).toBeInTheDocument(); // Dec
            expect(screen.getByText('FF')).toBeInTheDocument(); // Hex
            expect(screen.getByText('1111 1111')).toBeInTheDocument(); // Bin
        });

        it('formats 24-bit value correctly', () => {
            renderWithProviders(<BitValueInput value={0xFFFFFF} onChange={vi.fn()} bitLength={24} />);
            expect(screen.getByText('16777215')).toBeInTheDocument(); // Dec
            expect(screen.getByText('FFFFFF')).toBeInTheDocument(); // Hex
        });

        it('formats 38-bit value correctly', () => {
            // 38 bits max = 0x3FFFFFFFFF = 274877906943
            const value = 0x1111111111; // 73300775185
            renderWithProviders(<BitValueInput value={value} onChange={vi.fn()} bitLength={38} />);
            expect(screen.getByText('73300775185')).toBeInTheDocument(); // Dec
            expect(screen.getByText('1111111111')).toBeInTheDocument(); // Hex (10 chars for 38 bits)
        });

        it('formats 39-bit value correctly', () => {
            // 39 bits, 10 hex chars
            const value = 0x7FFFFFFFFF; // 549755813887
            renderWithProviders(<BitValueInput value={value} onChange={vi.fn()} bitLength={39} />);
            expect(screen.getByText('549755813887')).toBeInTheDocument(); // Dec
        });

        it('pads hex to correct length', () => {
            renderWithProviders(<BitValueInput value={1} onChange={vi.fn()} bitLength={24} />);
            expect(screen.getByText('000001')).toBeInTheDocument(); // 6 hex chars for 24 bits
        });

        it('pads binary to correct length', () => {
            renderWithProviders(<BitValueInput value={1} onChange={vi.fn()} bitLength={8} />);
            expect(screen.getByText('0000 0001')).toBeInTheDocument();
        });
    });

    describe('value clamping', () => {
        it('clamps value to max for bit length', () => {
            // 8-bit max is 255
            renderWithProviders(<BitValueInput value={256} onChange={vi.fn()} bitLength={8} />);
            expect(screen.getByText('255')).toBeInTheDocument(); // Clamped to max
        });

        it('handles zero value', () => {
            renderWithProviders(<BitValueInput value={0} onChange={vi.fn()} bitLength={16} />);
            expect(screen.getByText('0')).toBeInTheDocument();
            expect(screen.getByText('0000')).toBeInTheDocument(); // Hex padded
        });
    });

    describe('increment/decrement', () => {
        it('increments value on up arrow click', () => {
            const onChange = vi.fn();
            renderWithProviders(<BitValueInput value={5} onChange={onChange} bitLength={8} />);

            const upButton = screen.getAllByRole('button')[0];
            fireEvent.click(upButton);

            expect(onChange).toHaveBeenCalledWith(6);
        });

        it('decrements value on down arrow click', () => {
            const onChange = vi.fn();
            renderWithProviders(<BitValueInput value={5} onChange={onChange} bitLength={8} />);

            const downButton = screen.getAllByRole('button')[1];
            fireEvent.click(downButton);

            expect(onChange).toHaveBeenCalledWith(4);
        });

        it('does not increment beyond max', () => {
            const onChange = vi.fn();
            renderWithProviders(<BitValueInput value={255} onChange={onChange} bitLength={8} />);

            const upButton = screen.getAllByRole('button')[0];
            fireEvent.click(upButton);

            expect(onChange).not.toHaveBeenCalled();
        });

        it('does not decrement below zero', () => {
            const onChange = vi.fn();
            renderWithProviders(<BitValueInput value={0} onChange={onChange} bitLength={8} />);

            const downButton = screen.getAllByRole('button')[1];
            fireEvent.click(downButton);

            expect(onChange).not.toHaveBeenCalled();
        });
    });

    describe('disabled state', () => {
        it('does not show buttons when disabled', () => {
            renderWithProviders(<BitValueInput value={5} onChange={vi.fn()} bitLength={8} disabled />);

            // Should not have increment/decrement buttons
            expect(screen.queryAllByRole('button')).toHaveLength(0);
        });
    });

    describe('BigInt support for large values', () => {
        it('handles values up to 53 bits correctly', () => {
            // Near JS safe integer limit
            const value = Number.MAX_SAFE_INTEGER; // 2^53 - 1
            renderWithProviders(<BitValueInput value={value} onChange={vi.fn()} bitLength={53} />);
            expect(screen.getByText('9007199254740991')).toBeInTheDocument();
        });

        it('formats 48-bit value correctly', () => {
            const value = 0xFFFFFFFFFFFF; // 281474976710655
            renderWithProviders(<BitValueInput value={value} onChange={vi.fn()} bitLength={48} />);
            expect(screen.getByText('281474976710655')).toBeInTheDocument();
            expect(screen.getByText('FFFFFFFFFFFF')).toBeInTheDocument(); // 12 hex chars
        });
    });
});

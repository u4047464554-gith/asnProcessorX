import { renderHook, act, waitFor } from '@testing-library/react';
import { useAsnProcessor } from './useAsnProcessor';
import { AsnService } from '../services/asnService';
import { vi } from 'vitest';

vi.mock('../services/asnService', () => ({
    AsnService: {
        getProtocols: vi.fn(),
        getTypes: vi.fn(),
        getExamples: vi.fn(),
        getDefinition: vi.fn(),
        decode: vi.fn(),
        encode: vi.fn(),
        trace: vi.fn(),
        generateCStubs: vi.fn(),
    }
}));

vi.mock('../utils/file', () => ({
    downloadBlob: vi.fn()
}));

describe('useAsnProcessor', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (AsnService.getProtocols as any).mockResolvedValue(['proto1']);
        (AsnService.getTypes as any).mockResolvedValue(['Type1']);
        (AsnService.getExamples as any).mockResolvedValue({});
    });

    it('fetches protocols on mount', async () => {
        const { result } = renderHook(() => useAsnProcessor());
        
        await waitFor(() => {
            expect(result.current.protocols).toEqual(['proto1']);
        });
    });

    it('fetches types when protocol is selected', async () => {
        const { result } = renderHook(() => useAsnProcessor());
        
        act(() => {
            result.current.setSelectedProtocol('proto1');
        });
        
        await waitFor(() => {
            expect(AsnService.getTypes).toHaveBeenCalledWith('proto1');
            expect(result.current.demoTypeOptions.length).toBeGreaterThan(0);
        });
    });

    it('fetches definition when type is selected', async () => {
        const tree = { name: 'Type1', type: 'INTEGER' };
        (AsnService.getDefinition as any).mockResolvedValue(tree);
        
        const { result } = renderHook(() => useAsnProcessor());
        
        act(() => {
            result.current.setSelectedProtocol('proto1');
        });
        await waitFor(() => expect(AsnService.getTypes).toHaveBeenCalled());
        
        act(() => {
            result.current.setSelectedType('Type1');
        });
        
        await waitFor(() => {
            expect(AsnService.getDefinition).toHaveBeenCalledWith('proto1', 'Type1');
            expect(result.current.definitionTree).toEqual(tree);
        });
    });

    it('handles decode flow', async () => {
        (AsnService.decode as any).mockResolvedValue({ status: 'success', data: { val: 1 }, decoded_type: 'Type1' });
        (AsnService.trace as any).mockResolvedValue({ trace: {}, total_bits: 8 });

        const { result } = renderHook(() => useAsnProcessor());
        
        act(() => {
            result.current.setSelectedProtocol('proto1');
        });
        
        await act(async () => {
            await result.current.handleDecode('AABB');
        });
        
        expect(AsnService.decode).toHaveBeenCalledWith('proto1', 'AABB', undefined);
        expect(result.current.jsonData).toContain('"val": 1');
        expect(result.current.error).toBeNull();
        expect(AsnService.trace).toHaveBeenCalledWith('proto1', 'Type1', 'AABB');
    });

    it('handles encode flow', async () => {
        (AsnService.encode as any).mockResolvedValue({ status: 'success', hex_data: 'CCDD' });
        (AsnService.trace as any).mockResolvedValue({ trace: {}, total_bits: 16 });
        
        const { result } = renderHook(() => useAsnProcessor());
        
        act(() => {
            result.current.setSelectedProtocol('proto1');
            result.current.setSelectedType('Type1');
            result.current.setJsonData('{"val": 1}');
        });
        
        await act(async () => {
            await result.current.handleEncode();
        });
        
        expect(AsnService.encode).toHaveBeenCalledWith('proto1', 'Type1', { val: 1 });
        expect(result.current.hexData).toBe('CCDD');
    });
});


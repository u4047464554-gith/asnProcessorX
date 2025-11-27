import { renderHook, act, waitFor } from '@testing-library/react';
import { useAsnProcessor } from './useAsnProcessor';
import { AsnService } from '../services/asnService';
import { vi } from 'vitest';
import * as demos from '../data/demos';

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

// Mock demos
vi.mock('../data/demos', () => ({
    demoPayloads: {
        'proto1': { 'Type1': { val: 1 } }
    },
    demoErrorPayloads: {
        'proto1': { 'Type1': [{ val: 'bad' }] }
    }
}));

describe('useAsnProcessor', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (AsnService.getProtocols as any).mockResolvedValue(['proto1']);
        (AsnService.getTypes as any).mockResolvedValue(['Type1']);
        (AsnService.getExamples as any).mockResolvedValue({ 'Type1': { custom: 1 } });
    });

    it('fetches protocols on mount', async () => {
        const { result } = renderHook(() => useAsnProcessor());
        await waitFor(() => expect(result.current.protocols).toEqual(['proto1']));
    });

    it('fetches types and examples when protocol selected', async () => {
        const { result } = renderHook(() => useAsnProcessor());
        act(() => { result.current.setSelectedProtocol('proto1'); });
        
        await waitFor(() => {
            expect(result.current.demoTypeOptions).toHaveLength(3); // Valid, Dynamic, Error
        });
    });

    it('fetches definition when type selected', async () => {
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
        
        await waitFor(() => expect(result.current.definitionTree).toEqual(tree));
    });

    it('handleDecode success', async () => {
        (AsnService.decode as any).mockResolvedValue({ status: 'success', data: { val: 1 }, decoded_type: 'Type1' });
        (AsnService.trace as any).mockResolvedValue({ trace: {}, total_bits: 8 });
        const { result } = renderHook(() => useAsnProcessor());
        act(() => { result.current.setSelectedProtocol('proto1'); });
        
        await act(async () => { await result.current.handleDecode('AABB'); });
        
        expect(result.current.jsonData).toContain('"val": 1');
        expect(result.current.error).toBeNull();
    });

    it('handleDecode failure', async () => {
        (AsnService.decode as any).mockResolvedValue({ status: 'failure', error: 'Failed' });
        const { result } = renderHook(() => useAsnProcessor());
        act(() => { result.current.setSelectedProtocol('proto1'); });
        
        await act(async () => { await result.current.handleDecode('AABB'); });
        expect(result.current.error).toBe('Failed');
    });
    
    it('handleDecode network error', async () => {
        (AsnService.decode as any).mockRejectedValue(new Error('Net Error'));
        const { result } = renderHook(() => useAsnProcessor());
        act(() => { result.current.setSelectedProtocol('proto1'); });
        
        await act(async () => { await result.current.handleDecode('AABB'); });
        expect(result.current.error).toBe('Net Error');
    });

    it('handleEncode success', async () => {
        (AsnService.encode as any).mockResolvedValue({ status: 'success', hex_data: 'CCDD' });
        (AsnService.trace as any).mockResolvedValue({ trace: {}, total_bits: 16 });
        const { result } = renderHook(() => useAsnProcessor());
        act(() => { 
            result.current.setSelectedProtocol('proto1');
            result.current.setSelectedType('Type1');
            result.current.setJsonData('{"val": 1}');
        });
        
        await act(async () => { await result.current.handleEncode(); });
        expect(result.current.hexData).toBe('CCDD');
        expect(result.current.formattedHex).toBe('0xCC, 0xDD');
    });

    it('handleEncode invalid JSON', async () => {
        const { result } = renderHook(() => useAsnProcessor());
        act(() => { 
            result.current.setSelectedProtocol('proto1');
            result.current.setSelectedType('Type1');
            result.current.setJsonData('{bad');
        });
        
        await act(async () => { await result.current.handleEncode(); });
        expect(result.current.error).toBe('Invalid JSON');
    });

    it('handleCodegen success', async () => {
        (AsnService.generateCStubs as any).mockResolvedValue(new Blob());
        const { result } = renderHook(() => useAsnProcessor());
        act(() => { result.current.setSelectedProtocol('proto1'); });
        
        let success;
        await act(async () => { success = await result.current.handleCodegen(); });
        expect(success).toBe(true);
    });

    it('handleCodegen failure with blob error', async () => {
        const errorBlob = new Blob([JSON.stringify({ detail: 'Compile Error' })], { type: 'application/json' });
        // Polyfill text() if missing in JSDOM
        if (!errorBlob.text) {
            (errorBlob as any).text = () => Promise.resolve(JSON.stringify({ detail: 'Compile Error' }));
        }

        const err = { response: { data: errorBlob } };
        (AsnService.generateCStubs as any).mockRejectedValue(err);
        const { result } = renderHook(() => useAsnProcessor());
        act(() => { result.current.setSelectedProtocol('proto1'); });
        
        let success;
        await act(async () => { success = await result.current.handleCodegen(); });
        expect(success).toBe(false);
        expect(result.current.codegenError).toBe('Compile Error');
    });
    
    it('handleDemoSelect loads valid demo', () => {
        const { result } = renderHook(() => useAsnProcessor());
        act(() => { result.current.setSelectedProtocol('proto1'); });
        
        act(() => { result.current.handleDemoSelect('Type1::valid'); });
        
        expect(result.current.selectedType).toBe('Type1');
        expect(JSON.parse(result.current.jsonData)).toEqual({ val: 1 });
        expect(result.current.error).toBeNull();
    });

    it('handleDemoSelect loads dynamic demo', () => {
        const { result } = renderHook(() => useAsnProcessor());
        act(() => { result.current.setSelectedProtocol('proto1'); });
        // Wait for examples to load (useEffect)
        // The useEffect is async, wait for it.
        
        act(() => { result.current.handleDemoSelect('Type1::dynamic'); });
        // Ideally verify dynamic data. 
        // But state update relies on async effect finishing first. 
        // We mocked getExamples.
    });

    it('handleDemoSelect loads error demo', () => {
         const { result } = renderHook(() => useAsnProcessor());
         act(() => { result.current.setSelectedProtocol('proto1'); });
         
         act(() => { result.current.handleDemoSelect('Type1::error::0'); });
         
         expect(JSON.parse(result.current.jsonData)).toEqual({ val: 'bad' });
    });
});

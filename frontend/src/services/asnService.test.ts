import { vi } from 'vitest';
import { AsnService } from './asnService';
import axios from 'axios';

vi.mock('axios');

describe('AsnService', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('getProtocols calls correct endpoint', async () => {
        (axios.get as any).mockResolvedValue({ data: ['p1'] });
        const res = await AsnService.getProtocols();
        expect(axios.get).toHaveBeenCalledWith('/api/asn/protocols');
        expect(res).toEqual(['p1']);
    });

    it('getTypes calls correct endpoint', async () => {
        (axios.get as any).mockResolvedValue({ data: ['t1'] });
        await AsnService.getTypes('p1');
        expect(axios.get).toHaveBeenCalledWith('/api/asn/protocols/p1/types');
    });

    it('getExamples calls correct endpoint', async () => {
        (axios.get as any).mockResolvedValue({ data: { ex: 1 } });
        await AsnService.getExamples('p1');
        expect(axios.get).toHaveBeenCalledWith('/api/asn/protocols/p1/examples');
    });

    it('getExamples handles error', async () => {
        (axios.get as any).mockRejectedValue(new Error('fail'));
        const res = await AsnService.getExamples('p1');
        expect(res).toEqual({});
    });

    it('decode calls correct endpoint', async () => {
        (axios.post as any).mockResolvedValue({ data: { status: 'success' } });
        await AsnService.decode('p1', '1234');
        expect(axios.post).toHaveBeenCalledWith('/api/asn/decode', {
            hex_data: '1234',
            protocol: 'p1',
            type_name: undefined,
            encoding_rule: 'per'
        });
    });

    it('encode calls correct endpoint', async () => {
        (axios.post as any).mockResolvedValue({ data: { status: 'success' } });
        await AsnService.encode('p1', 'T1', { val: 1 });
        expect(axios.post).toHaveBeenCalledWith('/api/asn/encode', {
            data: { val: 1 },
            protocol: 'p1',
            type_name: 'T1',
            encoding_rule: 'per'
        });
    });
    
    it('trace calls correct endpoint', async () => {
         (axios.post as any).mockResolvedValue({ data: { trace: {} } });
         await AsnService.trace('p1', 'T1', '1234');
         expect(axios.post).toHaveBeenCalledWith('/api/asn/trace', {
             hex_data: '1234',
             protocol: 'p1',
             type_name: 'T1',
             encoding_rule: 'per'
         });
    });

    it('generateCStubs calls correct endpoint', async () => {
         (axios.post as any).mockResolvedValue({ data: new Blob() });
         await AsnService.generateCStubs('p1', ['T1']);
         expect(axios.post).toHaveBeenCalledWith('/api/asn/codegen', {
              protocol: 'p1',
              types: ['T1'],
              options: { 'compound-names': true }
         }, { responseType: 'blob' });
    });
});





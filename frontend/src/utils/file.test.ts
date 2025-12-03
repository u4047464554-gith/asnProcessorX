import { downloadBlob } from './file';
import { vi } from 'vitest';

describe('downloadBlob', () => {
    it('creates link and clicks it', () => {
        const blob = new Blob(['content']);
        const link = { href: '', setAttribute: vi.fn(), click: vi.fn(), remove: vi.fn() };
        
        global.URL.createObjectURL = vi.fn().mockReturnValue('blob:url');
        document.createElement = vi.fn().mockReturnValue(link as any);
        document.body.appendChild = vi.fn();
        
        downloadBlob(blob, 'file.txt');
        
        expect(global.URL.createObjectURL).toHaveBeenCalledWith(blob);
        expect(link.setAttribute).toHaveBeenCalledWith('download', 'file.txt');
        expect(document.body.appendChild).toHaveBeenCalledWith(link);
        expect(link.click).toHaveBeenCalled();
        expect(link.remove).toHaveBeenCalled();
    });
});








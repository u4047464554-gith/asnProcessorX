import { hexToBase64, base64ToHex, safeParse } from './conversion';
import { vi } from 'vitest';

// Mock window.btoa and atob for jsdom if not present? 
// jsdom supports them.

describe('conversion utils', () => {
    it('hexToBase64 converts correctly', () => {
        expect(hexToBase64('4142')).toBe('QUI=');
    });

    it('hexToBase64 handles empty', () => {
        expect(hexToBase64('')).toBe('');
    });

    it('hexToBase64 handles invalid length', () => {
        expect(hexToBase64('123')).toBe('');
    });

    it('base64ToHex converts correctly', () => {
        expect(base64ToHex('QUI=')).toBe('4142');
    });

    it('base64ToHex handles invalid input', () => {
        expect(base64ToHex('!@#$')).toBe('');
    });

    it('safeParse parses json', () => {
        expect(safeParse('{"a":1}')).toEqual({a: 1});
    });

    it('safeParse handles invalid json', () => {
        expect(safeParse('{a:1}')).toBeUndefined();
    });
});


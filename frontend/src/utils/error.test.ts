import { formatErrorMessage } from './error';

describe('formatErrorMessage', () => {
    it('returns detail string', () => {
        expect(formatErrorMessage({ response: { data: { detail: 'foo' } } })).toBe('foo');
    });

    it('returns detail object stringified', () => {
        expect(formatErrorMessage({ response: { data: { detail: { msg: 'foo' } } } })).toBe('{"msg":"foo"}');
    });

    it('returns array of errors', () => {
        const err = { 
            response: { 
                data: { 
                    detail: [
                        { loc: ['body', 'field'], msg: 'missing', type: 'value_error' }
                    ] 
                } 
            } 
        };
        expect(formatErrorMessage(err)).toBe('value_error at body.field: missing');
    });

    it('returns message if no response', () => {
        expect(formatErrorMessage({ message: 'net error' })).toBe('net error');
    });
    
    it('returns fallback', () => {
        expect(formatErrorMessage({})).toBe('Unknown error');
    });
});





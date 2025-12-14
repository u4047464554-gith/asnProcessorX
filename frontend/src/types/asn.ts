/**
 * Type definitions for ASN.1 values as represented in JSON format.
 * 
 * ASN.1 has a fixed set of primitive types that map to predictable JSON structures:
 * - INTEGER → number
 * - BOOLEAN → boolean  
 * - NULL → null
 * - BIT STRING → [hex: string, bits: number] tuple
 * - OCTET STRING → [hex: string, bytes: number] tuple (bytes = bits/8)
 * - IA5String, UTF8String, PrintableString, etc. → string
 * - ENUMERATED → string (the enum value name)
 * - OBJECT IDENTIFIER → string
 * - SEQUENCE → Record<string, AsnValue>
 * - SEQUENCE OF / SET OF → AsnValue[]
 * - CHOICE → Record<string, AsnValue> (object with single key)
 */

/**
 * Tuple format for BIT STRING and OCTET STRING values.
 * [0] = hex string (e.g., "0xABCD" or "ABCD")
 * [1] = bit count for BIT STRING, or byte count * 8 for OCTET STRING
 */
export type AsnBinaryTuple = [string, number];

/**
 * Primitive ASN.1 values that map to JSON primitives
 */
export type AsnPrimitive =
    | number        // INTEGER
    | boolean       // BOOLEAN
    | string        // IA5String, UTF8String, ENUMERATED, OBJECT IDENTIFIER, etc.
    | null          // NULL
    | AsnBinaryTuple; // BIT STRING, OCTET STRING

/**
 * ASN.1 SEQUENCE - an object with named fields
 */
export type AsnSequence = { [key: string]: AsnValue };

/**
 * ASN.1 SEQUENCE OF / SET OF - an array of values
 */
export type AsnSequenceOf = AsnValue[];

/**
 * Union type representing any valid ASN.1 value in JSON format.
 * This covers all ASN.1 primitive and constructed types.
 */
export type AsnValue =
    | AsnPrimitive
    | AsnSequence
    | AsnSequenceOf;

/**
 * Type guard to check if a value is an ASN.1 binary tuple (BIT STRING or OCTET STRING)
 */
export function isAsnBinaryTuple(value: unknown): value is AsnBinaryTuple {
    return Array.isArray(value) &&
        value.length === 2 &&
        typeof value[0] === 'string' &&
        typeof value[1] === 'number';
}

/**
 * Type guard to check if a value is an ASN.1 SEQUENCE (object with string keys)
 */
export function isAsnSequence(value: unknown): value is AsnSequence {
    return value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value);
}

/**
 * Type guard to check if a value is an ASN.1 SEQUENCE OF (array)
 */
export function isAsnSequenceOf(value: unknown): value is AsnSequenceOf {
    return Array.isArray(value) && !isAsnBinaryTuple(value);
}

/**
 * Type guard to check if a value is a valid AsnValue
 */
export function isAsnValue(value: unknown): value is AsnValue {
    if (value === null) return true;
    if (typeof value === 'number') return true;
    if (typeof value === 'boolean') return true;
    if (typeof value === 'string') return true;
    if (isAsnBinaryTuple(value)) return true;
    if (Array.isArray(value)) return value.every(isAsnValue);
    if (typeof value === 'object') {
        return Object.values(value as Record<string, unknown>).every(isAsnValue);
    }
    return false;
}

/**
 * Format an AsnValue for display as a string.
 * Handles all ASN.1 value types including binary tuples.
 */
export function formatAsnValue(value: AsnValue | undefined): string {
    if (value === undefined) return '';
    if (value === null) return 'NULL';
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (isAsnBinaryTuple(value)) return value[0]; // Return hex string
    if (Array.isArray(value)) return `[${value.length} items]`;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

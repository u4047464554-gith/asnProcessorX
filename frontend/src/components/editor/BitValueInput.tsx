import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Stack, Group, ActionIcon, Text, TextInput } from '@mantine/core';
import { IconChevronUp, IconChevronDown } from '@tabler/icons-react';

interface BitValueInputProps {
    value: number | bigint;
    onChange: (value: number) => void;
    bitLength: number;
    disabled?: boolean;
}

type RadixMode = 'dec' | 'hex' | 'bin';

/**
 * Stacked multi-radix value input with Dec/Hex/Bin rows.
 * Click a row to edit it - other rows update in real-time.
 * Supports scroll wheel, up/down arrows.
 * Uses BigInt internally to support arbitrary bit lengths.
 */
export const BitValueInput: React.FC<BitValueInputProps> = ({
    value,
    onChange,
    bitLength,
    disabled = false
}) => {
    const [activeMode, setActiveMode] = useState<RadixMode>('hex');
    const [editValue, setEditValue] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Use BigInt for arbitrary precision
    const bigValue = BigInt(value);
    const maxValue = (BigInt(1) << BigInt(bitLength)) - BigInt(1);
    const clamp = useCallback((v: bigint) => {
        if (v < BigInt(0)) return BigInt(0);
        if (v > maxValue) return maxValue;
        return v;
    }, [maxValue]);

    // Format value for display
    const formatValue = useCallback((v: bigint, mode: RadixMode): string => {
        const clamped = clamp(v);
        switch (mode) {
            case 'dec':
                return clamped.toString();
            case 'hex': {
                const hexDigits = Math.ceil(bitLength / 4);
                return clamped.toString(16).toUpperCase().padStart(hexDigits, '0');
            }
            case 'bin': {
                // Group bits by 4 for readability
                const binStr = clamped.toString(2).padStart(bitLength, '0');
                const groups = [];
                for (let i = 0; i < binStr.length; i += 4) {
                    groups.push(binStr.slice(i, Math.min(i + 4, binStr.length)));
                }
                return groups.join(' ');
            }
        }
    }, [bitLength, clamp]);

    // Parse input value
    const parseInput = useCallback((input: string, mode: RadixMode): bigint | null => {
        const cleaned = input.replace(/\s/g, '').trim();
        if (!cleaned) return BigInt(0);

        try {
            let parsed: bigint;
            switch (mode) {
                case 'dec':
                    parsed = BigInt(cleaned);
                    break;
                case 'hex':
                    parsed = BigInt('0x' + cleaned);
                    break;
                case 'bin':
                    parsed = BigInt('0b' + cleaned);
                    break;
            }
            if (parsed < BigInt(0)) return null;
            return clamp(parsed);
        } catch {
            return null;
        }
    }, [clamp]);

    // Increment/decrement
    const increment = useCallback(() => {
        if (disabled || bigValue >= maxValue) return;
        onChange(Number(clamp(bigValue + BigInt(1))));
    }, [bigValue, onChange, disabled, clamp, maxValue]);

    const decrement = useCallback(() => {
        if (disabled || bigValue <= BigInt(0)) return;
        onChange(Number(clamp(bigValue - BigInt(1))));
    }, [bigValue, onChange, disabled, clamp]);

    // Handle wheel scroll
    const handleWheel = useCallback((e: React.WheelEvent) => {
        if (disabled) return;
        e.preventDefault();
        if (e.deltaY < 0) increment();
        else decrement();
    }, [increment, decrement, disabled]);

    // Start editing a mode
    const startEditing = useCallback((mode: RadixMode) => {
        if (disabled) return;
        setActiveMode(mode);
        setEditValue(formatValue(bigValue, mode).replace(/\s/g, ''));
        setIsEditing(true);
    }, [bigValue, disabled, formatValue]);

    // Handle input change - update value in real-time
    const handleInputChange = useCallback((newText: string) => {
        setEditValue(newText);
        const parsed = parseInput(newText, activeMode);
        if (parsed !== null) {
            // Convert BigInt back to number for the callback
            onChange(Number(parsed));
        }
    }, [activeMode, onChange, parseInput]);

    // Finish editing
    const finishEditing = useCallback(() => {
        setIsEditing(false);
    }, []);

    // Handle keyboard
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            increment();
            // Update edit value to reflect new value
            setEditValue(formatValue(clamp(bigValue + BigInt(1)), activeMode).replace(/\s/g, ''));
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            decrement();
            setEditValue(formatValue(clamp(bigValue - BigInt(1)), activeMode).replace(/\s/g, ''));
        } else if (e.key === 'Enter' || e.key === 'Escape') {
            finishEditing();
        }
    }, [increment, decrement, finishEditing, formatValue, bigValue, activeMode, clamp]);

    // Focus input when editing starts
    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing, activeMode]);

    // Update edit value when external value changes
    useEffect(() => {
        if (isEditing) {
            setEditValue(formatValue(bigValue, activeMode).replace(/\s/g, ''));
        }
    }, [bigValue, isEditing, activeMode, formatValue]);

    const renderRow = (mode: RadixMode, label: string) => {
        const isActive = activeMode === mode;
        const displayValue = formatValue(bigValue, mode);

        return (
            <Group
                key={mode}
                gap={4}
                wrap="nowrap"
                onClick={() => !isEditing && startEditing(mode)}
                style={{ cursor: disabled ? 'default' : 'pointer' }}
            >
                <Text
                    size={isActive ? 'sm' : 'xs'}
                    c="dimmed"
                    w={28}
                    fw={isActive ? 600 : 400}
                >
                    {label}
                </Text>

                {isEditing && isActive ? (
                    <TextInput
                        ref={inputRef}
                        size="xs"
                        value={editValue}
                        onChange={(e) => handleInputChange(e.currentTarget.value)}
                        onBlur={finishEditing}
                        onKeyDown={handleKeyDown}
                        styles={{
                            input: {
                                fontFamily: 'monospace',
                                fontWeight: 600,
                                letterSpacing: mode === 'bin' ? '1px' : 'normal',
                                padding: '2px 6px',
                                height: 'auto',
                                minHeight: 'unset',
                                backgroundColor: 'var(--mantine-color-body)',
                                color: 'var(--mantine-color-text)'
                            }
                        }}
                        style={{
                            flex: 1,
                            maxWidth: mode === 'bin' ? 300 : 120
                        }}
                    />
                ) : (
                    <Text
                        size={isActive ? 'sm' : 'xs'}
                        fw={isActive ? 700 : 400}
                        c={isActive ? undefined : 'dimmed'}
                        ff="monospace"
                        style={{
                            letterSpacing: mode === 'bin' ? '1px' : 'normal',
                            flex: 1
                        }}
                    >
                        {displayValue}
                    </Text>
                )}
            </Group>
        );
    };

    return (
        <Group gap="xs" wrap="nowrap" align="flex-start" onWheel={handleWheel}>
            <Stack gap={2} style={{ flex: 1 }}>
                {renderRow('dec', 'Dec')}
                {renderRow('hex', 'Hex')}
                {renderRow('bin', 'Bin')}
            </Stack>

            {/* Up/Down buttons */}
            {!disabled && (
                <Stack gap={0}>
                    <ActionIcon
                        size="xs"
                        variant="subtle"
                        onClick={increment}
                        disabled={value >= maxValue}
                    >
                        <IconChevronUp size={14} />
                    </ActionIcon>
                    <ActionIcon
                        size="xs"
                        variant="subtle"
                        onClick={decrement}
                        disabled={value <= 0}
                    >
                        <IconChevronDown size={14} />
                    </ActionIcon>
                </Stack>
            )}

            {/* Bit count indicator */}
            <Text size="xs" c="dimmed" style={{ alignSelf: 'center' }}>
                {bitLength}b
            </Text>
        </Group>
    );
};

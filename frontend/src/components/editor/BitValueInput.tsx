import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Stack, Group, ActionIcon, Text, TextInput } from '@mantine/core';
import { IconChevronUp, IconChevronDown } from '@tabler/icons-react';

interface BitValueInputProps {
    value: number;
    onChange: (value: number) => void;
    bitLength: number;
    disabled?: boolean;
}

type RadixMode = 'dec' | 'hex' | 'bin';

/**
 * Stacked multi-radix value input with Dec/Hex/Bin rows.
 * Click a row to edit it - other rows update in real-time.
 * Supports scroll wheel, up/down arrows.
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

    // For large bit lengths, use BigInt-like handling but stay within safe range
    const maxValue = bitLength >= 31 ? Math.pow(2, bitLength) - 1 : (1 << bitLength) - 1;
    const clamp = useCallback((v: number) => Math.max(0, Math.min(maxValue, Math.floor(v))), [maxValue]);

    // Format value for display
    const formatValue = useCallback((v: number, mode: RadixMode): string => {
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
    const parseInput = useCallback((input: string, mode: RadixMode): number | null => {
        const cleaned = input.replace(/\s/g, '').trim();
        if (!cleaned) return 0;

        try {
            let parsed: number;
            switch (mode) {
                case 'dec':
                    parsed = parseInt(cleaned, 10);
                    break;
                case 'hex':
                    parsed = parseInt(cleaned, 16);
                    break;
                case 'bin':
                    parsed = parseInt(cleaned, 2);
                    break;
            }
            if (isNaN(parsed) || parsed < 0) return null;
            return clamp(parsed);
        } catch {
            return null;
        }
    }, [clamp]);

    // Increment/decrement
    const increment = useCallback(() => {
        if (disabled || value >= maxValue) return;
        onChange(clamp(value + 1));
    }, [value, onChange, disabled, clamp, maxValue]);

    const decrement = useCallback(() => {
        if (disabled || value <= 0) return;
        onChange(clamp(value - 1));
    }, [value, onChange, disabled, clamp]);

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
        setEditValue(formatValue(value, mode).replace(/\s/g, ''));
        setIsEditing(true);
    }, [value, disabled, formatValue]);

    // Handle input change - update value in real-time
    const handleInputChange = useCallback((newText: string) => {
        setEditValue(newText);
        const parsed = parseInput(newText, activeMode);
        if (parsed !== null) {
            onChange(parsed);
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
            setEditValue(formatValue(clamp(value + 1), activeMode).replace(/\s/g, ''));
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            decrement();
            setEditValue(formatValue(clamp(value - 1), activeMode).replace(/\s/g, ''));
        } else if (e.key === 'Enter' || e.key === 'Escape') {
            finishEditing();
        }
    }, [increment, decrement, finishEditing, formatValue, value, activeMode, clamp]);

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
            setEditValue(formatValue(value, activeMode).replace(/\s/g, ''));
        }
    }, [value, isEditing, activeMode, formatValue]);

    const renderRow = (mode: RadixMode, label: string) => {
        const isActive = activeMode === mode;
        const displayValue = formatValue(value, mode);

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
                                backgroundColor: 'var(--mantine-color-dark-6, #fff)',
                                color: 'var(--mantine-color-text, #000)'
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

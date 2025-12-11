import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Stack, Text, Group, ActionIcon, Box, UnstyledButton } from '@mantine/core';
import { IconChevronUp, IconChevronDown } from '@tabler/icons-react';

interface BitValueInputProps {
    value: number;
    onChange: (value: number) => void;
    bitLength: number;
    disabled?: boolean;
}

type RadixMode = 'dec' | 'hex' | 'bin';

/**
 * Multi-radix value input with Dec/Hex/Bin views.
 * Active mode is large, others are smaller.
 * Supports up/down arrows, scroll wheel, and direct editing.
 */
export const BitValueInput: React.FC<BitValueInputProps> = ({
    value,
    onChange,
    bitLength,
    disabled = false
}) => {
    const [activeMode, setActiveMode] = useState<RadixMode>('hex');
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const maxValue = (1 << bitLength) - 1;
    const clamp = (v: number) => Math.max(0, Math.min(maxValue, v));

    // Format value for display
    const formatValue = (v: number, mode: RadixMode): string => {
        switch (mode) {
            case 'dec':
                return v.toString();
            case 'hex':
                const hexDigits = Math.ceil(bitLength / 4);
                return v.toString(16).toUpperCase().padStart(hexDigits, '0');
            case 'bin':
                // Group bits by 4 (hex digit boundaries)
                const binStr = v.toString(2).padStart(bitLength, '0');
                const groups = [];
                for (let i = 0; i < binStr.length; i += 4) {
                    groups.push(binStr.slice(i, i + 4));
                }
                return groups.join(' ');
        }
    };

    // Parse input value
    const parseInput = (input: string, mode: RadixMode): number | null => {
        const cleaned = input.replace(/\s/g, '').trim();
        if (!cleaned) return null;

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
    };

    // Increment/decrement
    const increment = useCallback(() => {
        if (disabled) return;
        onChange(clamp(value + 1));
    }, [value, onChange, disabled, clamp]);

    const decrement = useCallback(() => {
        if (disabled) return;
        onChange(clamp(value - 1));
    }, [value, onChange, disabled, clamp]);

    // Handle wheel scroll
    const handleWheel = useCallback((e: React.WheelEvent) => {
        if (disabled) return;
        e.preventDefault();
        if (e.deltaY < 0) {
            increment();
        } else {
            decrement();
        }
    }, [increment, decrement, disabled]);

    // Handle keyboard
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (disabled) return;

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            increment();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            decrement();
        } else if (e.key === 'Enter' && isEditing) {
            const parsed = parseInput(editValue, activeMode);
            if (parsed !== null) {
                onChange(parsed);
            }
            setIsEditing(false);
        } else if (e.key === 'Escape') {
            setIsEditing(false);
        }
    }, [increment, decrement, isEditing, editValue, activeMode, onChange, disabled]);

    // Start editing
    const startEditing = useCallback((mode: RadixMode) => {
        if (disabled) return;
        setActiveMode(mode);
        setEditValue(formatValue(value, mode).replace(/\s/g, ''));
        setIsEditing(true);
    }, [value, disabled]);

    // Finish editing
    const finishEditing = useCallback(() => {
        if (isEditing) {
            const parsed = parseInput(editValue, activeMode);
            if (parsed !== null) {
                onChange(parsed);
            }
            setIsEditing(false);
        }
    }, [isEditing, editValue, activeMode, onChange]);

    // Focus input when editing starts
    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const renderModeRow = (mode: RadixMode, label: string) => {
        const isActive = activeMode === mode;
        const displayValue = formatValue(value, mode);

        return (
            <UnstyledButton
                onClick={() => !isEditing && startEditing(mode)}
                style={{
                    width: '100%',
                    cursor: disabled ? 'default' : 'pointer',
                    opacity: disabled ? 0.5 : 1
                }}
            >
                <Group gap="xs" wrap="nowrap">
                    <Text
                        size={isActive ? 'xs' : 'xs'}
                        c="dimmed"
                        w={30}
                        style={{ flexShrink: 0 }}
                    >
                        {label}
                    </Text>

                    {isEditing && isActive ? (
                        <input
                            ref={inputRef}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={finishEditing}
                            onKeyDown={handleKeyDown}
                            style={{
                                fontFamily: 'monospace',
                                fontSize: '16px',
                                fontWeight: 600,
                                border: '1px solid var(--mantine-color-blue-5)',
                                borderRadius: '4px',
                                padding: '2px 6px',
                                background: 'var(--mantine-color-dark-6)',
                                color: 'inherit',
                                outline: 'none',
                                width: '100%',
                                letterSpacing: mode === 'bin' ? '1px' : 'normal'
                            }}
                        />
                    ) : (
                        <Text
                            size={isActive ? 'md' : 'sm'}
                            fw={isActive ? 700 : 400}
                            c={isActive ? undefined : 'dimmed'}
                            ff="monospace"
                            style={{
                                letterSpacing: mode === 'bin' ? '2px' : 'normal',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            {displayValue}
                        </Text>
                    )}
                </Group>
            </UnstyledButton>
        );
    };

    return (
        <Box
            ref={containerRef}
            onWheel={handleWheel}
            onKeyDown={!isEditing ? handleKeyDown : undefined}
            tabIndex={0}
            style={{
                outline: 'none',
                border: '1px solid var(--mantine-color-dark-4)',
                borderRadius: '6px',
                padding: '6px 8px',
                background: 'var(--mantine-color-dark-7)',
                cursor: disabled ? 'default' : 'pointer'
            }}
        >
            <Group gap="xs" wrap="nowrap" align="center">
                <Stack gap={2} style={{ flex: 1 }}>
                    {renderModeRow('dec', 'Dec')}
                    {renderModeRow('hex', 'Hex')}
                    {renderModeRow('bin', 'Bin')}
                </Stack>

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
            </Group>

            <Text size="xs" c="dimmed" ta="right" mt={2}>
                {bitLength} bits (0-{maxValue})
            </Text>
        </Box>
    );
};

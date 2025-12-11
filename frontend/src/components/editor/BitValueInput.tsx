import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Group, ActionIcon, Text, UnstyledButton } from '@mantine/core';
import { IconChevronUp, IconChevronDown } from '@tabler/icons-react';

interface BitValueInputProps {
    value: number;
    onChange: (value: number) => void;
    bitLength: number;
    disabled?: boolean;
}

type RadixMode = 'dec' | 'hex' | 'bin';

/**
 * Compact multi-radix value input with Dec/Hex/Bin views inline.
 * Active mode is editable, all views update together.
 * Supports scroll wheel, up/down arrows, and direct editing.
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

    const maxValue = (1 << Math.min(bitLength, 31)) - 1; // JS bitwise limited to 31 bits
    const clamp = useCallback((v: number) => Math.max(0, Math.min(maxValue, v)), [maxValue]);

    // Format value for display
    const formatValue = useCallback((v: number, mode: RadixMode): string => {
        const clamped = clamp(v);
        switch (mode) {
            case 'dec':
                return clamped.toString();
            case 'hex':
                const hexDigits = Math.ceil(bitLength / 4);
                return clamped.toString(16).toUpperCase().padStart(hexDigits, '0');
            case 'bin':
                // Group bits by 4 (hex digit boundaries)
                const binStr = clamped.toString(2).padStart(bitLength, '0');
                const groups = [];
                for (let i = 0; i < binStr.length; i += 4) {
                    groups.push(binStr.slice(i, Math.min(i + 4, binStr.length)));
                }
                return groups.join(' ');
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
    }, [increment, decrement, isEditing, editValue, activeMode, onChange, disabled, parseInput]);

    // Start editing
    const startEditing = useCallback((mode: RadixMode) => {
        if (disabled) return;
        setActiveMode(mode);
        setEditValue(formatValue(value, mode).replace(/\s/g, ''));
        setIsEditing(true);
    }, [value, disabled, formatValue]);

    // Finish editing
    const finishEditing = useCallback(() => {
        if (isEditing) {
            const parsed = parseInput(editValue, activeMode);
            if (parsed !== null) {
                onChange(parsed);
            }
            setIsEditing(false);
        }
    }, [isEditing, editValue, activeMode, onChange, parseInput]);

    // Focus input when editing starts
    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const renderMode = (mode: RadixMode) => {
        const isActive = activeMode === mode && isEditing;
        const displayValue = formatValue(value, mode);

        if (isActive) {
            return (
                <input
                    ref={inputRef}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={finishEditing}
                    onKeyDown={handleKeyDown}
                    style={{
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        fontWeight: 600,
                        border: '1px solid var(--mantine-color-blue-5)',
                        borderRadius: '2px',
                        padding: '1px 4px',
                        background: 'var(--mantine-color-dark-6)',
                        color: 'inherit',
                        outline: 'none',
                        width: mode === 'bin' ? `${bitLength * 8 + 12}px` : mode === 'hex' ? '50px' : '60px',
                        letterSpacing: mode === 'bin' ? '1px' : 'normal'
                    }}
                />
            );
        }

        return (
            <UnstyledButton
                onClick={() => startEditing(mode)}
                style={{ cursor: disabled ? 'default' : 'pointer' }}
            >
                <Text
                    size="xs"
                    ff="monospace"
                    fw={activeMode === mode ? 600 : 400}
                    c={activeMode === mode ? undefined : 'dimmed'}
                    style={{ letterSpacing: mode === 'bin' ? '1px' : 'normal' }}
                >
                    {displayValue}
                </Text>
            </UnstyledButton>
        );
    };

    return (
        <Group
            ref={containerRef}
            onWheel={handleWheel}
            onKeyDown={!isEditing ? handleKeyDown : undefined}
            tabIndex={0}
            gap={4}
            wrap="nowrap"
            style={{
                outline: 'none',
                cursor: disabled ? 'default' : 'pointer',
                opacity: disabled ? 0.5 : 1
            }}
        >
            {/* Dec */}
            <Text size="xs" c="dimmed" w={24}>Dec</Text>
            {renderMode('dec')}

            {/* Hex */}
            <Text size="xs" c="dimmed" w={24} ml={8}>Hex</Text>
            {renderMode('hex')}

            {/* Bin */}
            <Text size="xs" c="dimmed" w={22} ml={8}>Bin</Text>
            {renderMode('bin')}

            {/* Buttons */}
            {!disabled && (
                <Group gap={0} ml={4}>
                    <ActionIcon
                        size="xs"
                        variant="subtle"
                        onClick={increment}
                        disabled={value >= maxValue}
                    >
                        <IconChevronUp size={12} />
                    </ActionIcon>
                    <ActionIcon
                        size="xs"
                        variant="subtle"
                        onClick={decrement}
                        disabled={value <= 0}
                    >
                        <IconChevronDown size={12} />
                    </ActionIcon>
                </Group>
            )}

            {/* Bit info */}
            <Text size="xs" c="dimmed" ml={4}>
                {bitLength}b
            </Text>
        </Group>
    );
};

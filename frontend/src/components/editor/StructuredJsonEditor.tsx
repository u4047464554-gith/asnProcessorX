import { useState } from 'react';
import {
    Stack, Group, Text, TextInput, NumberInput,
    Select, ActionIcon, Box, Collapse,
    Badge, ThemeIcon, Button, Modal, Textarea, Input
} from '@mantine/core';
import {
    IconPlus, IconTrash, IconChevronRight, IconChevronDown
} from '@tabler/icons-react';
import type { DefinitionNode } from '../definition/types';

interface StructuredJsonEditorProps {
    data: any;
    schema: DefinitionNode | null;
    onChange: (newData: any) => void;
    onFieldFocus?: (fieldName: string) => void;
}

// Cache for last used values (primitive fields)
const EDITOR_CACHE_KEY = 'asn-editor-cache';
const getCachedValue = (fieldName: string) => {
    try {
        const cache = JSON.parse(localStorage.getItem(EDITOR_CACHE_KEY) || '{}');
        return cache[fieldName];
    } catch { return undefined; }
};
const setCachedValue = (fieldName: string, value: any) => {
    try {
        const cache = JSON.parse(localStorage.getItem(EDITOR_CACHE_KEY) || '{}');
        cache[fieldName] = value;
        localStorage.setItem(EDITOR_CACHE_KEY, JSON.stringify(cache));
    } catch { /* ignore */ }
};

function LongTextRenderer({ value, onChange, label, placeholder, onFocus }: any) {
    const [open, setOpen] = useState(false);
    const strVal = String(value || '');
    const isLong = strVal.length > 60;

    if (!isLong) {
        return (
            <TextInput
                size="xs"
                value={strVal}
                onChange={(e) => onChange(e.currentTarget.value)}
                onFocus={onFocus}
                label={label}
                placeholder={placeholder}
                style={{ flex: 1 }}
            />
        );
    }

    return (
        <>
            <Input.Wrapper label={label} style={{ flex: 1 }}>
                <Group gap="xs">
                    <TextInput
                        size="xs"
                        value={strVal.slice(0, 60) + '...'}
                        readOnly
                        style={{ flex: 1 }}
                        rightSection={<Badge size="xs" variant="outline" color="gray" style={{ textTransform: 'none' }}>{strVal.length}</Badge>}
                        rightSectionWidth={70}
                    />
                    <Button size="xs" variant="default" onClick={() => setOpen(true)}>Edit</Button>
                </Group>
            </Input.Wrapper>
            <Modal opened={open} onClose={() => setOpen(false)} title={`Edit ${label || 'Value'}`} size="lg">
                <Textarea
                    value={strVal}
                    onChange={(e) => onChange(e.currentTarget.value)}
                    minRows={10}
                    autosize
                    maxRows={20}
                    data-autofocus
                />
                <Group justify="flex-end" mt="md">
                    <Button onClick={() => setOpen(false)}>Done</Button>
                </Group>
            </Modal>
        </>
    );
}

const getKind = (node: DefinitionNode): string => {
    if (node.kind) {
        const k = node.kind;
        if (k === 'Sequence' || k === 'Set') return 'SEQUENCE';
        if (k === 'SequenceOf' || k === 'SetOf') return 'SEQUENCE OF';
        if (k === 'Choice') return 'CHOICE';
        if (k === 'Integer') return 'INTEGER';
        if (k === 'Boolean') return 'BOOLEAN';
        if (k === 'BitString') return 'BIT STRING';
        if (k === 'OctetString') return 'OCTET STRING';
        if (k === 'Enumerated') return 'ENUMERATED';
        if (k === 'ObjectIdentifier') return 'OBJECT IDENTIFIER';
        if (k === 'Null') return 'NULL';
        if (k === 'Recursive') return 'SEQUENCE'; // Handle recursive types as sequence/struct usually
    }
    return node.type;
};

const NodeLabel = ({ fieldName, node, onChange }: { fieldName: string, node: DefinitionNode, onChange: (val: any) => void }) => (
    <Group gap="xs" mb={2} style={{ minWidth: 150 }}>
        <Text size="sm">{fieldName}</Text>
        <Text size="xs" c="dimmed">({node.type})</Text>
        {node.optional && <ActionIcon size="xs" color="red" variant="subtle" onClick={() => onChange(undefined)} aria-label="Remove field"><IconTrash size="0.7rem" /></ActionIcon>}
    </Group>
);

export function StructuredJsonEditor({ data, schema, onChange, onFieldFocus }: StructuredJsonEditorProps) {
    if (!schema) return <Text c="dimmed">No schema definition available</Text>;

    return (
        <Box p="xs">
            <NodeRenderer
                node={schema}
                value={data}
                onChange={onChange}
                level={0}
                path=""
                onFieldFocus={onFieldFocus}
            />
        </Box>
    );
}

interface NodeRendererProps {
    node: DefinitionNode;
    value: any;
    onChange: (newValue: any) => void;
    level: number;
    path: string; // For debugging/unique keys
    label?: string; // Override name (e.g. for SEQUENCE OF items)
    isOptionalGhost?: boolean; // If true, render as "addable" ghost
    onFieldFocus?: (fieldName: string) => void;
}

function NodeRenderer({ node, value, onChange, level, path, label, isOptionalGhost, onFieldFocus }: NodeRendererProps) {
    const [expanded, setExpanded] = useState(true);

    // Determine name to display
    const fieldName = label || node.name || '<anonymous>';
    const kind = getKind(node);

    // Handle "Ghost" state (Optional field not present)
    if (isOptionalGhost) {
        const handleActivate = () => {
            // Try to find default:
            // 1. Schema default
            // 2. Cache
            // 3. Type default
            let initialValue = node.default;
            if (initialValue === undefined) {
                initialValue = getCachedValue(node.name || '');
            }
            if (initialValue === undefined) {
                // Fallback type defaults
                if (kind === 'INTEGER') initialValue = 0;
                else if (kind === 'BOOLEAN') initialValue = false;
                else if (kind.includes('STRING')) initialValue = '';
                else if (kind === 'SEQUENCE') initialValue = {};
                else if (kind === 'SEQUENCE OF') initialValue = [];
                else initialValue = null;
            }
            onChange(initialValue);
        };

        return (
            <Group ml={level * 16} py={4} style={{ opacity: 0.5 }}>
                <ActionIcon variant="subtle" size="xs" color="gray" onClick={handleActivate} aria-label="Activate field">
                    <IconPlus size="0.8rem" />
                </ActionIcon>
                <Text component="div" size="sm" c="dimmed" style={{ cursor: 'pointer' }} onClick={handleActivate}>
                    {fieldName} <Badge size="xs" variant="outline" color="gray">OPTIONAL</Badge>
                </Text>
            </Group>
        );
    }

    // Handle SEQUENCE (Object)
    if (kind === 'SEQUENCE') {
        const children = node.children || [];
        const objValue = value || {};

        const handleChildChange = (childName: string, childValue: any) => {
            const newObj = { ...objValue };
            if (childValue === undefined) {
                delete newObj[childName];
            } else {
                newObj[childName] = childValue;
            }
            onChange(newObj);
        };

        const isEmpty = children.length === 0;
        const handleToggle = (e: React.MouseEvent) => {
            e.stopPropagation();
            setExpanded(!expanded);
        };

        return (
            <Box ml={level * 16}>
                <Group
                    mb={4}
                    onClick={handleToggle}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    gap="xs"
                >
                    <ThemeIcon variant="transparent" size="xs" c="dimmed" style={{ pointerEvents: 'none' }}>
                        {expanded ? <IconChevronDown /> : <IconChevronRight />}
                    </ThemeIcon>
                    <Text fw={500} size="sm" style={{ pointerEvents: 'none' }}>{fieldName}</Text>
                    {node.type !== 'SEQUENCE' && <Text size="xs" c="dimmed" style={{ pointerEvents: 'none' }}>({node.type})</Text>}
                </Group>

                <Collapse in={expanded}>
                    {isEmpty ? (
                        <Box ml={8} py={4} style={{ borderLeft: '1px solid var(--mantine-color-default-border)', marginLeft: 7 }}>
                            <Text size="xs" c="dimmed" style={{ fontStyle: 'italic' }}>Empty sequence</Text>
                        </Box>
                    ) : (
                        <Stack gap={2} style={{ borderLeft: '1px solid var(--mantine-color-default-border)', marginLeft: 7 }}>
                            {children.map((child, idx) => {
                                const childKey = child.name || `child-${idx}`;
                                const childData = objValue[childKey];
                                const isGhost = child.optional && childData === undefined;

                                return (
                                    <NodeRenderer
                                        key={childKey}
                                        node={child}
                                        value={childData}
                                        onChange={(v) => handleChildChange(childKey, v)}
                                        level={1} // Relative indentation handled by border/padding
                                        path={`${path}.${childKey}`}
                                        isOptionalGhost={isGhost}
                                        onFieldFocus={onFieldFocus}
                                    />
                                );
                            })}
                        </Stack>
                    )}
                </Collapse>
            </Box>
        );
    }

    // Handle SEQUENCE OF (Array)
    if (kind === 'SEQUENCE OF') {
        const itemType = node.children?.[0]; // Usually first child defines item type
        const arrValue = Array.isArray(value) ? value : [];

        const handleAdd = () => {
            // Create default item
            let newItem = null;
            if (itemType) {
                const k = getKind(itemType);
                if (k === 'INTEGER') newItem = 0;
                else if (k === 'SEQUENCE') newItem = {};
                else if (k.includes('STRING')) newItem = '';
                // ... simple defaults
            }
            onChange([...arrValue, newItem]);
        };

        const handleRemove = (idx: number) => {
            const newArr = [...arrValue];
            newArr.splice(idx, 1);
            onChange(newArr);
        };

        const handleItemChange = (idx: number, val: any) => {
            const newArr = [...arrValue];
            newArr[idx] = val;
            onChange(newArr);
        };

        return (
            <Box ml={level * 16}>
                <Group mb={4}>
                    <ThemeIcon variant="transparent" size="xs" c="dimmed" onClick={() => setExpanded(!expanded)} style={{ cursor: 'pointer' }}>
                        {expanded ? <IconChevronDown /> : <IconChevronRight />}
                    </ThemeIcon>
                    <Text fw={500} size="sm">{fieldName}</Text>
                    <Text size="xs" c="dimmed">[{arrValue.length}]</Text>
                    <ActionIcon size="xs" variant="subtle" onClick={handleAdd} aria-label="Add item"><IconPlus size="0.8rem" /></ActionIcon>
                </Group>
                <Collapse in={expanded}>
                    <Stack gap={2} style={{ borderLeft: '1px solid var(--mantine-color-default-border)', marginLeft: 7 }}>
                        {arrValue.map((item: any, idx: number) => (
                            <Group key={idx} align="flex-start" wrap="nowrap">
                                <Box style={{ flex: 1 }}>
                                    {itemType ? (
                                        <NodeRenderer
                                            node={itemType}
                                            value={item}
                                            onChange={(v) => handleItemChange(idx, v)}
                                            level={1}
                                            path={`${path}[${idx}]`}
                                            label={`Item ${idx + 1}`}
                                            onFieldFocus={onFieldFocus}
                                        />
                                    ) : <Text size="xs" c="red">Unknown Item Type</Text>}
                                </Box>
                                <ActionIcon color="red" variant="subtle" size="xs" mt={4} onClick={() => handleRemove(idx)} aria-label="Remove item">
                                    <IconTrash size="0.8rem" />
                                </ActionIcon>
                            </Group>
                        ))}
                    </Stack>
                </Collapse>
            </Box>
        );
    }

    // Handle CHOICE
    if (kind === 'CHOICE') {
        const options = node.children || [];
        // In JSON, choice is often { "choiceName": value } or just the value if implicit?
        // asn1tools usually outputs { "choiceName": value } for JSON.
        // Let's assume { key: value } with exactly one key.

        const currentKey = value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value)[0] : null;
        const currentData = currentKey && value ? value[currentKey] : null;

        // Find the active child node
        const activeChild = options.find(c => c.name === currentKey);

        const handleChoiceChange = (newKey: string) => {
            if (newKey === currentKey) return;
            // Reset value to default for new type
            // For now just empty object or null
            onChange({ [newKey]: null }); // Inner renderer will initialize default
        };

        const handleInnerChange = (val: any) => {
            if (currentKey) {
                onChange({ [currentKey]: val });
            }
        }

        return (
            <Box ml={level * 16}>
                <Group mb={4} gap="xs">
                    <Text fw={500} size="sm">{fieldName}</Text>
                    <Select
                        size="xs"
                        data={options.map(c => ({ value: c.name || '', label: c.name || '' }))}
                        value={currentKey || ''}
                        onChange={(v) => v && handleChoiceChange(v)}
                        placeholder="Select choice"
                        style={{ width: 200 }}
                        clearable={false}
                    />
                </Group>
                {activeChild && (
                    <Box ml={8} style={{ borderLeft: '1px solid var(--mantine-color-default-border)' }}>
                        <NodeRenderer
                            node={activeChild}
                            value={currentData}
                            onChange={handleInnerChange}
                            level={1}
                            path={`${path}.${currentKey}`}
                            label="" // Hide label since key is selected above
                            onFieldFocus={onFieldFocus}
                        />
                    </Box>
                )}
            </Box>
        );
    }

    // Primitives
    const handlePrimitiveChange = (val: any) => {
        if (node.name) setCachedValue(node.name, val);
        onChange(val);
    }


    // Helper for tuple inputs (BIT STRING / OCTET STRING)
    if (['BIT STRING', 'OCTET STRING'].includes(kind)) {
        const isTuple = Array.isArray(value);
        const hexVal = isTuple ? value[0] : (typeof value === 'string' ? value : '');
        const isOctetString = kind === 'OCTET STRING';

        // For OctetString: read-only byte length
        // For BitString: editable bit length
        const cleanHex = hexVal.replace(/^0x/i, '');
        const displayedLen = isOctetString
            ? Math.ceil(cleanHex.length / 2) // Bytes (ceil for safety on partials)
            : (isTuple ? value[1] : (cleanHex.length * 4)); // Bits

        return (
            <Box ml={level * 16} mb={4}>
                <NodeLabel fieldName={fieldName} node={node} onChange={onChange} />
                <Group gap="xs" align="flex-end">
                    <LongTextRenderer
                        label="Hex Value"
                        placeholder="0x..."
                        value={hexVal}
                        onChange={(val: string) => {
                            // Validate hex characters (0-9, a-f, A-F)
                            // Allow 0x prefix, but rest must be hex
                            const isHex = /^0x[0-9a-fA-F]*$/i.test(val) || /^[0-9a-fA-F]*$/i.test(val);

                            if (isHex) {
                                const clean = val.replace(/^0x/i, '');
                                const newBitLen = clean.length * 4;
                                handlePrimitiveChange([val, newBitLen]);
                            }
                            // Note: We effectively just ignore non-hex input (it won't update state)
                            // This is strict input masking
                        }}
                        onFocus={() => onFieldFocus?.(node.name || '')}
                    />
                    <NumberInput
                        label={isOctetString ? "Bytes" : "Bits"}
                        placeholder={isOctetString ? "Bytes" : "Bits"}
                        size="xs"
                        value={displayedLen}
                        onChange={(v) => {
                            if (!isOctetString) {
                                handlePrimitiveChange([hexVal, Number(v)]);
                            }
                        }}
                        style={{ width: 80 }}
                        onFocus={() => onFieldFocus?.(node.name || '')}
                        min={0}
                        readOnly={isOctetString}
                        variant={isOctetString ? "filled" : "default"}
                    />
                </Group>
            </Box>
        );
    }

    if (kind === 'INTEGER') {
        return (
            <Box ml={level * 16} mb={4}>
                <NodeLabel fieldName={fieldName} node={node} onChange={onChange} />
                <NumberInput
                    size="xs"
                    value={Number(value) || 0}
                    onChange={(v) => handlePrimitiveChange(Number(v))}
                    onFocus={() => onFieldFocus?.(node.name || '')}
                />
            </Box>
        );
    }

    if (kind === 'BOOLEAN') {
        return (
            <Box ml={level * 16} mb={4}>
                <NodeLabel fieldName={fieldName} node={node} onChange={onChange} />
                <Select
                    size="xs"
                    data={['true', 'false']}
                    value={value ? 'true' : 'false'}
                    onChange={(val) => handlePrimitiveChange(val === 'true')}
                    onFocus={() => onFieldFocus?.(node.name || '')}
                    allowDeselect={false}
                />
            </Box>
        );
    }

    if (kind === 'ENUMERATED') {
        const choices = (node.constraints?.choices || []) as string[];

        return (
            <Box ml={level * 16} mb={4}>
                <NodeLabel fieldName={fieldName} node={node} onChange={onChange} />
                {choices.length > 0 ? (
                    <Select
                        size="xs"
                        data={choices}
                        value={value ? String(value) : null}
                        onChange={(val) => handlePrimitiveChange(val)}
                        onFocus={() => onFieldFocus?.(node.name || '')}
                        searchable
                        clearable={node.optional}
                        placeholder="Select value"
                    />
                ) : (
                    <LongTextRenderer
                        value={String(value || '')}
                        onChange={(val: string) => handlePrimitiveChange(val)}
                        onFocus={() => onFieldFocus?.(node.name || '')}
                    />
                )}
            </Box>
        );
    }

    // Default fallback
    return (
        <Box ml={level * 16} mb={4}>
            <NodeLabel fieldName={fieldName} node={node} onChange={onChange} />
            <LongTextRenderer
                value={typeof value === 'string' ? value : JSON.stringify(value)}
                onChange={(val: string) => handlePrimitiveChange(val)}
                onFocus={() => onFieldFocus?.(node.name || '')}
            />
        </Box>
    );
}

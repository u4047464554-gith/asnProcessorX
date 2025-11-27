import { useState } from 'react';
import { 
    Stack, Group, Text, TextInput, NumberInput, 
    Select, Checkbox, ActionIcon, Box, Collapse, 
    Badge, ThemeIcon
} from '@mantine/core';
import { 
    IconPlus, IconTrash, IconChevronRight, IconChevronDown
} from '@tabler/icons-react';
import type { DefinitionNode } from '../definition/types';

interface StructuredJsonEditorProps {
    data: any;
    schema: DefinitionNode | null;
    onChange: (newData: any) => void;
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
    } catch {}
};

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

export function StructuredJsonEditor({ data, schema, onChange }: StructuredJsonEditorProps) {
    if (!schema) return <Text c="dimmed">No schema definition available</Text>;
    
    return (
        <Box p="xs">
            <NodeRenderer 
                node={schema} 
                value={data} 
                onChange={onChange} 
                level={0} 
                path=""
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
}

function NodeRenderer({ node, value, onChange, level, path, label, isOptionalGhost }: NodeRendererProps) {
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
                <ActionIcon variant="subtle" size="xs" color="gray" onClick={handleActivate}>
                    <IconPlus size="0.8rem" />
                </ActionIcon>
                <Text size="sm" c="dimmed" style={{ cursor: 'pointer' }} onClick={handleActivate}>
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

        return (
            <Box ml={level * 16}>
                <Group mb={4} onClick={() => setExpanded(!expanded)} style={{ cursor: 'pointer' }}>
                    <ThemeIcon variant="transparent" size="xs" c="dimmed">
                        {expanded ? <IconChevronDown /> : <IconChevronRight />}
                    </ThemeIcon>
                    <Text fw={500} size="sm">{fieldName}</Text>
                    {node.type !== 'SEQUENCE' && <Text size="xs" c="dimmed">({node.type})</Text>}
                </Group>
                
                <Collapse in={expanded}>
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
                                />
                            );
                        })}
                    </Stack>
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
                    <ThemeIcon variant="transparent" size="xs" c="dimmed" onClick={() => setExpanded(!expanded)} style={{cursor:'pointer'}}>
                         {expanded ? <IconChevronDown /> : <IconChevronRight />}
                    </ThemeIcon>
                    <Text fw={500} size="sm">{fieldName}</Text>
                    <Text size="xs" c="dimmed">[{arrValue.length}]</Text>
                    <ActionIcon size="xs" variant="subtle" onClick={handleAdd}><IconPlus size="0.8rem"/></ActionIcon>
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
                                         />
                                     ) : <Text size="xs" c="red">Unknown Item Type</Text>}
                                 </Box>
                                 <ActionIcon color="red" variant="subtle" size="xs" mt={4} onClick={() => handleRemove(idx)}>
                                     <IconTrash size="0.8rem"/>
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
        
        const currentKey = value && typeof value === 'object' ? Object.keys(value)[0] : null;
        const currentData = currentKey ? value[currentKey] : null;
        
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
                <Group mb={4}>
                    <Text fw={500} size="sm">{fieldName}</Text>
                    <Select 
                        size="xs" 
                        data={options.map(c => c.name || '')}
                        value={currentKey}
                        onChange={(v) => v && handleChoiceChange(v)}
                        placeholder="Select choice"
                        style={{ width: 200 }}
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

    // Primitive Label
    const Label = () => (
        <Group gap="xs" mb={2} style={{ minWidth: 150 }}>
            <Text size="sm">{fieldName}</Text>
            <Text size="xs" c="dimmed">({node.type})</Text>
            {node.optional && <ActionIcon size="xs" color="red" variant="subtle" onClick={() => onChange(undefined)}><IconTrash size="0.7rem"/></ActionIcon>}
        </Group>
    );

    // Helper for tuple inputs (BIT STRING / OCTET STRING)
    if (['BIT STRING', 'OCTET STRING'].includes(kind)) {
        // Expecting [hexString, length] or just hexString?
        // User example: "mmec": ["0xAA", 8]
        // But sometimes it's just a string. 
        // We'll support both reading and writing.
        // If value is string, treat as hex, length = hex.length * 4 (approx)
        const isTuple = Array.isArray(value);
        const hexVal = isTuple ? value[0] : (typeof value === 'string' ? value : '');
        const bitLen = isTuple ? value[1] : (hexVal.length * 4); // Default estimation

        return (
             <Box ml={level * 16} mb={4}>
                 <Label />
                 <Group gap="xs">
                     <TextInput 
                         placeholder="0x..." 
                         size="xs" 
                         value={hexVal} 
                         onChange={(e) => handlePrimitiveChange([e.currentTarget.value, bitLen])}
                         style={{ flex: 1 }}
                     />
                     <NumberInput
                        placeholder="Bits"
                        size="xs"
                        value={bitLen}
                        onChange={(v) => handlePrimitiveChange([hexVal, Number(v)])}
                        style={{ width: 80 }}
                        min={0}
                     />
                 </Group>
             </Box>
        );
    }

    if (kind === 'INTEGER') {
        return (
            <Box ml={level * 16} mb={4}>
                <Label />
                <NumberInput 
                    size="xs" 
                    value={Number(value) || 0} 
                    onChange={(v) => handlePrimitiveChange(Number(v))}
                />
            </Box>
        );
    }

    if (kind === 'BOOLEAN') {
        return (
            <Box ml={level * 16} mb={4}>
                <Checkbox 
                    label={fieldName} 
                    checked={Boolean(value)} 
                    onChange={(e) => handlePrimitiveChange(e.currentTarget.checked)} 
                />
            </Box>
        );
    }
    
    if (kind === 'ENUMERATED') {
        // Need access to constraints to find values.
        // constraints: { namedBits: { name: val } } or similar?
        // Actually backend returns `choices`?
        // DefinitionTree logic used `constraints.choices`.
        // Let's assume generic Text Input if no options found
        return (
             <Box ml={level * 16} mb={4}>
                 <Label />
                 <TextInput 
                     size="xs" 
                     value={String(value || '')} 
                     onChange={(e) => handlePrimitiveChange(e.currentTarget.value)}
                 />
             </Box>
        );
    }

    // Default fallback
    return (
        <Box ml={level * 16} mb={4}>
            <Label />
            <TextInput 
                size="xs" 
                value={typeof value === 'string' ? value : JSON.stringify(value)} 
                onChange={(e) => handlePrimitiveChange(e.currentTarget.value)} 
            />
        </Box>
    );
}

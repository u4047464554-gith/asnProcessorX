import React, { useState, useEffect } from 'react';
import {
    Paper,
    Group,
    Text,
    ActionIcon,
    ScrollArea,
    Stack,
    Box,
    Badge,
    SegmentedControl,
    Loader,
    JsonInput,
    Button,
    Alert
} from '@mantine/core';
import {
    IconX,
    IconArrowRight,
    IconAlertCircle,
    IconTrash
} from '@tabler/icons-react';
import { StructuredJsonEditor } from '../editor/StructuredJsonEditor';
import type { MscMessage } from '../../domain/msc/types';

interface MscMessageDetailProps {
    message: MscMessage;
    protocol: string;
    onClose: () => void;
    onSave: (messageId: string, newData: any) => Promise<void>;
    onDelete: (messageId: string) => Promise<void>;
}

export const MscMessageDetail: React.FC<MscMessageDetailProps> = ({
    message,
    protocol,
    onClose,
    onSave,
    onDelete
}) => {
    const [editorMode, setEditorMode] = useState<'structured' | 'raw'>('structured');
    const [messageDataJson, setMessageDataJson] = useState<string>('{}');
    const [messageDefinitionTree, setMessageDefinitionTree] = useState<any>(null);
    const [loadingDefinition, setLoadingDefinition] = useState(false);

    // Load definition tree
    const typeName = message?.type_name || (message as any)?.typeName;
    useEffect(() => {
        if (typeName && protocol) {
            setLoadingDefinition(true);
            fetch(`/api/asn/protocols/${protocol}/types/${typeName}`)
                .then(res => {
                    if (!res.ok) {
                        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                    }
                    return res.json();
                })
                .then(data => {
                    setMessageDefinitionTree(data.tree || null);
                    setMessageDataJson(JSON.stringify(message.data || {}, null, 2));
                })
                .catch(err => {
                    console.error('Failed to load definition tree:', err);
                    setMessageDefinitionTree(null);
                    setMessageDataJson(JSON.stringify(message.data || {}, null, 2));
                })
                .finally(() => setLoadingDefinition(false));
        } else {
            setMessageDataJson(JSON.stringify(message.data || {}, null, 2));
            setMessageDefinitionTree(null);
        }
    }, [typeName, protocol]);

    // Sync json when message changes
    useEffect(() => {
        setMessageDataJson(JSON.stringify(message.data || {}, null, 2));
    }, [message.data]);



    // State to hold tempData for structured editor
    const [tempData, setTempData] = useState<any>({});

    useEffect(() => {
        setTempData(message.data || {});
    }, [message.data]);

    return (
        <Paper
            style={{
                width: 500,
                borderLeft: '1px solid #e5e7eb',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: 'calc(100vh - 50px)',
                overflow: 'hidden'
            }}
        >
            <Group justify="space-between" p="sm" style={{ borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
                <Text size="sm" fw={600}>
                    {(message as any).typeName || message.type_name || message.type || 'Message Details'}
                </Text>
                <ActionIcon variant="subtle" onClick={onClose}>
                    <IconX size={16} />
                </ActionIcon>
            </Group>

            <ScrollArea style={{ flex: 1, minHeight: 0 }} p="sm">
                <Stack gap="md">
                    {/* Direction */}
                    <Box>
                        <Text size="xs" c="dimmed" mb={4}>Direction</Text>
                        <Group gap="xs">
                            <Badge color="blue">{message.sourceActor || message.source_actor}</Badge>
                            <IconArrowRight size={14} />
                            <Badge color="red">{message.targetActor || message.target_actor}</Badge>
                        </Group>
                    </Box>

                    {/* JSON Editor */}
                    <Box>
                        <Group justify="space-between" mb="xs">
                            <Text size="sm" fw={500}>Message Data</Text>
                            <SegmentedControl
                                size="xs"
                                value={editorMode}
                                onChange={(v) => setEditorMode(v as 'structured' | 'raw')}
                                data={[
                                    { label: 'Structured', value: 'structured' },
                                    { label: 'Raw JSON', value: 'raw' }
                                ]}
                            />
                        </Group>

                        {loadingDefinition && (
                            <Paper p="md" withBorder style={{ textAlign: 'center' }}>
                                <Loader size="sm" />
                                <Text size="xs" c="dimmed" mt="xs">Loading schema...</Text>
                            </Paper>
                        )}

                        {!loadingDefinition && editorMode === 'structured' && (
                            <Paper withBorder={false} style={{ minHeight: 300, display: 'flex', flexDirection: 'column' }}>
                                <ScrollArea.Autosize mah={500} type="auto" offsetScrollbars>
                                    <StructuredJsonEditor
                                        data={tempData}
                                        schema={messageDefinitionTree}
                                        onChange={(newData) => {
                                            setTempData(newData);
                                            setMessageDataJson(JSON.stringify(newData, null, 2));
                                        }}
                                    />
                                </ScrollArea.Autosize>
                            </Paper>
                        )}

                        {!loadingDefinition && editorMode === 'raw' && (
                            <JsonInput
                                placeholder='{ "field": "value" }'
                                value={messageDataJson}
                                onChange={(val) => {
                                    setMessageDataJson(val);
                                    try {
                                        const parsed = JSON.parse(val);
                                        setTempData(parsed);
                                    } catch (e) {
                                        // Invalid JSON
                                    }
                                }}
                                formatOnBlur
                                autosize
                                minRows={10}
                                maxRows={25}
                                validationError="Invalid JSON"
                            />
                        )}
                    </Box>

                    {/* Validation Errors */}
                    {message.validationErrors && message.validationErrors.length > 0 && (
                        <Box>
                            <Text size="xs" c="dimmed" mb={4}>Validation Issues</Text>
                            <Stack gap="xs">
                                {message.validationErrors.map((err, i) => (
                                    <Alert
                                        key={i}
                                        color={err.type === 'error' ? 'red' : 'yellow'}
                                        p="xs"
                                        icon={<IconAlertCircle size={14} />}
                                    >
                                        <Text size="xs">{err.message}</Text>
                                    </Alert>
                                ))}
                            </Stack>
                        </Box>
                    )}
                </Stack>
            </ScrollArea>

            <Group p="sm" style={{ borderTop: '1px solid #e5e7eb', flexShrink: 0 }}>
                <Button
                    size="xs"
                    variant="light"
                    onClick={() => onSave(message.id, tempData)}
                >
                    Save Changes
                </Button>
                <Button
                    size="xs"
                    variant="light"
                    color="red"
                    leftSection={<IconTrash size={14} />}
                    onClick={() => {
                        if (confirm('Delete this message?')) {
                            onDelete(message.id);
                        }
                    }}
                >
                    Delete
                </Button>
            </Group>
        </Paper>
    );
};

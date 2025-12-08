import { useState, useEffect, useRef } from 'react';
import {
    Stack, Text, Button, NavLink,
    Group, ActionIcon, ScrollArea, Box, Loader, useMantineColorScheme, Tabs, Accordion, Modal, TextInput, Alert
} from '@mantine/core';
import { IconDeviceFloppy, IconPlus, IconRefresh, IconFileCode, IconCamera, IconInfoCircle } from '@tabler/icons-react';
import axios from 'axios';
import { AsnService } from '../../services/asnService';
import Editor, { type Monaco } from '@monaco-editor/react';

interface SchemaEditorProps {
    protocol: string;
    onSchemaUpdated?: () => void;
}

const SNIPPETS = [
    {
        label: 'Module Definition',
        code: 'MyModule DEFINITIONS AUTOMATIC TAGS ::= BEGIN\n\n    EXPORTS ALL;\n\n    IMPORTS\n        -- Type FROM Module\n        ;\n\n    -- Definitions\n\nEND'
    },
    {
        label: 'Sequence',
        code: 'MyType ::= SEQUENCE {\n    field1 Type1,\n    field2 Type2\n}'
    },
    {
        label: 'Integer (Range)',
        code: 'MyInt ::= INTEGER (0..255)'
    },
    {
        label: 'Integer (Named)',
        code: 'MyInt ::= INTEGER { val1(1), val2(2) }'
    },
    {
        label: 'Choice',
        code: 'MyChoice ::= CHOICE {\n    opt1 [0] Type1,\n    opt2 [1] Type2\n}'
    },
    {
        label: 'Enumerated',
        code: 'MyEnum ::= ENUMERATED {\n    val1(0),\n    val2(1)\n}'
    },
    {
        label: 'Sequence Of (List)',
        code: 'MyList ::= SEQUENCE (SIZE(0..10)) OF MyType'
    },
    {
        label: 'Optional Field',
        code: 'myField MyType OPTIONAL,'
    },
    {
        label: 'Bit String',
        code: 'MyBits ::= BIT STRING { flag1(0), flag2(1) }'
    },
    {
        label: 'Comment',
        code: '-- Comment'
    }
];

export function SchemaEditor({ protocol, onSchemaUpdated }: SchemaEditorProps) {
    const { colorScheme } = useMantineColorScheme();
    const [files, setFiles] = useState<string[]>([]);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [content, setContent] = useState('');
    const [definitions, setDefinitions] = useState<Record<string, string[]>>({});
    const [isDirty, setIsDirty] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [createFileOpen, setCreateFileOpen] = useState(false);
    const [newFileName, setNewFileName] = useState('');
    const [isBundled, setIsBundled] = useState(false);

    const editorRef = useRef<any>(null);
    const monacoRef = useRef<Monaco | null>(null);

    const fetchFiles = async () => {
        try {
            setError(null);
            const res = await axios.get(`/api/files/protocols/${protocol}/files`);

            // Validate response data
            if (!res.data) {
                throw new Error('No data received from server');
            }

            // Ensure we always have an array
            const fileList = Array.isArray(res.data) ? res.data : [];

            if (!Array.isArray(res.data)) {
                console.warn('API returned non-array data:', res.data);
                setError(`Unexpected response format from server`);
            }

            setFiles(fileList);
            if (!selectedFile && fileList.length > 0) {
                setSelectedFile(fileList[0]);
            } else if (fileList.length === 0) {
                setError('No schema files found. Click "New File" to create one.');
            }
        } catch (err: any) {
            console.error("Failed to load files", err);
            const errorMsg = err.response?.data?.detail || err.message || 'Unknown error';
            setError(`Error loading files: ${errorMsg}`);
            setFiles([]); // Set to empty array on error
        }
    };

    const fetchDefinitions = async () => {
        try {
            const res = await axios.get(`/api/files/protocols/${protocol}/definitions`);
            setDefinitions(res.data);
        } catch (err) {
            console.error("Failed to load definitions", err);
        }
    }

    useEffect(() => {
        AsnService.getProtocolMetadata(protocol).then(meta => {
            setIsBundled(meta.is_bundled);
        }).catch(console.error);

        fetchFiles();
        fetchDefinitions();
    }, [protocol]);

    useEffect(() => {
        if (!selectedFile) {
            setContent('');
            setIsDirty(false);
            return;
        }

        setLoading(true);
        axios.get(`/api/files/protocols/${protocol}/files/${selectedFile}`)
            .then(res => {
                setContent(res.data.content);
                setIsDirty(false);
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false));

    }, [protocol, selectedFile]);

    const handleSave = async () => {
        if (!selectedFile) return;
        setSaving(true);
        try {
            const res = await axios.put(`/api/files/protocols/${protocol}/files/${selectedFile}`, { content });
            setIsDirty(false);
            fetchDefinitions(); // Refresh defs

            if (res.data.status === 'warning') {
                alert(res.data.message);
            }

            onSchemaUpdated?.();
        } catch (err) {
            console.error("Failed to save", err);
            alert("Failed to save file");
        } finally {
            setSaving(false);
        }
    };

    const handleSnapshot = async () => {
        if (!selectedFile) return;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const snapName = selectedFile.replace('.asn', '') + `_snap_${timestamp}.asn`;

        try {
            await axios.post(`/api/files/protocols/${protocol}/files`, {
                filename: snapName,
                content: content
            });
            await fetchFiles();
            alert(`Snapshot saved as ${snapName}`);
        } catch (err: any) {
            alert("Failed to save snapshot: " + (err.response?.data?.detail || err.message));
        }
    }

    const insertSnippet = (snippet: string) => {
        const editor = editorRef.current;
        if (!editor) return;

        const selection = editor.getSelection();
        const op = { range: selection, text: snippet, forceMoveMarkers: true };
        editor.executeEdits("my-source", [op]);
        editor.focus();
        setIsDirty(true);
        setContent(editor.getValue());
    };

    const openCreateFileModal = () => {
        setNewFileName('');
        setCreateFileOpen(true);
    }

    const handleCreateFileConfirm = async () => {
        if (!newFileName) return;
        const filename = newFileName.endsWith('.asn') ? newFileName : `${newFileName}.asn`;

        try {
            await axios.post(`/api/files/protocols/${protocol}/files`, { filename });
            await fetchFiles();
            setSelectedFile(filename);
            setCreateFileOpen(false);
        } catch (err: any) {
            alert("Failed to create file: " + (err.response?.data?.detail || err.message));
        }
    }

    const validateContent = (model: any, monaco: Monaco) => {
        const text = model.getValue();
        const markers: any[] = [];

        const regex = /FROM\s+([A-Za-z0-9-]+)/g;
        let match;

        while ((match = regex.exec(text)) !== null) {
            const moduleName = match[1];
            const found = files.some(f =>
                f.toLowerCase() === `${moduleName}.asn`.toLowerCase() ||
                f.toLowerCase() === moduleName.toLowerCase()
            ) || definitions[`${moduleName}.asn`] !== undefined;

            if (!found) {
                const startPos = match.index + match[0].lastIndexOf(moduleName);
                const endPos = startPos + moduleName.length;
                const start = model.getPositionAt(startPos);
                const end = model.getPositionAt(endPos);

                markers.push({
                    severity: monaco.MarkerSeverity.Warning,
                    startLineNumber: start.lineNumber,
                    startColumn: start.column,
                    endLineNumber: end.lineNumber,
                    endColumn: end.column,
                    message: `Module '${moduleName}' not found (checked file list)`,
                });
            }
        }
        monaco.editor.setModelMarkers(model, 'owner', markers);
    }

    const handleEditorDidMount = (editor: any, monaco: Monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;

        if (!monaco.languages.getLanguages().some((l: any) => l.id === 'asn1')) {
            monaco.languages.register({ id: 'asn1' });
            monaco.languages.setMonarchTokensProvider('asn1', {
                tokenizer: {
                    root: [
                        [/\b(DEFINITIONS|BEGIN|END|EXPORTS|IMPORTS|FROM|AUTOMATIC|TAGS|OPTIONAL|DEFAULT|COMPONENTS|WITH|SYNTAX|OF)\b/, 'keyword'],
                        [/\b(SEQUENCE|INTEGER|OCTET STRING|BIT STRING|CHOICE|ENUMERATED|BOOLEAN|NULL|OBJECT IDENTIFIER|SET|OF|SIZE)\b/, 'type'],
                        [/--.*$/, 'comment'],
                        [/[A-Z][a-zA-Z0-9-]*/, 'type.identifier'],
                        [/[a-z][a-zA-Z0-9-]*/, 'identifier'],
                        [/\d+/, 'number'],
                        [/[{}]/, 'delimiter.bracket'],
                        [/::=/, 'operator'],
                    ]
                }
            });
        }

        editor.onDidChangeModelContent(() => {
            validateContent(editor.getModel(), monaco);
        });

        validateContent(editor.getModel(), monaco);
    };

    return (
        <Stack h="100%" gap={0}>
            {isBundled && (
                <Alert variant="light" color="blue" title="Bundled Protocol" icon={<IconInfoCircle />} p="xs" radius={0}>
                    Changes to this protocol are temporary (saved to app resources) and will be reset if you update the app.
                    To create persistent schemas, please add a custom folder in Settings.
                </Alert>
            )}
            {error && (
                <Alert
                    variant="light"
                    color="red"
                    title="Error"
                    p="xs"
                    radius={0}
                    withCloseButton
                    onClose={() => setError(null)}
                >
                    {error}
                </Alert>
            )}
            {/* Toolbar */}
            <Group justify="space-between" p="xs" style={{ borderBottom: '1px solid var(--mantine-color-default-border)', flexShrink: 0 }} bg="var(--mantine-color-body)">
                <Group gap="xs">
                    <Button variant="light" size="xs" leftSection={<IconPlus size="1rem" />} onClick={openCreateFileModal} aria-label="Create new file">New File</Button>
                    <ActionIcon variant="light" size="md" onClick={() => { fetchFiles(); fetchDefinitions(); }} title="Refresh" aria-label="Refresh files">
                        <IconRefresh size="1rem" />
                    </ActionIcon>
                    <Text size="sm" c="dimmed">|</Text>
                    <Text size="sm" fw={700}>{selectedFile || 'No File Selected'}</Text>
                </Group>
                <Group gap="xs">
                    <Button
                        variant="default"
                        size="xs"
                        leftSection={<IconCamera size="1rem" />}
                        disabled={!selectedFile}
                        onClick={handleSnapshot}
                        aria-label="Create snapshot"
                    >
                        Snapshot
                    </Button>
                    <Button
                        size="xs"
                        leftSection={<IconDeviceFloppy size="1rem" />}
                        disabled={!isDirty || !selectedFile}
                        loading={saving}
                        onClick={handleSave}
                        aria-label="Save file"
                    >
                        Save
                    </Button>
                </Group>
            </Group>

            {/* Main Layout - Flex */}
            <Group flex={1} gap={0} align="stretch" style={{ overflow: 'hidden' }}>
                {/* Sidebar: Files */}
                <Box w={250} style={{ borderRight: '1px solid var(--mantine-color-default-border)', display: 'flex', flexDirection: 'column' }}>
                    <Text p="xs" size="xs" fw={700} c="dimmed" bg="var(--mantine-color-body)" style={{ flexShrink: 0 }}>FILES</Text>
                    <ScrollArea style={{ flex: 1 }}>
                        <Stack gap={0}>
                            {files.map(file => (
                                <NavLink
                                    key={file}
                                    label={file}
                                    active={selectedFile === file}
                                    leftSection={<IconFileCode size="1rem" />}
                                    onClick={() => {
                                        if (isDirty) {
                                            if (!confirm("You have unsaved changes. Discard?")) return;
                                        }
                                        setSelectedFile(file);
                                    }}
                                    variant="light"
                                    style={{ borderRadius: 0 }}
                                />
                            ))}
                        </Stack>
                    </ScrollArea>
                </Box>

                {/* Center: Editor */}
                <Box style={{ flex: 1, minWidth: 0 }}>
                    {loading ? (
                        <Box style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Loader />
                        </Box>
                    ) : (
                        <Editor
                            height="100%"
                            defaultLanguage="asn1"
                            value={content}
                            onChange={(value) => {
                                setContent(value || '');
                                setIsDirty(true);
                            }}
                            onMount={handleEditorDidMount}
                            theme={colorScheme === 'dark' ? "vs-dark" : "light"}
                            options={{
                                minimap: { enabled: false },
                                fontSize: 14,
                                scrollBeyondLastLine: false,
                                automaticLayout: true,
                                padding: { top: 10, bottom: 10 },
                                wordWrap: 'on'
                            }}
                        />
                    )}
                </Box>

                {/* Sidebar: Palette */}
                <Box w={300} style={{ borderLeft: '1px solid var(--mantine-color-default-border)', display: 'flex', flexDirection: 'column' }}>
                    <Tabs defaultValue="snippets" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <Tabs.List grow>
                            <Tabs.Tab value="snippets">Snippets</Tabs.Tab>
                            <Tabs.Tab value="exports">Exports</Tabs.Tab>
                        </Tabs.List>

                        <Tabs.Panel value="snippets" style={{ flex: 1, overflow: 'hidden' }}>
                            <ScrollArea h="100%" p="xs">
                                <Stack gap="xs">
                                    {SNIPPETS.map(snip => (
                                        <Button
                                            key={snip.label}
                                            variant="default"
                                            size="xs"
                                            fullWidth
                                            justify="start"
                                            onClick={() => insertSnippet(snip.code)}
                                            disabled={!selectedFile}
                                            style={{ height: 'auto', whiteSpace: 'normal', textAlign: 'left' }}
                                        >
                                            {snip.label}
                                        </Button>
                                    ))}
                                </Stack>
                            </ScrollArea>
                        </Tabs.Panel>

                        <Tabs.Panel value="exports" style={{ flex: 1, overflow: 'hidden' }}>
                            <ScrollArea h="100%">
                                <Accordion variant="filled" multiple>
                                    {Object.entries(definitions).map(([file, types]) => (
                                        <Accordion.Item key={file} value={file}>
                                            <Accordion.Control p="xs"><Text size="xs">{file}</Text></Accordion.Control>
                                            <Accordion.Panel p={0}>
                                                <Stack gap={0}>
                                                    {types.map(type => (
                                                        <Button
                                                            key={type}
                                                            variant="subtle"
                                                            size="xs"
                                                            fullWidth
                                                            justify="start"
                                                            onClick={() => insertSnippet(type)}
                                                            disabled={!selectedFile}
                                                            radius={0}
                                                        >
                                                            {type}
                                                        </Button>
                                                    ))}
                                                    {types.length === 0 && <Text size="xs" c="dimmed" p="xs" fs="italic">No definitions found</Text>}
                                                </Stack>
                                            </Accordion.Panel>
                                        </Accordion.Item>
                                    ))}
                                </Accordion>
                            </ScrollArea>
                        </Tabs.Panel>
                    </Tabs>
                </Box>
            </Group>

            <Modal opened={createFileOpen} onClose={() => setCreateFileOpen(false)} title="New File" size="sm">
                <Stack>
                    <TextInput
                        label="Filename"
                        placeholder="my_spec.asn"
                        data-autofocus
                        value={newFileName}
                        onChange={(e) => setNewFileName(e.currentTarget.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFileConfirm(); }}
                    />
                    <Group justify="flex-end">
                        <Button variant="default" onClick={() => setCreateFileOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateFileConfirm}>Create</Button>
                    </Group>
                </Stack>
            </Modal>
        </Stack>
    );
}

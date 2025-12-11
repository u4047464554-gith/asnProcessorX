import { useState } from 'react'
import {
    AppShell,
    Group,
    Select,
    Textarea,
    Title,
    Button,
    Stack,
    Text,
    JsonInput,
    Paper,
    Collapse,
    Modal,
    Grid,
    ScrollArea,
    Box,
    MantineProvider,
    SegmentedControl,
    TextInput,
    ActionIcon,
    Divider,
    Badge
} from '@mantine/core'
// import { IconSettings, IconLayoutSidebarRight, IconTrash, IconDeviceFloppy, IconDatabase, IconCopy, IconTimeline } from '@tabler/icons-react'
import { IconSettings, IconLayoutSidebarRight, IconTrash, IconDeviceFloppy, IconDatabase, IconCopy } from '@tabler/icons-react'
// import { Link, Routes, Route } from 'react-router-dom'
import { Routes, Route } from 'react-router-dom'
import { BitInspectorPanel } from './components/trace/BitInspectorPanel'
import { DefinitionTree } from './components/definition/DefinitionTree'
import { SettingsModal } from './components/SettingsModal'
import { themes } from './theme'
import { StarTrekShip } from './components/StarTrekShip'
import { SchemaEditor } from './components/editor/SchemaEditor'
import { StructuredJsonEditor } from './components/editor/StructuredJsonEditor'
import { useAsnProcessor } from './hooks/useAsnProcessor'
import { hexTo0xHex, xHexToHex, safeParse } from './utils/conversion'
import { ScratchpadPanel } from './components/ScratchpadPanel'
import { MscEditor } from './pages/MscEditor'
import { useSession } from './hooks/useSession'
import { IconPlus } from '@tabler/icons-react'

// Extract the path from an error message (format: "Path.To.Field: Error message")
const extractErrorPath = (error: string | null): string | undefined => {
    if (!error) return undefined;
    const match = error.match(/^([^:]+):/);
    return match ? match[1].trim() : undefined;
};

function AsnProcessor() {
    // Business Logic & State
    const {
        protocolsWithMeta, selectedProtocol, handleProtocolChange,
        demoTypeOptions, selectedDemoOption, handleDemoSelect,
        selectedType,
        definitionTree,
        hexData, setHexData,
        jsonData, setJsonData,
        formattedHex, setFormattedHex,
        error,
        traceData, traceLoading, traceError,
        editorMode, setEditorMode,
        setLastEdited,
        loadExample,
        codegenLoading, codegenError, handleCodegen,
        refreshDefinitions,
        savedMessages, handleSaveMessage, handleDeleteMessage, handleClearMessages,
        loadedMessageName
    } = useAsnProcessor();

    // Session management
    const { sessions, currentSession, switchSession, createSession } = useSession();
    const [newSessionModalOpen, setNewSessionModalOpen] = useState(false);
    const [newSessionName, setNewSessionName] = useState('');

    // UI State
    const [inspectorOpen, setInspectorOpen] = useState(true)
    const [codegenModalOpen, setCodegenModalOpen] = useState(false)
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [schemaEditorOpen, setSchemaEditorOpen] = useState(false)
    const [definitionOpen, setDefinitionOpen] = useState(true)
    const [bitInspectorOpen, setBitInspectorOpen] = useState(false)  // Collapsed by default
    const [saveModalOpen, setSaveModalOpen] = useState(false)
    const [saveFilename, setSaveFilename] = useState('')
    const [saveMode, setSaveMode] = useState<'new' | 'overwrite'>('new')
    const [memoryModalOpen, setMemoryModalOpen] = useState(false)
    const [hexInputType, setHexInputType] = useState<'raw' | '0x'>('raw')
    const [copiedHex, setCopiedHex] = useState(false)
    const [copiedJson, setCopiedJson] = useState(false)


    // Theme State
    const [currentThemeName, setCurrentThemeName] = useState<string>(() => {
        return localStorage.getItem('ui-theme') || 'Default';
    });

    const handleThemeChange = (name: string) => {
        setCurrentThemeName(name);
        localStorage.setItem('ui-theme', name);
    };

    const copyToClipboard = async (text: string, type: 'hex' | 'json') => {
        try {
            await navigator.clipboard.writeText(text);
            if (type === 'hex') {
                setCopiedHex(true);
                setTimeout(() => setCopiedHex(false), 2000);
            } else {
                setCopiedJson(true);
                setTimeout(() => setCopiedJson(false), 2000);
            }
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    // UI Effects
    // useEffect(() => {
    //     // Reset definition tree visibility when type changes
    //     setDefinitionOpen(false);
    // }, [selectedType]);

    const onCodegen = async () => {
        const success = await handleCodegen();
        if (success) setCodegenModalOpen(false);
    }

    const openSaveModal = () => {
        // Pre-fill with loaded message name if available
        if (loadedMessageName) {
            setSaveFilename(loadedMessageName);
            setSaveMode('overwrite');
        } else {
            setSaveFilename('');
            setSaveMode('new');
        }
        setSaveModalOpen(true);
    };

    const onSave = async () => {
        if (!saveFilename) return;

        // Check if saving to existing file (different from loaded)
        const isOverwriting = savedMessages.some(m => m.replace(/\.json$/, '') === saveFilename);
        const isOriginalFile = saveFilename === loadedMessageName;

        if (isOverwriting && !isOriginalFile) {
            if (!confirm(`A message named "${saveFilename}" already exists. Overwrite it?`)) {
                return;
            }
        }

        const success = await handleSaveMessage(saveFilename);
        if (success) {
            setSaveModalOpen(false);
            setSaveFilename('');
        }
    }

    return (
        <MantineProvider theme={themes[currentThemeName]} forceColorScheme={currentThemeName.includes('Star Trek') ? 'dark' : undefined}>
            <AppShell
                header={{ height: 60 }}
                padding="md"
            >
                <AppShell.Header>
                    {currentThemeName.includes('Star Trek') && <StarTrekShip />}
                    <Stack gap={0} style={{ position: 'relative', zIndex: 1 }}>
                        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
                            <Title order={3} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>ASN.1 Processor</Title>
                            <Group gap="xs" wrap="nowrap">
                                <Select
                                    size="xs"
                                    placeholder="Session"
                                    data={sessions.map(s => ({ value: s.id, label: s.name }))}
                                    value={currentSession?.id || null}
                                    onChange={(v) => v && switchSession(v)}
                                    style={{ minWidth: 120 }}
                                    rightSection={
                                        <ActionIcon size="xs" variant="subtle" onClick={(e) => {
                                            e.stopPropagation();
                                            setNewSessionModalOpen(true);
                                        }}>
                                            <IconPlus size="0.7rem" />
                                        </ActionIcon>
                                    }
                                    rightSectionPointerEvents="auto"
                                />
                                {/* Feature: MSC Editor (Disabled)
                                <Link to="/msc" style={{ textDecoration: 'none' }}>
                                    <Button variant="outline" size="xs" leftSection={<IconTimeline size="0.875rem" />}>
                                        MSC Editor
                                    </Button>
                                </Link>
                                */}
                                {/* Feature: Edit Schema (Disabled)
                                <Button
                                    variant="outline"
                                    size="xs"
                                    disabled={!selectedProtocol}
                                    onClick={() => setSchemaEditorOpen(true)}
                                    aria-label="Edit Schema"
                                    style={{ whiteSpace: 'nowrap' }}
                                >
                                    Edit Schema
                                </Button>
                                */}
                                {/* Feature: Generate C Stubs (Disabled)
                                <Button
                                    variant="outline"
                                    size="xs"
                                    disabled={!selectedProtocol}
                                    onClick={() => setCodegenModalOpen(true)}
                                    aria-label="Generate C Stubs"
                                    style={{ whiteSpace: 'nowrap' }}
                                >
                                    Generate C Stubs
                                </Button>
                                */}
                                <Button
                                    variant={inspectorOpen ? "filled" : "outline"}
                                    size="xs"
                                    onClick={() => setInspectorOpen(!inspectorOpen)}
                                    leftSection={<IconLayoutSidebarRight size="0.875rem" />}
                                    aria-label="Toggle Inspector"
                                    style={{ whiteSpace: 'nowrap' }}
                                >
                                    Inspector
                                </Button>
                                <ActionIcon
                                    variant="outline"
                                    size="md"
                                    onClick={() => setSettingsOpen(true)}
                                    aria-label="Settings"
                                    title="Settings"
                                >
                                    <IconSettings size="1rem" />
                                </ActionIcon>
                                <ActionIcon
                                    variant="outline"
                                    size="md"
                                    onClick={() => setMemoryModalOpen(true)}
                                    aria-label="Memory"
                                    title="Memory"
                                >
                                    <IconDatabase size="1rem" />
                                </ActionIcon>
                            </Group>
                        </Group>
                        <Divider />
                    </Stack>
                </AppShell.Header>

                <AppShell.Main>
                    <Group mb="md" align="flex-end" wrap="wrap">
                        <Select
                            label="Protocol"
                            placeholder="Select Protocol"
                            data={protocolsWithMeta.map(p => ({
                                value: p.name,
                                label: p.error ? `⚠️ ${p.name}` : p.name,
                                disabled: !!p.error
                            }))}
                            value={selectedProtocol}
                            onChange={handleProtocolChange}
                            searchable
                            style={{ minWidth: 150, flex: '0 1 auto' }}
                        />
                        <Select
                            label="Message"
                            placeholder="Select message"
                            data={demoTypeOptions}
                            value={selectedDemoOption}
                            onChange={handleDemoSelect}
                            searchable
                            disabled={!selectedProtocol && demoTypeOptions.length === 0}
                            style={{ minWidth: 200, flex: '1 1 auto' }}
                        />
                        <Button variant="light" onClick={loadExample} disabled={!selectedDemoOption} aria-label="Reload" style={{ whiteSpace: 'nowrap' }}>
                            Reload
                        </Button>
                        <Button
                            variant="light"
                            onClick={openSaveModal}
                            disabled={!selectedProtocol || !selectedType || !jsonData}
                            leftSection={<IconDeviceFloppy size="0.875rem" />}
                            style={{ whiteSpace: 'nowrap' }}
                        >
                            Save
                        </Button>
                        {loadedMessageName && (
                            <Text size="sm" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                                Loaded: <Text span fw={500} c="blue">{loadedMessageName}</Text>
                            </Text>
                        )}
                    </Group>

                    {error && (
                        <Paper withBorder p="sm" mb="sm" bg="red.0">
                            <Text size="sm" c="red.7" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                                {error}
                            </Text>
                        </Paper>
                    )}

                    <Grid gutter="md">
                        <Grid.Col span={inspectorOpen ? 6 : 12}>
                            <Stack gap="md">
                                {!inspectorOpen && (
                                    <Paper withBorder p="md">
                                        <Stack gap="md">
                                            <Group justify="space-between">
                                                <Group gap="xs">
                                                    <Text fw={600}>Hex</Text>
                                                    <ActionIcon
                                                        size="sm"
                                                        variant="subtle"
                                                        onClick={() => copyToClipboard(hexInputType === 'raw' ? hexData : formattedHex, 'hex')}
                                                        title="Copy to clipboard"
                                                        color={copiedHex ? 'green' : undefined}
                                                    >
                                                        <IconCopy size="0.875rem" />
                                                    </ActionIcon>
                                                    {copiedHex && <Text size="xs" c="green" fw={500}>Copied!</Text>}
                                                </Group>
                                                <SegmentedControl
                                                    size="xs"
                                                    value={hexInputType}
                                                    onChange={(v) => setHexInputType(v as 'raw' | '0x')}
                                                    data={[{ label: 'Raw Hex', value: 'raw' }, { label: '0x Hex', value: '0x' }]}
                                                />
                                            </Group>
                                            <Textarea
                                                placeholder={hexInputType === 'raw' ? "80 05 ..." : "0x80, 0x05, ..."}
                                                minRows={3}
                                                maxRows={8}
                                                autosize
                                                value={hexInputType === 'raw' ? hexData : formattedHex}
                                                onChange={(e) => {
                                                    const val = e.currentTarget.value
                                                    if (hexInputType === 'raw') {
                                                        setHexData(val)
                                                        setFormattedHex(hexTo0xHex(val))
                                                    } else {
                                                        setFormattedHex(val)
                                                        const hex = xHexToHex(val)
                                                        if (hex) {
                                                            setHexData(hex)
                                                        }
                                                    }
                                                    setLastEdited('hex')
                                                }}
                                                style={{ fontFamily: 'monospace' }}
                                            />
                                        </Stack>
                                    </Paper>
                                )}
                                <Paper withBorder p="md">
                                    <Stack gap="md">
                                        <Group justify="space-between">
                                            <Group gap="xs">
                                                <Text fw={600}>JSON</Text>
                                                {selectedType && <Badge size="xs" variant="light" color="blue">{selectedType}</Badge>}
                                                <ActionIcon
                                                    size="sm"
                                                    variant="subtle"
                                                    onClick={() => copyToClipboard(jsonData, 'json')}
                                                    title="Copy to clipboard"
                                                    color={copiedJson ? 'green' : undefined}
                                                >
                                                    <IconCopy size="0.875rem" />
                                                </ActionIcon>
                                                {copiedJson && <Text size="xs" c="green" fw={500}>Copied!</Text>}
                                            </Group>
                                            <Group gap="xs">
                                                {/* Feature: Hide/Show Schema (Disabled)
                                                <Button
                                                    size="xs"
                                                    variant="subtle"
                                                    onClick={() => setDefinitionOpen(!definitionOpen)}
                                                >
                                                    {definitionOpen ? 'Hide Schema' : 'Show Schema'}
                                                </Button>
                                                */}
                                                <SegmentedControl
                                                    size="xs"
                                                    value={editorMode}
                                                    onChange={(v: any) => setEditorMode(v)}
                                                    data={[{ label: 'Structured', value: 'structured' }, { label: 'Raw JSON', value: 'raw' }]}
                                                />
                                            </Group>
                                        </Group>

                                        {editorMode === 'raw' ? (
                                            <JsonInput
                                                placeholder="{ ... }"
                                                validationError="Invalid JSON"
                                                formatOnBlur
                                                autosize
                                                minRows={10}
                                                maxRows={25}
                                                value={jsonData}
                                                onChange={(val) => {
                                                    setJsonData(val)
                                                    setLastEdited('json')
                                                }}
                                            />
                                        ) : (
                                            <Paper withBorder={false} style={{ minHeight: 300, display: 'flex', flexDirection: 'column' }}>
                                                <ScrollArea.Autosize mah={600} type="auto" offsetScrollbars>
                                                    <StructuredJsonEditor
                                                        data={safeParse(jsonData)}
                                                        schema={definitionTree}
                                                        onChange={(newData) => {
                                                            setJsonData(JSON.stringify(newData, null, 2));
                                                            setLastEdited('json');
                                                        }}
                                                        errorPath={extractErrorPath(error)}
                                                    />
                                                </ScrollArea.Autosize>
                                            </Paper>
                                        )}
                                    </Stack>
                                </Paper>
                            </Stack>
                        </Grid.Col>

                        {inspectorOpen && (
                            <Grid.Col span={6}>
                                <Stack gap="md" h="100%">
                                    <Paper withBorder p="md">
                                        <Stack gap="md">
                                            <Group justify="space-between">
                                                <Group gap="xs">
                                                    <Text fw={600}>Hex</Text>
                                                    <ActionIcon
                                                        size="sm"
                                                        variant="subtle"
                                                        onClick={() => copyToClipboard(hexInputType === 'raw' ? hexData : formattedHex, 'hex')}
                                                        title="Copy to clipboard"
                                                        color={copiedHex ? 'green' : undefined}
                                                    >
                                                        <IconCopy size="0.875rem" />
                                                    </ActionIcon>
                                                    {copiedHex && <Text size="xs" c="green" fw={500}>Copied!</Text>}
                                                </Group>
                                                <SegmentedControl
                                                    size="xs"
                                                    value={hexInputType}
                                                    onChange={(v) => setHexInputType(v as 'raw' | '0x')}
                                                    data={[{ label: 'Raw Hex', value: 'raw' }, { label: '0x Hex', value: '0x' }]}
                                                />
                                            </Group>
                                            <Textarea
                                                placeholder={hexInputType === 'raw' ? "80 05 ..." : "0x80, 0x05, ..."}
                                                minRows={3}
                                                maxRows={8}
                                                autosize
                                                value={hexInputType === 'raw' ? hexData : formattedHex}
                                                onChange={(e) => {
                                                    const val = e.currentTarget.value
                                                    if (hexInputType === 'raw') {
                                                        setHexData(val)
                                                        setFormattedHex(hexTo0xHex(val))
                                                    } else {
                                                        setFormattedHex(val)
                                                        const hex = xHexToHex(val)
                                                        if (hex) {
                                                            setHexData(hex)
                                                        }
                                                    }
                                                    setLastEdited('hex')
                                                }}
                                                style={{ fontFamily: 'monospace' }}
                                            />
                                        </Stack>
                                    </Paper>
                                    <Paper withBorder p="md" style={{ minHeight: bitInspectorOpen ? '400px' : 'auto' }}>
                                        <Stack h="100%">
                                            <Group justify="space-between" align="center">
                                                <Text fw={600}>Bit Inspector</Text>
                                                <Button size="xs" variant="subtle" onClick={() => setBitInspectorOpen((prev) => !prev)}>
                                                    {bitInspectorOpen ? 'Hide' : 'Show'}
                                                </Button>
                                            </Group>
                                            <Collapse in={bitInspectorOpen}>
                                                <Box style={{ position: 'relative' }}>
                                                    <ScrollArea h={350}>
                                                        <BitInspectorPanel
                                                            hexInput={hexData}
                                                            traceRoot={traceData?.trace}
                                                            totalBits={traceData?.total_bits}
                                                            loading={traceLoading}
                                                            error={traceError}
                                                        />
                                                    </ScrollArea>
                                                </Box>
                                            </Collapse>
                                        </Stack>
                                    </Paper>
                                </Stack>
                            </Grid.Col>
                        )}
                    </Grid>

                    {definitionTree && (
                        <Paper withBorder p="sm" mt="md" mb="md">
                            <Group justify="space-between" align="center" mb="xs">
                                <Text size="sm" fw={500}>Definition Tree</Text>
                                <Button size="xs" variant="subtle" onClick={() => setDefinitionOpen((prev) => !prev)} aria-label="Toggle definition tree">
                                    {definitionOpen ? 'Hide' : 'Show'}
                                </Button>
                            </Group>
                            <Collapse in={definitionOpen}>
                                <DefinitionTree root={definitionTree} />
                            </Collapse>
                        </Paper>
                    )}

                    <ScratchpadPanel />

                    <Modal
                        opened={codegenModalOpen}
                        onClose={() => setCodegenModalOpen(false)}
                        title={`Generate C Stubs for ${selectedProtocol}`}
                        size="lg"
                    >
                        <Stack>
                            <Text size="sm">
                                This will generate C encoder/decoder stubs (PER) for <b>{selectedProtocol}</b> using <code>asn1c</code>.
                            </Text>
                            <Text size="xs" c="dimmed">
                                Note: This requires the <code>asn1c</code> binary to be installed and available in your system PATH.
                            </Text>

                            {codegenError && (
                                <Text c="red" size="sm">{codegenError}</Text>
                            )}

                            <Group justify="flex-end" mt="md">
                                <Button variant="subtle" onClick={() => setCodegenModalOpen(false)}>Cancel</Button>
                                <Button onClick={onCodegen} loading={codegenLoading}>Generate & Download</Button>
                            </Group>
                        </Stack>
                    </Modal>

                    <SettingsModal
                        opened={settingsOpen}
                        onClose={() => setSettingsOpen(false)}
                        currentTheme={currentThemeName}
                        onThemeChange={handleThemeChange}
                    />

                    <Modal
                        opened={saveModalOpen}
                        onClose={() => setSaveModalOpen(false)}
                        title={saveMode === 'overwrite' ? "Update Message" : "Save Message"}
                    >
                        <Stack>
                            <TextInput
                                label="Filename"
                                placeholder="my_message"
                                value={saveFilename}
                                onChange={(e) => setSaveFilename(e.currentTarget.value)}
                                data-autofocus
                                onKeyDown={(e) => { if (e.key === 'Enter') onSave(); }}
                            />
                            {saveMode === 'overwrite' && saveFilename === loadedMessageName && (
                                <Text size="xs" c="dimmed">
                                    This will update the existing message "{loadedMessageName}".
                                    Change the filename to save as a new message.
                                </Text>
                            )}
                            <Group justify="flex-end">
                                <Button variant="default" onClick={() => setSaveModalOpen(false)}>Cancel</Button>
                                <Button onClick={onSave} disabled={!saveFilename}>
                                    {saveMode === 'overwrite' && saveFilename === loadedMessageName ? 'Update' : 'Save'}
                                </Button>
                            </Group>
                        </Stack>
                    </Modal>

                    <Modal
                        opened={memoryModalOpen}
                        onClose={() => setMemoryModalOpen(false)}
                        title="Memory Locations"
                    >
                        <Stack>
                            {savedMessages.length === 0 ? (
                                <Text c="dimmed">No saved messages. Use the save button after encoding/decoding a message.</Text>
                            ) : (
                                <ScrollArea h={300}>
                                    <Stack gap="xs">
                                        {savedMessages.map(msg => {
                                            const displayName = msg.replace(/\.json$/, '');
                                            return (
                                                <Group
                                                    key={msg}
                                                    justify="space-between"
                                                    p="xs"
                                                    bg="var(--mantine-color-body)"
                                                    style={{
                                                        border: '1px solid var(--mantine-color-default-border)',
                                                        cursor: 'pointer'
                                                    }}
                                                    onClick={() => {
                                                        handleDemoSelect(`saved::${msg}`);
                                                        setMemoryModalOpen(false);
                                                    }}
                                                >
                                                    <Text size="sm">{displayName}</Text>
                                                    <ActionIcon
                                                        color="red"
                                                        variant="subtle"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteMessage(msg);
                                                        }}
                                                    >
                                                        <IconTrash size="1rem" />
                                                    </ActionIcon>
                                                </Group>
                                            );
                                        })}
                                    </Stack>
                                </ScrollArea>
                            )}
                            <Group justify="space-between" mt="md">
                                <Button color="red" variant="subtle" onClick={handleClearMessages} disabled={savedMessages.length === 0}>Clear All Memory</Button>
                                <Button onClick={() => setMemoryModalOpen(false)}>Close</Button>
                            </Group>
                        </Stack>
                    </Modal>

                    <Modal
                        opened={schemaEditorOpen}
                        onClose={() => setSchemaEditorOpen(false)}
                        title={`Schema Editor: ${selectedProtocol}`}
                        fullScreen
                        padding={0}
                    >
                        <Box h="calc(100vh - 60px)">
                            {selectedProtocol && <SchemaEditor protocol={selectedProtocol} onSchemaUpdated={refreshDefinitions} />}
                        </Box>
                    </Modal>

                    {/* New Session Modal */}
                    <Modal
                        opened={newSessionModalOpen}
                        onClose={() => {
                            setNewSessionModalOpen(false);
                            setNewSessionName('');
                        }}
                        title="Create New Session"
                        size="sm"
                    >
                        <Stack>
                            <TextInput
                                label="Session Name"
                                placeholder="My New Session"
                                value={newSessionName}
                                onChange={(e) => setNewSessionName(e.currentTarget.value)}
                                data-autofocus
                            />
                            <Group justify="flex-end">
                                <Button variant="default" onClick={() => {
                                    setNewSessionModalOpen(false);
                                    setNewSessionName('');
                                }}>Cancel</Button>
                                <Button onClick={async () => {
                                    if (!newSessionName.trim()) return;
                                    const session = await createSession(newSessionName.trim());
                                    setNewSessionModalOpen(false);
                                    setNewSessionName('');
                                    switchSession(session.id);
                                }} disabled={!newSessionName.trim()}>Create & Switch</Button>
                            </Group>
                        </Stack>
                    </Modal>
                </AppShell.Main>
            </AppShell>
        </MantineProvider>
    )
}

function App() {
    return (
        <Routes>
            <Route path="/msc" element={<MscEditor />} />
            <Route path="/" element={<AsnProcessor />} />
            <Route path="*" element={<AsnProcessor />} />
        </Routes>
    )
}

export default App

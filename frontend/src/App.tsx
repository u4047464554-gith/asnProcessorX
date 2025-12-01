import { useState, useEffect } from 'react'
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
  Divider
} from '@mantine/core'
import { IconSettings, IconLayoutSidebarRight, IconTrash, IconDeviceFloppy, IconDatabase, IconCopy, IconFolderOpen } from '@tabler/icons-react'
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

function App() {
  // Business Logic & State
  const {
      protocols, selectedProtocol, handleProtocolChange,
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
      savedMessages, handleSaveMessage, handleDeleteMessage, handleClearMessages
  } = useAsnProcessor();

  // UI State
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [codegenModalOpen, setCodegenModalOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [schemaEditorOpen, setSchemaEditorOpen] = useState(false)
  const [definitionOpen, setDefinitionOpen] = useState(false)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [saveFilename, setSaveFilename] = useState('')
  const [memoryModalOpen, setMemoryModalOpen] = useState(false)
  const [hexInputType, setHexInputType] = useState<'raw' | '0x'>('raw')
  const [copiedHex, setCopiedHex] = useState(false)
  const [copiedJson, setCopiedJson] = useState(false)
  const [savedHex, setSavedHex] = useState(false)
  const [savedJson, setSavedJson] = useState(false)
  const [saveHexModalOpen, setSaveHexModalOpen] = useState(false)
  const [saveHexFilename, setSaveHexFilename] = useState('')
  const [saveJsonModalOpen, setSaveJsonModalOpen] = useState(false)
  const [saveJsonFilename, setSaveJsonFilename] = useState('')
  const [loadHexModalOpen, setLoadHexModalOpen] = useState(false)
  const [loadJsonModalOpen, setLoadJsonModalOpen] = useState(false)

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

  const saveToMemory = (type: 'hex' | 'json', name: string) => {
      const data = type === 'hex' ? (hexInputType === 'raw' ? hexData : formattedHex) : jsonData;
      if (!data || !name) return false;
      
      const key = `asn_memory_${type}`;
      const timestamp = new Date().toISOString();
      const saved = JSON.parse(localStorage.getItem(key) || '[]');
      
      // Check if name already exists and overwrite, or add new
      const existingIndex = saved.findIndex((item: any) => item.name === name);
      if (existingIndex >= 0) {
          saved[existingIndex] = { name, data, timestamp };
      } else {
          saved.push({ name, data, timestamp });
      }
      localStorage.setItem(key, JSON.stringify(saved));
      
      // Show feedback
      if (type === 'hex') {
          setSavedHex(true);
          setTimeout(() => setSavedHex(false), 2000);
      } else {
          setSavedJson(true);
          setTimeout(() => setSavedJson(false), 2000);
      }
      return true;
  };

  const handleSaveHex = () => {
      if (!saveHexFilename) return;
      const success = saveToMemory('hex', saveHexFilename);
      if (success) {
          setSaveHexModalOpen(false);
          setSaveHexFilename('');
      }
  };

  const handleSaveJson = () => {
      if (!saveJsonFilename) return;
      const success = saveToMemory('json', saveJsonFilename);
      if (success) {
          setSaveJsonModalOpen(false);
          setSaveJsonFilename('');
      }
  };

  const getSavedItems = (type: 'hex' | 'json') => {
      const key = `asn_memory_${type}`;
      return JSON.parse(localStorage.getItem(key) || '[]');
  };

  const loadFromMemory = (type: 'hex' | 'json', name: string) => {
      const key = `asn_memory_${type}`;
      const saved = JSON.parse(localStorage.getItem(key) || '[]');
      const item = saved.find((item: any) => item.name === name);
      if (!item) return;
      
      if (type === 'hex') {
          if (hexInputType === 'raw') {
              setHexData(item.data);
              setFormattedHex(hexTo0xHex(item.data));
          } else {
              setFormattedHex(item.data);
              const hex = xHexToHex(item.data);
              if (hex) setHexData(hex);
          }
          setLastEdited('hex');
      } else {
          setJsonData(item.data);
          setLastEdited('json');
      }
  };

  // UI Effects
  useEffect(() => {
    // Reset definition tree visibility when type changes
    setDefinitionOpen(false);
  }, [selectedType]);

  const onCodegen = async () => {
      const success = await handleCodegen();
      if (success) setCodegenModalOpen(false);
  }

  const onSave = async () => {
      if (!saveFilename) return;
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
          <Group h="100%" px="md" justify="space-between">
            <Title order={3}>ASN.1 Processor</Title>
            <Group>
              <Button
                  variant="outline"
                  size="xs"
                  disabled={!selectedProtocol}
                  onClick={() => setSchemaEditorOpen(true)}
                  aria-label="Edit Schema"
              >
                  Edit Schema
              </Button>
              <Button 
                  variant="outline" 
                  size="xs" 
                  disabled={!selectedProtocol}
                  onClick={() => setCodegenModalOpen(true)}
                  aria-label="Generate C Stubs"
              >
                  Generate C Stubs
              </Button>
              <Button
                  variant={inspectorOpen ? "filled" : "outline"}
                  size="xs"
                  onClick={() => setInspectorOpen(!inspectorOpen)}
                  leftSection={<IconLayoutSidebarRight size="1rem" />}
                  aria-label="Toggle Inspector"
              >
                  Inspector
              </Button>
              <Button
                  variant="outline"
                  size="xs"
                  onClick={() => setSettingsOpen(true)}
                  leftSection={<IconSettings size="1rem" />}
                  aria-label="Settings"
              >
                  Settings
              </Button>
              <Button
                  variant="outline"
                  size="xs"
                  onClick={() => setMemoryModalOpen(true)}
                  leftSection={<IconDatabase size="1rem" />}
                  aria-label="Memory"
              >
                  Memory
              </Button>
            </Group>
          </Group>
          <Divider />
        </Stack>
      </AppShell.Header>

      <AppShell.Main>
        <Group mb="md" align="flex-end">
            <Select 
              label="Protocol" 
              placeholder="Select Protocol" 
              data={protocols} 
              value={selectedProtocol}
              onChange={handleProtocolChange}
              searchable
            />
            <Select
              label="Message" 
              placeholder="Select message" 
              data={demoTypeOptions}
              value={selectedDemoOption}
              onChange={handleDemoSelect}
              searchable
              disabled={!selectedProtocol && demoTypeOptions.length === 0}
              style={{ flex: 1 }}
            />
             <Button variant="light" onClick={loadExample} disabled={!selectedDemoOption} aria-label="Reload">
               Reload
             </Button>
        </Group>

        {definitionTree && (
            <Paper withBorder p="sm" mb="md">
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
                                <ActionIcon 
                                    size="sm" 
                                    variant="subtle" 
                                    onClick={() => setSaveHexModalOpen(true)}
                                    title="Save to Memory"
                                    disabled={!hexData && !formattedHex}
                                >
                                    <IconDeviceFloppy size="0.875rem" />
                                </ActionIcon>
                                <ActionIcon 
                                    size="sm" 
                                    variant="subtle" 
                                    onClick={() => setLoadHexModalOpen(true)}
                                    title="Load from Memory"
                                >
                                    <IconFolderOpen size="0.875rem" />
                                </ActionIcon>
                                {copiedHex && <Text size="xs" c="green" fw={500}>Copied!</Text>}
                                {savedHex && <Text size="xs" c="green" fw={500}>Saved!</Text>}
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
                              <ActionIcon 
                                  size="sm" 
                                  variant="subtle" 
                                  onClick={() => copyToClipboard(jsonData, 'json')}
                                  title="Copy to clipboard"
                                  color={copiedJson ? 'green' : undefined}
                              >
                                  <IconCopy size="0.875rem" />
                              </ActionIcon>
                              <ActionIcon 
                                  size="sm" 
                                  variant="subtle" 
                                  onClick={() => setSaveJsonModalOpen(true)}
                                  title="Save to Memory"
                                  disabled={!jsonData}
                              >
                                  <IconDeviceFloppy size="0.875rem" />
                              </ActionIcon>
                              <ActionIcon 
                                  size="sm" 
                                  variant="subtle" 
                                  onClick={() => setLoadJsonModalOpen(true)}
                                  title="Load from Memory"
                              >
                                  <IconFolderOpen size="0.875rem" />
                              </ActionIcon>
                              {copiedJson && <Text size="xs" c="green" fw={500}>Copied!</Text>}
                              {savedJson && <Text size="xs" c="green" fw={500}>Saved!</Text>}
                          </Group>
                          <SegmentedControl 
                              size="xs"
                              value={editorMode}
                              onChange={(v: any) => setEditorMode(v)}
                              data={[{ label: 'Structured', value: 'structured' }, { label: 'Raw', value: 'raw' }]}
                          />
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
                                        <ActionIcon 
                                            size="sm" 
                                            variant="subtle" 
                                            onClick={() => setSaveHexModalOpen(true)}
                                            title="Save to Memory"
                                            disabled={!hexData && !formattedHex}
                                        >
                                            <IconDeviceFloppy size="0.875rem" />
                                        </ActionIcon>
                                        <ActionIcon 
                                            size="sm" 
                                            variant="subtle" 
                                            onClick={() => setLoadHexModalOpen(true)}
                                            title="Load from Memory"
                                        >
                                            <IconFolderOpen size="0.875rem" />
                                        </ActionIcon>
                                        {copiedHex && <Text size="xs" c="green" fw={500}>Copied!</Text>}
                                {savedHex && <Text size="xs" c="green" fw={500}>Saved!</Text>}
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
                        <Paper withBorder p="md" style={{ flex: 1, minHeight: '400px' }}>
                            <Stack h="100%">
                                <Text fw={600}>Bit Inspector</Text>
                                <Box style={{ flex: 1, position: 'relative' }}>
                                    <ScrollArea h="100%">
                                        <BitInspectorPanel
                                            hexInput={hexData}
                                            traceRoot={traceData?.trace}
                                            totalBits={traceData?.total_bits}
                                            loading={traceLoading}
                                            error={traceError}
                                        />
                                    </ScrollArea>
                                </Box>
                            </Stack>
                        </Paper>
                    </Stack>
                </Grid.Col>
            )}
        </Grid>

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
            title="Save Message"
        >
            <Stack>
                <TextInput 
                    label="Filename" 
                    placeholder="my_message" 
                    value={saveFilename} 
                    onChange={(e) => setSaveFilename(e.currentTarget.value)}
                    data-autofocus
                    onKeyDown={(e) => { if(e.key === 'Enter') onSave(); }}
                />
                <Group justify="flex-end">
                    <Button variant="default" onClick={() => setSaveModalOpen(false)}>Cancel</Button>
                    <Button onClick={onSave}>Save</Button>
                </Group>
            </Stack>
        </Modal>

        <Modal 
            opened={saveHexModalOpen} 
            onClose={() => {
                setSaveHexModalOpen(false);
                setSaveHexFilename('');
            }} 
            title="Save Hex to Memory"
        >
            <Stack>
                <TextInput 
                    label="Name" 
                    placeholder="hex_data_1" 
                    value={saveHexFilename} 
                    onChange={(e) => setSaveHexFilename(e.currentTarget.value)}
                    data-autofocus
                    onKeyDown={(e) => { if(e.key === 'Enter') handleSaveHex(); }}
                />
                <Text size="xs" c="dimmed">
                    Enter a name for this hex data. If the name already exists, it will be overwritten.
                </Text>
                <Group justify="flex-end">
                    <Button variant="default" onClick={() => {
                        setSaveHexModalOpen(false);
                        setSaveHexFilename('');
                    }}>Cancel</Button>
                    <Button onClick={handleSaveHex} disabled={!saveHexFilename}>Save</Button>
                </Group>
            </Stack>
        </Modal>

        <Modal 
            opened={saveJsonModalOpen} 
            onClose={() => {
                setSaveJsonModalOpen(false);
                setSaveJsonFilename('');
            }} 
            title="Save JSON to Memory"
        >
            <Stack>
                <TextInput 
                    label="Name" 
                    placeholder="json_data_1" 
                    value={saveJsonFilename} 
                    onChange={(e) => setSaveJsonFilename(e.currentTarget.value)}
                    data-autofocus
                    onKeyDown={(e) => { if(e.key === 'Enter') handleSaveJson(); }}
                />
                <Text size="xs" c="dimmed">
                    Enter a name for this JSON data. If the name already exists, it will be overwritten.
                </Text>
                <Group justify="flex-end">
                    <Button variant="default" onClick={() => {
                        setSaveJsonModalOpen(false);
                        setSaveJsonFilename('');
                    }}>Cancel</Button>
                    <Button onClick={handleSaveJson} disabled={!saveJsonFilename}>Save</Button>
                </Group>
            </Stack>
        </Modal>

        <Modal 
            opened={loadHexModalOpen} 
            onClose={() => setLoadHexModalOpen(false)} 
            title="Load Hex from Memory"
        >
            <Stack>
                {getSavedItems('hex').length === 0 ? (
                    <Text c="dimmed">No saved hex data.</Text>
                ) : (
                    <ScrollArea h={300}>
                        <Stack gap="xs">
                            {getSavedItems('hex').map((item: any) => (
                                <Group key={item.name} justify="space-between" p="xs" bg="var(--mantine-color-body)" style={{ border: '1px solid var(--mantine-color-default-border)', cursor: 'pointer' }}
                                    onClick={() => {
                                        loadFromMemory('hex', item.name);
                                        setLoadHexModalOpen(false);
                                    }}
                                >
                                    <Stack gap={0}>
                                        <Text size="sm" fw={500}>{item.name}</Text>
                                        <Text size="xs" c="dimmed">{new Date(item.timestamp).toLocaleString()}</Text>
                                    </Stack>
                                    <ActionIcon color="red" variant="subtle" onClick={(e) => {
                                        e.stopPropagation();
                                        const key = 'asn_memory_hex';
                                        const saved = JSON.parse(localStorage.getItem(key) || '[]');
                                        const filtered = saved.filter((s: any) => s.name !== item.name);
                                        localStorage.setItem(key, JSON.stringify(filtered));
                                        setLoadHexModalOpen(false);
                                        setTimeout(() => setLoadHexModalOpen(true), 0);
                                    }}>
                                        <IconTrash size="1rem"/>
                                    </ActionIcon>
                                </Group>
                            ))}
                        </Stack>
                    </ScrollArea>
                )}
                <Group justify="flex-end" mt="md">
                    <Button onClick={() => setLoadHexModalOpen(false)}>Close</Button>
                </Group>
            </Stack>
        </Modal>

        <Modal 
            opened={loadJsonModalOpen} 
            onClose={() => setLoadJsonModalOpen(false)} 
            title="Load JSON from Memory"
        >
            <Stack>
                {getSavedItems('json').length === 0 ? (
                    <Text c="dimmed">No saved JSON data.</Text>
                ) : (
                    <ScrollArea h={300}>
                        <Stack gap="xs">
                            {getSavedItems('json').map((item: any) => (
                                <Group key={item.name} justify="space-between" p="xs" bg="var(--mantine-color-body)" style={{ border: '1px solid var(--mantine-color-default-border)', cursor: 'pointer' }}
                                    onClick={() => {
                                        loadFromMemory('json', item.name);
                                        setLoadJsonModalOpen(false);
                                    }}
                                >
                                    <Stack gap={0}>
                                        <Text size="sm" fw={500}>{item.name}</Text>
                                        <Text size="xs" c="dimmed">{new Date(item.timestamp).toLocaleString()}</Text>
                                    </Stack>
                                    <ActionIcon color="red" variant="subtle" onClick={(e) => {
                                        e.stopPropagation();
                                        const key = 'asn_memory_json';
                                        const saved = JSON.parse(localStorage.getItem(key) || '[]');
                                        const filtered = saved.filter((s: any) => s.name !== item.name);
                                        localStorage.setItem(key, JSON.stringify(filtered));
                                        setLoadJsonModalOpen(false);
                                        setTimeout(() => setLoadJsonModalOpen(true), 0);
                                    }}>
                                        <IconTrash size="1rem"/>
                                    </ActionIcon>
                                </Group>
                            ))}
                        </Stack>
                    </ScrollArea>
                )}
                <Group justify="flex-end" mt="md">
                    <Button onClick={() => setLoadJsonModalOpen(false)}>Close</Button>
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
                    <Text c="dimmed">No saved messages.</Text>
                ) : (
                    <ScrollArea h={300}>
                        <Stack gap="xs">
                            {savedMessages.map(msg => (
                                <Group key={msg} justify="space-between" p="xs" bg="var(--mantine-color-body)" style={{ border: '1px solid var(--mantine-color-default-border)' }}>
                                    <Text size="sm">{msg}</Text>
                                    <ActionIcon color="red" variant="subtle" onClick={() => handleDeleteMessage(msg)}>
                                        <IconTrash size="1rem"/>
                                    </ActionIcon>
                                </Group>
                            ))}
                        </Stack>
                    </ScrollArea>
                )}
                <Group justify="space-between" mt="md">
                    <Button color="red" variant="subtle" onClick={handleClearMessages}>Clear All Memory</Button>
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
      </AppShell.Main>
    </AppShell>
    </MantineProvider>
  )
}

export default App

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
  SegmentedControl
} from '@mantine/core'
import { IconSettings, IconLayoutSidebarRight } from '@tabler/icons-react'
import { BitInspectorPanel } from './components/trace/BitInspectorPanel'
import { DefinitionTree } from './components/definition/DefinitionTree'
import { SettingsModal } from './components/SettingsModal'
import { themes } from './theme'
import { StarTrekShip } from './components/StarTrekShip'
import { SchemaEditor } from './components/editor/SchemaEditor'
import { StructuredJsonEditor } from './components/editor/StructuredJsonEditor'
import { useAsnProcessor } from './hooks/useAsnProcessor'
import { base64ToHex, hexToBase64, safeParse } from './utils/conversion'

function App() {
  // Business Logic & State
  const {
      protocols, selectedProtocol, setSelectedProtocol,
      demoTypeOptions, selectedDemoOption, handleDemoSelect,
      selectedType,
      definitionTree,
      hexData, setHexData,
      jsonData, setJsonData,
      base64Data, setBase64Data,
      error,
      traceData, traceLoading, traceError,
      editorMode, setEditorMode,
      setLastEdited,
      loadExample,
      codegenLoading, codegenError, handleCodegen
  } = useAsnProcessor();

  // UI State
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [codegenModalOpen, setCodegenModalOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [schemaEditorOpen, setSchemaEditorOpen] = useState(false)
  const [definitionOpen, setDefinitionOpen] = useState(false)

  // Theme State
  const [currentThemeName, setCurrentThemeName] = useState<string>(() => {
      return localStorage.getItem('ui-theme') || 'Default';
  });

  const handleThemeChange = (name: string) => {
      setCurrentThemeName(name);
      localStorage.setItem('ui-theme', name);
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

  return (
    <MantineProvider theme={themes[currentThemeName]} forceColorScheme={currentThemeName.includes('Star Trek') ? 'dark' : undefined}>
    <AppShell
      header={{ height: 60 }}
      padding="md"
    >
      <AppShell.Header>
        {currentThemeName.includes('Star Trek') && <StarTrekShip />}
        <Group h="100%" px="md" justify="space-between" style={{ position: 'relative', zIndex: 1 }}>
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
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        <Group mb="md" align="flex-end">
            <Select 
              label="Protocol" 
              placeholder="Select Protocol" 
              data={protocols} 
              value={selectedProtocol}
              onChange={setSelectedProtocol}
              searchable
            />
            <Select
              label="Load Demo Message Type" 
              placeholder="Select demo message type" 
              data={demoTypeOptions}
              value={selectedDemoOption}
              onChange={handleDemoSelect}
              searchable
              disabled={!selectedProtocol}
            />
             <Button variant="light" onClick={loadExample} disabled={!selectedDemoOption} aria-label="Reload Example">
               Reload Example
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
                  <Paper withBorder p="md">
                    <Stack gap="md">
                      <Text fw={600}>Hex Input</Text>
                      <Textarea
                        placeholder="80 05 ..."
                        minRows={3}
                        maxRows={8}
                        autosize
                        value={hexData}
                        onChange={(e) => {
                            const val = e.currentTarget.value
                            setHexData(val)
                            setBase64Data(hexToBase64(val))
                            setLastEdited('hex')
                        }}
                        style={{ fontFamily: 'monospace' }}
                      />
                      
                      <Text fw={600}>Base64</Text>
                      <Textarea
                        placeholder="Base64 representation"
                        minRows={2}
                        maxRows={5}
                        autosize
                        value={base64Data}
                        onChange={(e) => {
                            const val = e.currentTarget.value
                            setBase64Data(val)
                            const hex = base64ToHex(val)
                            if (hex) {
                                setHexData(hex)
                                setLastEdited('hex') // Trigger hex decode logic
                            }
                        }}
                        style={{ fontFamily: 'monospace' }}
                      />
                    </Stack>
                  </Paper>
                  
                  <Paper withBorder p="md">
                    <Stack gap="md">
                      <Group justify="space-between">
                          <Text fw={600}>JSON Input</Text>
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
                          <Box style={{ minHeight: 300 }}>
                              <StructuredJsonEditor 
                                  data={safeParse(jsonData)} 
                                  schema={definitionTree}
                                  onChange={(newData) => {
                                       setJsonData(JSON.stringify(newData, null, 2));
                                       setLastEdited('json');
                                  }}
                              />
                          </Box>
                      )}
                    </Stack>
                  </Paper>
                </Stack>
            </Grid.Col>
            
            {inspectorOpen && (
                <Grid.Col span={6}>
                    <Paper withBorder p="md" h="100%" style={{ minHeight: '500px' }}>
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
                </Grid.Col>
            )}
        </Grid>

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
            opened={schemaEditorOpen} 
            onClose={() => setSchemaEditorOpen(false)} 
            title={`Schema Editor: ${selectedProtocol}`}
            fullScreen
            padding={0}
        >
             <Box h="calc(100vh - 60px)">
                 {selectedProtocol && <SchemaEditor protocol={selectedProtocol} />}
             </Box>
        </Modal>
      </AppShell.Main>
    </AppShell>
    </MantineProvider>
  )
}

export default App

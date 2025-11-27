import { useState, useEffect, useCallback } from 'react'
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
import { useDebouncedValue } from '@mantine/hooks'
import { IconSettings, IconLayoutSidebarRight } from '@tabler/icons-react'
import axios from 'axios'
import { BitInspectorPanel } from './components/trace/BitInspectorPanel'
import type { TraceResponsePayload } from './components/trace/types'
import { DefinitionTree } from './components/definition/DefinitionTree'
import type { DefinitionNode } from './components/definition/types'
import type { DemoEntry } from './data/demos'
import { demoPayloads, demoErrorPayloads } from './data/demos'
import { SettingsModal } from './components/SettingsModal'
import { themes } from './theme'
import { StarTrekShip } from './components/StarTrekShip'
import { SchemaEditor } from './components/editor/SchemaEditor'
import { StructuredJsonEditor } from './components/editor/StructuredJsonEditor'

const resolveApiBase = () => {
  if (import.meta.env.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE as string
  }
  if (import.meta.env.DEV) {
    return 'http://localhost:8010'
  }
  return undefined
}

const apiBase = resolveApiBase()
if (apiBase) {
  axios.defaults.baseURL = apiBase
}

type DemoOption = { value: string; label: string }

const formatErrorMessage = (err: any) => {
  const detail = err?.response?.data?.detail
  if (typeof detail === 'string') {
    return detail
  }
  if (Array.isArray(detail)) {
    return detail
      .map((entry) => {
        if (typeof entry === 'string') {
          return entry
        }
        if (entry && typeof entry === 'object') {
          const location = Array.isArray(entry.loc) ? entry.loc.join('.') : entry.loc
          return `${entry.type || 'Error'} at ${location}: ${entry.msg || entry.message || ''}`.trim()
        }
        return JSON.stringify(entry)
      })
      .join('\n')
    }
  if (detail && typeof detail === 'object') {
    return JSON.stringify(detail)
  }
  return err?.message || 'Unknown error'
}

// Conversion Helpers
const hexToBase64 = (hex: string) => {
  const clean = hex.replace(/[\s\n]/g, '').replace(/^0x/i, '')
  if (clean.length % 2 !== 0) return '' 
  try {
    const bytes = new Uint8Array(clean.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || [])
    let binary = ''
    bytes.forEach(b => binary += String.fromCharCode(b))
    return window.btoa(binary)
  } catch (e) {
    return ''
  }
}

const base64ToHex = (base64: string) => {
  try {
    const binary = window.atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
  } catch (e) {
    return ''
  }
}

const safeParse = (json: string) => {
    try {
        return json ? JSON.parse(json) : undefined;
    } catch {
        return undefined;
    }
}

function App() {
  const [protocols, setProtocols] = useState<string[]>([])
  const [selectedProtocol, setSelectedProtocol] = useState<string | null>(null)
  const [demoTypeOptions, setDemoTypeOptions] = useState<DemoOption[]>([])
  const [selectedDemoOption, setSelectedDemoOption] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [dynamicExamples, setDynamicExamples] = useState<Record<string, any>>({})
  
  // Decode State
  const [hexData, setHexData] = useState('')
  const [base64Data, setBase64Data] = useState('')
  const [debouncedHex] = useDebouncedValue(hexData, 500)
  
  // Encode State
  const [jsonData, setJsonData] = useState('')
  const [debouncedJson] = useDebouncedValue(jsonData, 500)

  // Tracking user input source to prevent loops
  // 'hex' implies source was Hex OR Base64 input (which converts to hex)
  const [lastEdited, setLastEdited] = useState<'hex' | 'json' | null>(null)
  const [editorMode, setEditorMode] = useState<'raw' | 'structured'>('structured')

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [traceData, setTraceData] = useState<TraceResponsePayload | null>(null)
  const [traceLoading, setTraceLoading] = useState(false)
  const [traceError, setTraceError] = useState<string | null>(null)
  const [definitionTree, setDefinitionTree] = useState<DefinitionNode | null>(null)
  const [definitionOpen, setDefinitionOpen] = useState(false)

  // Layout State
  const [inspectorOpen, setInspectorOpen] = useState(true)

  // Codegen State
  const [codegenModalOpen, setCodegenModalOpen] = useState(false)
  const [codegenLoading, setCodegenLoading] = useState(false)
  const [codegenError, setCodegenError] = useState<string | null>(null)

  // Settings State
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [schemaEditorOpen, setSchemaEditorOpen] = useState(false)

  // Theme State
  const [currentThemeName, setCurrentThemeName] = useState<string>(() => {
      return localStorage.getItem('ui-theme') || 'Default';
  });

  const handleThemeChange = (name: string) => {
      setCurrentThemeName(name);
      localStorage.setItem('ui-theme', name);
  };

  useEffect(() => {
    axios.get('/api/asn/protocols')
      .then(res => setProtocols(res.data))
      .catch(err => console.error(err))
  }, [])

  useEffect(() => {
    if (!selectedProtocol) {
      setDemoTypeOptions([])
      setSelectedDemoOption(null)
      setSelectedType(null)
      setDynamicExamples({})
      return
    }

    Promise.all([
      axios.get(`/api/asn/protocols/${selectedProtocol}/types`),
      axios.get(`/api/asn/protocols/${selectedProtocol}/examples`).catch(() => ({ data: {} }))
    ])
      .then(([typesRes, examplesRes]) => {
        const protocolName = selectedProtocol
        const fetchedExamples = examplesRes.data || {}
        setDynamicExamples(fetchedExamples)

        const options: DemoOption[] = []
        typesRes.data.forEach((typeName: string) => {
          const validExample = demoPayloads[protocolName]?.[typeName]
          if (validExample) {
            options.push({
              value: `${typeName}::valid`,
              label: `${typeName} (Valid Demo)`,
            })
          }
          
          if (fetchedExamples[typeName]) {
             options.push({
                 value: `${typeName}::dynamic`,
                 label: `${typeName} (Custom Example)`
             })
          }

          const errorCases = demoErrorPayloads[protocolName]?.[typeName] ?? []
          errorCases.forEach((_, idx) => {
            options.push({
              value: `${typeName}::error::${idx}`,
              label: `${typeName} (Error Demo #${idx + 1})`,
            })
          })
        })
        
        if (options.length === 0) {
             typesRes.data.forEach((typeName: string) => {
                 options.push({ value: typeName, label: typeName })
             })
        }
        
        setDemoTypeOptions(options)
        setSelectedDemoOption(null)
        setSelectedType(null)
      })
      .catch((err) => console.error(err))
  }, [selectedProtocol])

  useEffect(() => {
    if (selectedProtocol && selectedType) {
        axios.get(`/api/asn/protocols/${selectedProtocol}/types/${selectedType}`)
            .then(res => {
              setDefinitionTree(res.data.tree)
              setDefinitionOpen(false)
            })
            .catch(err => {
              console.error(err)
              setDefinitionTree(null)
            })
    } else {
        setDefinitionTree(null)
    }
  }, [selectedProtocol, selectedType])

  useEffect(() => {
    setTraceData(null)
    setTraceError(null)
  }, [selectedProtocol, selectedType])

  useEffect(() => {
    if (!definitionTree) {
      setDefinitionOpen(false)
    }
  }, [definitionTree])

  const fetchTrace = useCallback(async (protocol: string, typeName: string, payloadHex: string) => {
    if (!payloadHex.trim()) {
      setTraceData(null)
      return
    }
    setTraceLoading(true)
    setTraceError(null)
    try {
      const response = await axios.post<TraceResponsePayload>('/api/asn/trace', {
        hex_data: payloadHex,
        protocol,
        type_name: typeName,
        encoding_rule: 'per',
      })
      if (response.data.status === 'failure') {
        setTraceError(response.data.diagnostics || response.data.error || 'Trace failed')
        setTraceData(null)
      } else {
        setTraceData(response.data)
      }
    } catch (err: any) {
      setTraceError(err.response?.data?.detail || err.message)
      setTraceData(null)
    } finally {
      setTraceLoading(false)
    }
  }, [])

  const handleDecode = useCallback(async (hexOverride?: string) => {
    if (!selectedProtocol) return
    const currentHex = hexOverride ?? hexData
    if (!currentHex.trim()) return

    setLoading(true)
    try {
      const res = await axios.post('/api/asn/decode', {
        hex_data: currentHex,
        protocol: selectedProtocol,
        type_name: selectedType || undefined,
        encoding_rule: 'per'
      })

      if (res.data.status === 'failure') {
        setError(res.data.diagnostics || res.data.error)
        return
      }

      setError(null)
      const formattedJson = JSON.stringify(res.data.data ?? res.data, null, 2)
      setJsonData(formattedJson)
      
      const resolvedType = selectedType || res.data.decoded_type
      if (resolvedType) {
        await fetchTrace(selectedProtocol, resolvedType, currentHex)
      } else {
        setTraceError("Bit tracing requires a message type.")
      }
    } catch (err: any) {
      setError(formatErrorMessage(err))
    } finally {
        setLoading(false)
    }
  }, [hexData, selectedProtocol, selectedType, fetchTrace])

  const handleEncode = useCallback(async (jsonOverride?: string) => {
    if (!selectedProtocol || !selectedType) return
    const currentJson = jsonOverride ?? jsonData
    if (!currentJson.trim()) return

    setLoading(true)
    try {
      let parsedJson;
      try {
        parsedJson = JSON.parse(currentJson)
      } catch (e) {
        setError("Invalid JSON format")
        setLoading(false)
        return
      }

      const res = await axios.post('/api/asn/encode', {
        data: parsedJson,
        protocol: selectedProtocol,
        type_name: selectedType,
        encoding_rule: 'per'
      })

      if (res.data.status === 'failure') {
        setError(res.data.diagnostics || res.data.error)
        return
      }

      setError(null)
      const newHex = res.data.hex_data
      setHexData(newHex)
      setBase64Data(hexToBase64(newHex)) // Sync Base64
      
      await fetchTrace(selectedProtocol, selectedType, newHex)
    } catch (err: any) {
      setError(formatErrorMessage(err))
    } finally {
        setLoading(false)
    }
  }, [jsonData, selectedProtocol, selectedType, fetchTrace])

  // Auto-conversion effects
  useEffect(() => {
      if (lastEdited === 'hex' && debouncedHex) {
          handleDecode(debouncedHex)
      }
  }, [debouncedHex, lastEdited, handleDecode])

  useEffect(() => {
      if (lastEdited === 'json' && debouncedJson) {
          handleEncode(debouncedJson)
      }
  }, [debouncedJson, lastEdited, handleEncode])


  const loadExample = () => {
      setError(null)
      if (!selectedProtocol || !selectedType || !selectedDemoOption) {
        setError("Select a protocol and demo message type first")
        return
      }
      const parts = selectedDemoOption.split('::')
      if (parts.length === 1) {
          setError("This is just a type definition, no demo data available.")
          return
      }
      
      const [typeName, variant, errorIndex] = parts
      let example: DemoEntry | undefined
      if (variant === 'error') {
        const idx = Number(errorIndex ?? 0)
        example = demoErrorPayloads[selectedProtocol]?.[selectedType]?.[idx]
      } else if (variant === 'dynamic') {
        example = dynamicExamples[typeName]
      } else {
        example = demoPayloads[selectedProtocol]?.[selectedType]
      }
      if (!example) {
        setError("No demo example available for this type")
        return
      }
      if (variant === 'error' && typeof example !== 'object') {
        setError("Error demos must be structured objects for JSON conversion")
        return
      }
      
      const jsonString = JSON.stringify(example, null, 2)
      setJsonData(jsonString)
      setLastEdited('json') 
  }

  const handleDemoSelect = (value: string | null) => {
    setSelectedDemoOption(value)
    if (!value) {
      setSelectedType(null)
      setJsonData('')
      return
    }
    const parts = value.split('::')
    const typeName = parts[0]
    setSelectedType(typeName)

    // Auto-load example data
    if (selectedProtocol && parts.length > 1) {
        const [, variant, errorIndex] = parts
        let example: DemoEntry | undefined
        if (variant === 'error') {
            const idx = Number(errorIndex ?? 0)
            example = demoErrorPayloads[selectedProtocol]?.[typeName]?.[idx]
        } else if (variant === 'dynamic') {
            example = dynamicExamples[typeName]
        } else {
            example = demoPayloads[selectedProtocol]?.[typeName]
        }

        if (example) {
            const jsonString = JSON.stringify(example, null, 2)
            setJsonData(jsonString)
            setLastEdited('json') 
            setError(null)
        }
    } else {
        setJsonData('')
    }
  }

  const handleCodegen = async () => {
      if (!selectedProtocol) return;
      setCodegenLoading(true)
      setCodegenError(null)
      try {
          const res = await axios.post('/api/asn/codegen', {
              protocol: selectedProtocol,
              types: selectedType ? [selectedType] : [],
              options: { 'compound-names': true }
          }, {
              responseType: 'blob'
          })

          const url = window.URL.createObjectURL(new Blob([res.data]));
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', `${selectedProtocol}_c_stubs.zip`);
          document.body.appendChild(link);
          link.click();
          link.remove();
          setCodegenModalOpen(false)

      } catch (err: any) {
          if (err.response?.data instanceof Blob) {
               const text = await err.response.data.text()
               try {
                   const json = JSON.parse(text)
                   setCodegenError(json.detail || 'Generation failed')
               } catch {
                   setCodegenError(text)
               }
          } else {
              setCodegenError(formatErrorMessage(err))
          }
      } finally {
          setCodegenLoading(false)
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
        <Group h="100%" px="md" justify="space-between" style={{ position: 'relative', zIndex: 1 }}>
          <Title order={3}>ASN.1 Processor</Title>
          <Group>
            <Button
                variant="outline"
                size="xs"
                disabled={!selectedProtocol}
                onClick={() => setSchemaEditorOpen(true)}
            >
                Edit Schema
            </Button>
            <Button 
                variant="outline" 
                size="xs" 
                disabled={!selectedProtocol}
                onClick={() => setCodegenModalOpen(true)}
            >
                Generate C Stubs
            </Button>
            <Button
                variant={inspectorOpen ? "filled" : "outline"}
                size="xs"
                onClick={() => setInspectorOpen(!inspectorOpen)}
                leftSection={<IconLayoutSidebarRight size="1rem" />}
            >
                Inspector
            </Button>
            <Button
                variant="outline"
                size="xs"
                onClick={() => setSettingsOpen(true)}
                leftSection={<IconSettings size="1rem" />}
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
             <Button variant="light" onClick={loadExample} disabled={!selectedDemoOption}>
               Reload Example
             </Button>
        </Group>

        {definitionTree && (
            <Paper withBorder p="sm" mb="md">
              <Group justify="space-between" align="center" mb="xs">
                <Text size="sm" fw={500}>Definition Tree</Text>
                <Button size="xs" variant="subtle" onClick={() => setDefinitionOpen((prev) => !prev)}>
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
                  
                  <Group justify="center" hidden>
                    <Button onClick={() => handleDecode()} disabled={!selectedProtocol || loading} loading={loading}>
                      Hex → JSON
                    </Button>
                    <Button onClick={() => handleEncode()} disabled={!selectedProtocol || !selectedType || loading} loading={loading}>
                      JSON → Hex
                    </Button>
                  </Group>

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
                    <Button onClick={handleCodegen} loading={codegenLoading}>Generate & Download</Button>
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

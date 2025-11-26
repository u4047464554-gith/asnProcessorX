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
} from '@mantine/core'
import axios from 'axios'
import { BitInspectorPanel } from './components/trace/BitInspectorPanel'
import type { TraceResponsePayload } from './components/trace/types'
import { DefinitionTree } from './components/definition/DefinitionTree'
import type { DefinitionNode } from './components/definition/types'
import type { DemoEntry } from './data/demos'
import { demoPayloads, demoErrorPayloads } from './data/demos'

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

function App() {
  const [protocols, setProtocols] = useState<string[]>([])
  const [selectedProtocol, setSelectedProtocol] = useState<string | null>(null)
  const [demoTypeOptions, setDemoTypeOptions] = useState<DemoOption[]>([])
  const [selectedDemoOption, setSelectedDemoOption] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<string | null>(null)
  
  // Decode State
  const [hexData, setHexData] = useState('')
  
  // Encode State
  const [jsonData, setJsonData] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [traceData, setTraceData] = useState<TraceResponsePayload | null>(null)
  const [traceLoading, setTraceLoading] = useState(false)
  const [traceError, setTraceError] = useState<string | null>(null)
  const [definitionTree, setDefinitionTree] = useState<DefinitionNode | null>(null)
  const [definitionOpen, setDefinitionOpen] = useState(false)

  // Codegen State
  const [codegenModalOpen, setCodegenModalOpen] = useState(false)
  const [codegenLoading, setCodegenLoading] = useState(false)
  const [codegenError, setCodegenError] = useState<string | null>(null)

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
      return
    }

    axios
      .get(`/api/asn/protocols/${selectedProtocol}/types`)
      .then((res) => {
        const protocolName = selectedProtocol
        const options: DemoOption[] = []
        res.data.forEach((typeName: string) => {
          const validExample = demoPayloads[protocolName]?.[typeName]
          if (validExample) {
            options.push({
              value: `${typeName}::valid`,
              label: `${typeName} (Valid Demo)`,
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

  const fetchTrace = async (protocol: string, typeName: string, payloadHex: string) => {
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
      setTraceData(response.data)
    } catch (err: any) {
      setTraceError(err.response?.data?.detail || err.message)
      setTraceData(null)
    } finally {
      setTraceLoading(false)
    }
  }

  const handleDecode = async () => {
    if (!selectedProtocol) return
    setError(null)
    setTraceData(null)
    setTraceError(null)
    setLoading(true)
    try {
      const res = await axios.post('/api/asn/decode', {
        hex_data: hexData,
        protocol: selectedProtocol,
        type_name: selectedType || undefined, // Optional
        encoding_rule: 'per'
      })
      const formattedJson = JSON.stringify(res.data.data ?? res.data, null, 2)
      setJsonData(formattedJson)
      const resolvedType = selectedType || res.data.decoded_type
      if (resolvedType) {
        await fetchTrace(selectedProtocol, resolvedType, hexData)
      } else {
        setTraceError("Bit tracing requires a message type.")
      }
    } catch (err: any) {
      setError(formatErrorMessage(err))
    } finally {
        setLoading(false)
    }
  }

  const handleEncode = async () => {
    if (!selectedProtocol || !selectedType) {
        setError("Please select Protocol and Type Name")
        return
    }
    setError(null)
    setLoading(true)
    try {
      let parsedJson;
      try {
        parsedJson = JSON.parse(jsonData)
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
      const newHex = res.data.hex_data
      setHexData(newHex)
      await fetchTrace(selectedProtocol, selectedType, newHex)
    } catch (err: any) {
      setError(formatErrorMessage(err))
    } finally {
        setLoading(false)
    }
  }

  const loadExample = () => {
      setError(null)
      if (!selectedProtocol || !selectedType || !selectedDemoOption) {
        setError("Select a protocol and demo message type first")
        return
      }
      const [, variant, errorIndex] = selectedDemoOption.split('::')
      let example: DemoEntry | undefined
      if (variant === 'error') {
        const idx = Number(errorIndex ?? 0)
        example = demoErrorPayloads[selectedProtocol]?.[selectedType]?.[idx]
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
      if (variant === 'error') {
        setJsonData(JSON.stringify(example, null, 2))
      } else {
        setJsonData(JSON.stringify(example, null, 2))
      }
  }

  const handleDemoSelect = (value: string | null) => {
    setSelectedDemoOption(value)
    if (!value) {
      setSelectedType(null)
      setJsonData('')
      return
    }
    const [typeName] = value.split('::')
    setSelectedType(typeName)
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

          // Create download link
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
               // Parse blob error
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
    <AppShell
      header={{ height: 60 }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Title order={3}>ASN.1 Processor</Title>
          <Button 
            variant="outline" 
            size="xs" 
            disabled={!selectedProtocol}
            onClick={() => setCodegenModalOpen(true)}
          >
            Generate C Stubs
          </Button>
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
               Load Example
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

        <Stack gap="xl">
          <Paper withBorder p="md">
            <Stack gap="md">
              <Text fw={600}>Hex ↔ JSON</Text>
              <Textarea
                label="Hex"
                placeholder="80 05 ..."
                minRows={10}
                value={hexData}
                onChange={(e) => setHexData(e.currentTarget.value)}
                style={{ fontFamily: 'monospace' }}
              />
              <Group justify="center">
                <Button onClick={handleDecode} disabled={!selectedProtocol || loading} loading={loading}>
                  Hex → JSON
                </Button>
                <Button
                  onClick={handleEncode}
                  disabled={!selectedProtocol || !selectedType || loading}
                  loading={loading}
                  variant="light"
                >
                  JSON → Hex
                </Button>
              </Group>
              <JsonInput
                label="JSON Input"
                placeholder="{ ... }"
                validationError="Invalid JSON"
                formatOnBlur
                autosize
                minRows={10}
                value={jsonData}
                onChange={setJsonData}
              />
              <BitInspectorPanel
                hexInput={hexData}
                traceRoot={traceData?.trace}
                totalBits={traceData?.total_bits}
                loading={traceLoading}
                error={traceError}
              />
            </Stack>
          </Paper>
        </Stack>

        <Modal 
            opened={codegenModalOpen} 
            onClose={() => setCodegenModalOpen(false)} 
            title={`Generate C Stubs for ${selectedProtocol}`}
        >
            <Stack>
                <Text size="sm">
                    This will generate C encoder/decoder stubs (PER) for <b>{selectedProtocol}</b> using <code>asn1c</code>.
                </Text>
                <Text size="xs" c="dimmed">
                    Note: This uses the vendored asn1c compiler. Ensure your target platform is compatible with the generated C code.
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
      </AppShell.Main>
    </AppShell>
  )
}

export default App

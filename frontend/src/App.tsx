import { useState, useEffect } from 'react'
import {
  AppShell,
  Group,
  Select,
  Textarea,
  Title,
  Button,
  Stack,
  Code,
  ScrollArea,
  Text,
  Tabs,
  JsonInput,
} from '@mantine/core'
import axios from 'axios'
import { BitInspectorPanel } from './components/trace/BitInspectorPanel'
import type { TraceResponsePayload } from './components/trace/types'

const apiBase = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'
axios.defaults.baseURL = apiBase;

function App() {
  const [protocols, setProtocols] = useState<string[]>([])
  const [selectedProtocol, setSelectedProtocol] = useState<string | null>(null)
  const [types, setTypes] = useState<string[]>([])
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [typeDefinition, setTypeDefinition] = useState<string | null>(null)
  
  // Decode State
  const [hexData, setHexData] = useState('')
  const [decodedData, setDecodedData] = useState<any>(null)
  
  // Encode State
  const [jsonData, setJsonData] = useState('')
  const [encodedHex, setEncodedHex] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [traceData, setTraceData] = useState<TraceResponsePayload | null>(null)
  const [traceLoading, setTraceLoading] = useState(false)
  const [traceError, setTraceError] = useState<string | null>(null)

  useEffect(() => {
    axios.get('/api/asn/protocols')
      .then(res => setProtocols(res.data))
      .catch(err => console.error(err))
  }, [])

  useEffect(() => {
    if (selectedProtocol) {
      axios.get(`/api/asn/protocols/${selectedProtocol}/types`)
        .then(res => {
            setTypes(res.data)
            setSelectedType(null) 
            setTypeDefinition(null)
        })
        .catch(err => console.error(err))
    } else {
      setTypes([])
      setSelectedType(null)
      setTypeDefinition(null)
    }
  }, [selectedProtocol])

  useEffect(() => {
    if (selectedProtocol && selectedType) {
        // Fetch definition
        axios.get(`/api/asn/protocols/${selectedProtocol}/types/${selectedType}`)
            .then(res => setTypeDefinition(res.data.definition))
            .catch(err => console.error(err))
    } else {
        setTypeDefinition(null)
    }
  }, [selectedProtocol, selectedType])

  useEffect(() => {
    setTraceData(null)
    setTraceError(null)
  }, [selectedProtocol, selectedType])

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
    setDecodedData(null)
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
      setDecodedData(res.data)
      const resolvedType = selectedType || res.data.decoded_type
      if (resolvedType) {
        await fetchTrace(selectedProtocol, resolvedType, hexData)
      } else {
        setTraceError("Bit tracing requires a message type.")
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message)
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
    setEncodedHex(null)
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
      setEncodedHex(res.data.hex_data)
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message)
    } finally {
        setLoading(false)
    }
  }

  const loadExample = () => {
      // Hardcoded examples for demo purposes
      if (selectedProtocol === 'simple_demo' && selectedType === 'Person') {
          setJsonData(JSON.stringify({
              name: "Alice",
              age: 30,
              isAlive: true
          }, null, 2))
      } else if (selectedProtocol === 'rrc_demo' && selectedType === 'RRCConnectionRequest') {
          setJsonData(JSON.stringify({
            "ue-Identity": {
                "$choice": "randomValue",
                "value": ["0x0123456789", 40] 
            },
            "establishmentCause": "mo-Signalling",
            "spare": ["0x80", 1]
          }, null, 2))
      } else {
          setError("No example available for this type")
      }
  }

  return (
    <AppShell
      header={{ height: 60 }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md">
          <Title order={3}>ASN.1 Processor</Title>
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
              label="Message Type" 
              placeholder="Select Type" 
              data={types} 
              value={selectedType}
              onChange={setSelectedType}
              searchable
              disabled={!selectedProtocol}
            />
             <Button variant="light" onClick={loadExample} disabled={!selectedType}>Load Example</Button>
        </Group>

        {/* Type Definition Preview */}
        {typeDefinition && (
            <Stack gap="xs" mb="md">
                <Text size="sm" fw={500}>Definition:</Text>
                <Code block style={{ maxHeight: 150, overflow: 'auto' }}>
                    {typeDefinition}
                </Code>
            </Stack>
        )}

        {error && (
             <Text c="red" mb="sm" style={{ whiteSpace: 'pre-wrap' }}>{error}</Text>
        )}

        <Tabs defaultValue="decode">
          <Tabs.List>
            <Tabs.Tab value="decode">Decode (Hex &rarr; JSON)</Tabs.Tab>
            <Tabs.Tab value="encode">Encode (JSON &rarr; Hex)</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="decode" pt="xs">
            <Group align="flex-start" grow>
              {/* Left Pane: Input + Bit Inspector */}
              <Stack style={{ flex: 1 }}>
                <Textarea 
                  label="Hex Input" 
                  placeholder="80 05 ..." 
                  minRows={15}
                  value={hexData}
                  onChange={(e) => setHexData(e.currentTarget.value)}
                  style={{ fontFamily: 'monospace' }}
                />
                <Button onClick={handleDecode} disabled={!selectedProtocol || loading} loading={loading}>Decode</Button>
                <BitInspectorPanel
                  hexInput={hexData}
                  traceRoot={traceData?.trace}
                  totalBits={traceData?.total_bits}
                  loading={traceLoading}
                  error={traceError}
                />
              </Stack>

              {/* Right Pane: Output */}
              <Stack style={{ flex: 1 }}>
                <Text fw={500}>Decoded Output</Text>
                <ScrollArea h={400} type="always" bg="gray.1" p="sm" style={{ borderRadius: 8 }}>
                   {decodedData ? (
                     <Code block>{JSON.stringify(decodedData, null, 2)}</Code>
                   ) : (
                     <Text c="dimmed" size="sm">No data decoded yet.</Text>
                   )}
                </ScrollArea>
              </Stack>
            </Group>
          </Tabs.Panel>

          <Tabs.Panel value="encode" pt="xs">
            <Group align="flex-start" grow>
              {/* Left Pane: Input */}
              <Stack>
                <JsonInput
                  label="JSON Input"
                  placeholder="{ ... }"
                  validationError="Invalid JSON"
                  formatOnBlur
                  autosize
                  minRows={15}
                  value={jsonData}
                  onChange={setJsonData}
                />
                <Button onClick={handleEncode} disabled={!selectedProtocol || !selectedType || loading} loading={loading}>Encode</Button>
              </Stack>

              {/* Right Pane: Output */}
              <Stack>
                <Text fw={500}>Encoded Hex</Text>
                <ScrollArea h={400} type="always" bg="gray.1" p="sm" style={{ borderRadius: 8 }}>
                   {encodedHex ? (
                     <Code block style={{ wordBreak: 'break-all' }}>{encodedHex}</Code>
                   ) : (
                     <Text c="dimmed" size="sm">No hex generated yet.</Text>
                   )}
                </ScrollArea>
              </Stack>
            </Group>
          </Tabs.Panel>
        </Tabs>
      </AppShell.Main>
    </AppShell>
  )
}

export default App

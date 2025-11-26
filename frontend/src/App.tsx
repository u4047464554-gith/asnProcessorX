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
  Paper,
} from '@mantine/core'
import axios from 'axios'
import { BitInspectorPanel } from './components/trace/BitInspectorPanel'
import type { TraceResponsePayload } from './components/trace/types'

const inferDevApiBase = () => {
  if (typeof window === 'undefined') {
    return undefined
  }
  const devPorts = new Set(['5173', '5174', '5175', '5176', '5177', '5178', '5179'])
  return devPorts.has(window.location.port) ? 'http://localhost:8010' : undefined
}

const apiBase = import.meta.env.VITE_API_BASE ?? inferDevApiBase() ?? ''
if (apiBase) {
  axios.defaults.baseURL = apiBase
}

type DemoEntry = unknown
type DemoMap = Record<string, Record<string, DemoEntry>>

const demoPayloads: DemoMap = {
  simple_demo: {
    Person: {
      name: 'Alice',
      age: 30,
      isAlive: true,
    },
    Direction: {
      '$choice': 'uplink',
      value: {
        name: 'Bob',
        age: 25,
        isAlive: true,
      },
    },
    MyMessage: {
      id: 7,
      value: 'Hello World',
    },
    StatusCode: 42,
  },
  rrc_demo: {
    RRCConnectionRequest: {
      'ue-Identity': {
        '$choice': 'randomValue',
        value: ['0x0123456789', 40],
      },
      establishmentCause: 'mo-Signalling',
      spare: ['0x80', 1],
    },
    'InitialUE-Identity': {
      '$choice': 'randomValue',
      value: ['0x1122334455', 40],
    },
    'S-TMSI': {
      mmec: ['0xAA', 8],
      'm-TMSI': ['0x01020304', 32],
    },
    EstablishmentCause: 'mo-Signalling',
  },
  multi_file_demo: {
    SessionStart: {
      subscriber: {
        mcc: 246,
        mnc: 1,
        msin: '0x48454c4c4f',
      },
      requested: 'serviceRequest',
      payload: '0x4578616d706c652073657373696f6e207061796c6f6164',
    },
    SubscriberId: {
      mcc: 310,
      mnc: 260,
      msin: '0x0102030405',
    },
    MessageId: 'attachRequest',
  },
}

const demoErrorPayloads: Record<string, Record<string, DemoEntry[]>> = {
  simple_demo: {
    Person: [
      { name: '', age: 999, isAlive: true },
      { name: 'A', age: -5, isAlive: true },
      { name: 'Bob', age: 25, isAlive: true, secret: '0x001122' },
    ],
    Direction: [
      { '$choice': 'invalidChoice', value: {} },
      { '$choice': 'uplink', value: { name: '', age: 20 } },
    ],
    MyMessage: [
      { id: -1, value: 12345 },
    ],
    StatusCode: [
      999,
      -3,
    ],
  },
  rrc_demo: {
    RRCConnectionRequest: [
      {
        'ue-Identity': {
          '$choice': 'randomValue',
          value: ['0x01', 4],
        },
        establishmentCause: 'invalidCause',
        spare: ['0x00', 0],
      },
      {
        'ue-Identity': {
          '$choice': 's-TMSI',
          value: { mmec: ['0xAA', 4], 'm-TMSI': ['0x01', 8] },
        },
        establishmentCause: 'mo-VoiceCall',
        spare: ['0x00', 1],
      },
    ],
    'InitialUE-Identity': [
      {
        '$choice': 'randomValue',
        value: ['0x01', 8],
      },
      {
        '$choice': 's-TMSI',
        value: { mmec: ['0x01', 8] },
      },
    ],
    'S-TMSI': [
      {
        mmec: ['0xFF', 4],
        'm-TMSI': ['0x0102', 16],
      },
    ],
    EstablishmentCause: [
      'not-a-cause',
    ],
  },
  multi_file_demo: {
    SessionStart: [
      {
        subscriber: {
          mcc: 90,
          mnc: 9999,
          msin: '0x01',
        },
        requested: 'invalidRequest',
        payload: '',
      },
      {
        subscriber: {
          mcc: 246,
          mnc: 1,
          msin: '0x48454c4c4f',
        },
        requested: 'serviceRequest',
        payload: '0x00',
      },
    ],
    SubscriberId: [
      {
        mcc: 50,
        mnc: -1,
        msin: '0x01',
      },
    ],
    MessageId: [
      'notAnId',
    ],
  },
}

type DemoOption = { value: string; label: string }

function App() {
  const [protocols, setProtocols] = useState<string[]>([])
  const [selectedProtocol, setSelectedProtocol] = useState<string | null>(null)
  const [demoTypeOptions, setDemoTypeOptions] = useState<DemoOption[]>([])
  const [selectedDemoOption, setSelectedDemoOption] = useState<string | null>(null)
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
    if (!selectedProtocol) {
      setDemoTypeOptions([])
      setSelectedDemoOption(null)
      setSelectedType(null)
      setTypeDefinition(null)
      return
    }

    axios
      .get(`/api/asn/protocols/${selectedProtocol}/types`)
      .then((res) => {
        const protocolName = selectedProtocol
        const options: DemoOption[] = []
        res.data.forEach((typeName: string) => {
          options.push({
            value: `${typeName}::valid`,
            label: `${typeName} (Valid Demo)`,
          })
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
        setTypeDefinition(null)
      })
      .catch((err) => console.error(err))
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
      setJsonData(JSON.stringify(example, null, 2))
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
              label="Load Demo Message Type" 
              placeholder="Select demo message type" 
              data={demoTypeOptions}
              value={selectedDemoOption}
              onChange={handleDemoSelect}
              searchable
              disabled={!selectedProtocol}
            />
             <Button variant="light" onClick={loadExample} disabled={!selectedType}>
               Load Example
             </Button>
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
             <Paper withBorder p="sm" mb="sm" bg="red.0">
               <Text size="sm" c="red.7" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                 {error}
               </Text>
             </Paper>
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

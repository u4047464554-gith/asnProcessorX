import { useEffect, useMemo, useState } from 'react'
import { Box, Group, Loader, Paper, Stack, Text, Title } from '@mantine/core'
import { TreeViewer } from './TreeViewer'
import { HexViewer } from './HexViewer'
import type { BitRange, TraceNode } from './types'

interface BitInspectorPanelProps {
  hexInput: string
  traceRoot?: TraceNode | null
  totalBits?: number
  loading?: boolean
  error?: string | null
}

export const BitInspectorPanel = ({
  hexInput,
  traceRoot,
  totalBits,
  loading = false,
  error = null,
}: BitInspectorPanelProps) => {
  const [selectedRange, setSelectedRange] = useState<BitRange | null>(null)

  useEffect(() => {
    setSelectedRange(null)
  }, [hexInput, traceRoot])

  const infoText = useMemo(() => {
    if (!traceRoot && !loading) {
      return 'Trace data unavailable. Ensure a type is selected before decoding.'
    }
    return null
  }, [traceRoot, loading])

  if (!hexInput.trim()) {
    return null
  }

  return (
    <Stack gap="sm" mt="lg" data-testid="bit-inspector">
      <Group justify="space-between" align="center">
        <Title order={5}>Bit Inspector</Title>
        {totalBits !== undefined && (
          <Text size="sm" c="dimmed">
            Consumed bits: {totalBits}
          </Text>
        )}
        {loading && <Loader size="sm" />}
      </Group>

      {error && (
        <Text c="red" size="sm" data-testid="bit-inspector-error">
          {error}
        </Text>
      )}

      {traceRoot ? (
        <Group align="stretch" gap="md" grow wrap="wrap">
          <Paper
            withBorder
            p="sm"
            style={{ flex: '3 1 520px', minWidth: 360, maxWidth: '100%' }}
          >
            <Text fw={500} size="sm" mb="xs">
              Field Map
            </Text>
            <TreeViewer
              root={traceRoot}
              onSelect={(range) => setSelectedRange(range)}
              selectedRange={selectedRange}
            />
          </Paper>
          <Paper
            withBorder
            p="sm"
            style={{ flex: '2 1 360px', minWidth: 300, maxWidth: '100%' }}
          >
            <Text fw={500} size="sm" mb="xs">
              Hex View
            </Text>
            <HexViewer
              hex={hexInput}
              selectedRange={selectedRange}
              onSelect={(range) => setSelectedRange(range)}
            />
          </Paper>
        </Group>
      ) : (
        !loading &&
        infoText && (
          <Box>
            <Text size="sm" c="dimmed">
              {infoText}
            </Text>
          </Box>
        )
      )}
    </Stack>
  )
}


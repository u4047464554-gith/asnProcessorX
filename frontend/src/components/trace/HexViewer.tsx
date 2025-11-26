import { Box, Group, Text, UnstyledButton } from '@mantine/core'
import type { BitRange } from './types'

interface HexViewerProps {
  hex: string
  bytesPerRow?: number
  selectedRange?: BitRange | null
  onSelect?: (range: BitRange) => void
}

const cleanHex = (hex: string): string[] => {
  const stripped = hex.replace(/[^0-9a-fA-F]/g, '').toUpperCase()
  const normalized = stripped.length % 2 === 0 ? stripped : `${stripped}0`
  const bytes: string[] = []
  for (let i = 0; i < normalized.length; i += 2) {
    bytes.push(normalized.slice(i, i + 2))
  }
  return bytes
}

const overlaps = (byteRange: BitRange, selected?: BitRange | null) => {
  if (!selected) return false
  return byteRange.start < selected.end && selected.start < byteRange.end
}

export const HexViewer = ({
  hex,
  bytesPerRow = 8,
  selectedRange,
  onSelect,
}: HexViewerProps) => {
  const bytes = cleanHex(hex)
  if (bytes.length === 0) {
    return (
      <Box data-testid="hex-viewer-empty">
        <Text size="sm" c="dimmed">
          No hex input to visualize.
        </Text>
      </Box>
    )
  }

  const rows: string[][] = []
  for (let i = 0; i < bytes.length; i += bytesPerRow) {
    rows.push(bytes.slice(i, i + bytesPerRow))
  }

  return (
    <Box data-testid="hex-viewer">
      {rows.map((row, rowIdx) => (
        <Group key={`row-${rowIdx}`} gap="sm" align="flex-start" wrap="nowrap">
          <Text size="xs" c="dimmed" style={{ width: 48 }}>
            {String(rowIdx * bytesPerRow).padStart(4, '0')}
          </Text>
          <Group gap="xs" wrap="nowrap">
            {row.map((byte, colIdx) => {
              const absoluteIndex = rowIdx * bytesPerRow + colIdx
              const range = { start: absoluteIndex * 8, end: absoluteIndex * 8 + 8, length: 8 }
              const isSelected = overlaps(range, selectedRange)
              return (
                <UnstyledButton
                  key={`byte-${absoluteIndex}`}
                  data-testid={`hex-byte-${absoluteIndex}`}
                  onClick={() => onSelect?.(range)}
                  style={{
                    width: 32,
                    textAlign: 'center',
                    padding: '6px 4px',
                    borderRadius: 4,
                    backgroundColor: isSelected
                      ? 'var(--mantine-color-blue-light, #e7f5ff)'
                      : 'var(--mantine-color-gray-1, #f1f3f5)',
                    fontFamily: 'monospace',
                    fontSize: '0.9rem',
                  }}
                  aria-label={`Byte ${absoluteIndex}, value ${byte}`}
                  className={isSelected ? 'hex-byte hex-byte--selected' : 'hex-byte'}
                >
                  {byte}
                </UnstyledButton>
              )
            })}
          </Group>
        </Group>
      ))}
    </Box>
  )
}


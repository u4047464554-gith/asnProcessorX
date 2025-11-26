import { useState, Fragment } from 'react'
import { Box, Code, Group, Text, UnstyledButton } from '@mantine/core'
import { IconChevronRight, IconChevronDown, IconPointFilled } from '@tabler/icons-react'
import type { BitRange, TraceNode } from './types'

interface TreeViewerProps {
  root: TraceNode
  onSelect?: (range: BitRange | null, node: TraceNode) => void
  selectedRange?: BitRange | null
}

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') {
    return value.length > 32 ? `${value.slice(0, 29)}…` : value
  }
  if (typeof value === 'object') {
    return Array.isArray(value) ? '[…]' : '{…}'
  }
  return String(value)
}

const rangesEqual = (a?: BitRange | null, b?: BitRange | null) => {
  if (!a || !b) return false
  return a.start === b.start && a.end === b.end
}

interface NodeProps {
  node: TraceNode
  depth: number
  onSelect?: (range: BitRange | null, node: TraceNode) => void
  selectedRange?: BitRange | null
}

const TreeNodeItem = ({ node, depth, onSelect, selectedRange }: NodeProps) => {
  const hasChildren = node.children && node.children.length > 0
  const [expanded, setExpanded] = useState(true)
  const indent = depth * 16
  const isSelected = rangesEqual(node.bits ?? null, selectedRange ?? null)

  return (
    <Box data-testid={`trace-node-${node.name}`} style={{ marginLeft: indent }}>
      <Group gap="xs" align="center">
        {hasChildren ? (
          <UnstyledButton
            aria-label={expanded ? 'Collapse node' : 'Expand node'}
            onClick={() => setExpanded((prev) => !prev)}
            style={{ display: 'flex' }}
          >
            {expanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
          </UnstyledButton>
        ) : (
          <IconPointFilled size={12} color="var(--mantine-color-gray-6)" />
        )}

        <UnstyledButton
          style={{
            textAlign: 'left',
            flex: 1,
            padding: '4px 6px',
            borderRadius: 6,
            backgroundColor: isSelected
              ? 'var(--mantine-color-blue-light, #e7f5ff)'
              : 'transparent',
          }}
          onClick={() => onSelect?.(node.bits ?? null, node)}
        >
          <Group gap="xs" wrap="nowrap">
            <Text size="sm" fw={500}>
              {node.name || '<anonymous>'}
            </Text>
            <Text size="xs" c="dimmed">
              {node.type}
            </Text>
            {node.bits && (
              <Code>
                {node.bits.start}..{node.bits.end} ({node.bits.length}b)
              </Code>
            )}
          </Group>
          {node.value !== undefined && node.value !== null && (
            <Text size="xs" c="dimmed">
              {formatValue(node.value)}
            </Text>
          )}
        </UnstyledButton>
      </Group>

      {hasChildren && expanded && (
        <Fragment>
          {node.children.map((child, index) => (
            <TreeNodeItem
              key={`${child.name}-${index}`}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
              selectedRange={selectedRange}
            />
          ))}
        </Fragment>
      )}
    </Box>
  )
}

export const TreeViewer = ({ root, onSelect, selectedRange }: TreeViewerProps) => {
  return (
    <Box data-testid="tree-viewer-root">
      <TreeNodeItem node={root} depth={0} onSelect={onSelect} selectedRange={selectedRange} />
    </Box>
  )
}


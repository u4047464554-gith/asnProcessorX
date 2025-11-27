import { useState } from 'react'
import { Box, Code, Group, Text, UnstyledButton, Badge } from '@mantine/core'
import { IconChevronDown, IconChevronRight, IconPointFilled } from '@tabler/icons-react'
import type { DefinitionNode } from './types'

interface NodeProps {
  node: DefinitionNode
  depth: number
}

const formatConstraints = (constraints?: Record<string, unknown>) => {
  if (!constraints) {
    return null
  }
  const entries = Object.entries(constraints).map(([key, value]) => {
    if ((key === 'range' || key === 'size') && value && typeof value === 'object') {
      const min = (value as Record<string, unknown>).min ?? '…'
      const max = (value as Record<string, unknown>).max ?? '…'
      return `${key}: [${min}, ${max}]`
    }
    if (Array.isArray(value)) {
      const preview = value.slice(0, 5).join(', ')
      return `${key}: [${preview}${value.length > 5 ? ', …' : ''}]`
    }
    if (typeof value === 'object' && value !== null) {
      return `${key}: {…}`
    }
    return `${key}: ${String(value)}`
  })

  return entries.join(' · ')
}

const DefinitionTreeNode = ({ node, depth }: NodeProps) => {
  const hasChildren = Boolean(node.children && node.children.length > 0)
  const [expanded, setExpanded] = useState(depth < 1)
  const indent = depth * 16
  const constraintsText = formatConstraints(node.constraints)

  return (
    <Box ml={indent} mb="xs">
      <Group gap="xs" align="flex-start" wrap="nowrap">
        {hasChildren ? (
          <UnstyledButton
            aria-label={expanded ? 'Collapse definition node' : 'Expand definition node'}
            onClick={() => setExpanded((prev) => !prev)}
            style={{ display: 'flex', paddingTop: 4 }}
          >
            {expanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
          </UnstyledButton>
        ) : (
          <IconPointFilled size={12} color="var(--mantine-color-gray-6)" style={{ marginTop: 6 }} />
        )}
        <Box>
          <Group gap="xs">
            <Text size="sm" fw={500}>
              {node.name || '<anonymous>'}
            </Text>
            <Code>{node.type}</Code>
            {node.optional && <Badge size="xs" variant="outline" color="gray" style={{ textTransform: 'none' }}>OPTIONAL</Badge>}
            {node.default !== undefined && <Badge size="xs" variant="outline" color="cyan" style={{ textTransform: 'none' }}>DEFAULT {String(node.default)}</Badge>}
          </Group>
          {constraintsText && (
            <Text size="xs" c="dimmed">
              {constraintsText}
            </Text>
          )}
          {node.note && (
            <Text size="xs" c="dimmed">
              {node.note}
            </Text>
          )}
        </Box>
      </Group>
      {hasChildren && expanded && node.children?.map((child, index) => (
        <DefinitionTreeNode key={`${child.name ?? 'node'}-${index}`} node={child} depth={depth + 1} />
      ))}
    </Box>
  )
}

interface DefinitionTreeProps {
  root: DefinitionNode
}

export const DefinitionTree = ({ root }: DefinitionTreeProps) => {
  return (
    <Box data-testid="definition-tree-root">
      <DefinitionTreeNode node={root} depth={0} />
    </Box>
  )
}

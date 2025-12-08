import React, { useMemo } from 'react';
import {
  Paper,
  Stack,
  Text,
  Table,
  Group,
  Badge,
  ActionIcon,
  ScrollArea,
  Tooltip,
  Button,
  Divider
} from '@mantine/core';
import {
  IconAlertCircle,
  IconCheck,
  IconEdit,
  IconCopy,
  IconDatabase,
  IconRefresh,
  IconCircleDot
} from '@tabler/icons-react';
import type { MscSequence, ValidationResult, TrackedConfiguration } from '../../domain/msc/types';
import { useMscEditor } from '../../hooks/useMscEditor';

interface ConfigurationPanelProps {
  sequence: MscSequence | null;
  height?: number;
  showValidation?: boolean;
  onIdentifierSelect?: (identifier: string) => void;
  selectedIdentifier?: string;
}



const CONFLICT_COLORS = {
  consistent: 'green',
  conflicting: 'red',
  unknown: 'gray'
};

export const ConfigurationPanel: React.FC<ConfigurationPanelProps> = ({
  sequence,
  height = 400,
  showValidation = true,
  onIdentifierSelect,
  selectedIdentifier
}) => {
  const { state, validateSequence, clearValidation } = useMscEditor();

  const trackedIdentifiers = useMemo(() => {
    if (!sequence) return [];

    return Object.entries(sequence.configurations || {}).map(([name, config]) => ({
      name,
      config: config as TrackedConfiguration,
      messageCount: Object.keys(config.values || {}).length,
      isConsistent: config.isConsistent || false,
      conflicts: config.conflicts || []
    }));
  }, [sequence]);

  const validationSummary = useMemo(() => {
    if (!sequence?.validationResults) return { errors: 0, warnings: 0 };

    return sequence.validationResults.reduce(
      (acc, result) => {
        if (result.type === 'error') acc.errors++;
        else if (result.type === 'warning') acc.warnings++;
        return acc;
      },
      { errors: 0, warnings: 0 }
    );
  }, [sequence?.validationResults]);

  const renderIdentifierRow = (identifier: {
    name: string;
    config: TrackedConfiguration;
    messageCount: number;
    isConsistent: boolean;
    conflicts: string[];
  }, index: number) => {
    const isSelected = selectedIdentifier === identifier.name;
    const rowStyle = isSelected
      ? { backgroundColor: '#eff6ff', borderLeft: '3px solid #3b82f6' }
      : index % 2 === 0
        ? { backgroundColor: '#f8fafc' }
        : {};

    const conflictColor = identifier.isConsistent
      ? CONFLICT_COLORS.consistent
      : CONFLICT_COLORS.conflicting;

    return (
      <tr
        key={identifier.name}
        style={rowStyle}
        onClick={() => onIdentifierSelect?.(identifier.name)}
        className="cursor-pointer hover:bg-blue-50 transition-colors"
      >
        <td>
          <Group gap="xs">
            <Text size="sm" fw={500} c={isSelected ? 'blue' : 'dark'}>
              {identifier.name}
            </Text>
            {identifier.conflicts.length > 0 && (
              <Tooltip
                label={identifier.conflicts.join('\n')}
                multiline
                w={250}
                withArrow
              >
                <ActionIcon size="xs" color="red" variant="light">
                  <IconAlertCircle size={12} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        </td>

        <td>
          <Badge
            color={conflictColor}
            size="sm"
            variant={identifier.isConsistent ? "filled" : "light"}
          >
            {identifier.isConsistent ? 'Consistent' : `${identifier.conflicts.length} conflicts`}
          </Badge>
        </td>

        <td>
          <Text size="sm" c="dimmed">
            {identifier.messageCount} messages
          </Text>
        </td>

        <td>
          <Group gap="xs">
            {Object.values(identifier.config.values || {}).slice(-3).map((value, idx) => (
              <Tooltip key={idx} label={`Message ${idx}`}>
                <Badge
                  size="xs"
                  variant="light"
                  color="gray"
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '10px',
                    maxWidth: '80px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {String(value).slice(0, 20)}
                </Badge>
              </Tooltip>
            ))}
            {identifier.messageCount > 3 && (
              <Text size="xs" c="dimmed">
                +{identifier.messageCount - 3} more
              </Text>
            )}
          </Group>
        </td>

        <td>
          <Group gap="xs">
            <ActionIcon
              size="xs"
              variant="subtle"
              color="gray"
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(JSON.stringify(identifier.config.values));
              }}
            >
              <IconCopy size={12} />
            </ActionIcon>
            <ActionIcon
              size="xs"
              variant="subtle"
              color="gray"
              onClick={(e) => {
                e.stopPropagation();
                onIdentifierSelect?.(identifier.name);
              }}
            >
              <IconEdit size={12} />
            </ActionIcon>
          </Group>
        </td>
      </tr>
    );
  };

  const renderValidationRow = (result: ValidationResult, index: number) => {
    const rowStyle = index % 2 === 0 ? { backgroundColor: '#f8fafc' } : {};

    return (
      <tr key={`${result.type}-${index}`} style={rowStyle}>
        <td>
          <Group gap="xs">
            <ActionIcon size="xs" color={result.type} variant="light">
              {result.type === 'error' ? <IconAlertCircle size={12} /> : <IconCircleDot size={12} />}
            </ActionIcon>
            <Text size="sm" c={result.type === 'error' ? 'red' : 'orange'}>
              {result.message}
            </Text>
          </Group>
        </td>

        {result.field && (
          <td>
            <Text size="sm" c="dimmed">
              {result.field}
            </Text>
          </td>
        )}

        {result.messageIndex !== undefined && (
          <td>
            <Text size="sm" c="dimmed">
              Message {result.messageIndex}
            </Text>
          </td>
        )}

        <td>
          <Badge color={result.type} size="xs">
            {result.type}
          </Badge>
        </td>

        <td>
          <Text size="sm" c="dimmed">
            {result.code || 'VALIDATION'}
          </Text>
        </td>
      </tr>
    );
  };

  const renderValidationSection = () => {
    if (!sequence?.validationResults?.length) {
      return (
        <Paper p="sm" withBorder bg="green.0">
          <Group gap="xs">
            <IconCheck size={16} color="green" />
            <Text size="sm" c="green">
              No validation errors
            </Text>
          </Group>
        </Paper>
      );
    }

    return (
      <Stack gap="sm">
        <Group justify="apart">
          <Text size="sm" fw={500}>Validation Results</Text>
          <Group>
            <Button
              size="xs"
              variant="subtle"
              leftSection={<IconRefresh size={14} />}
              onClick={validateSequence}
              loading={state.isValidating}
            >
              Revalidate
            </Button>
            <Button
              size="xs"
              variant="subtle"
              color="gray"
              onClick={clearValidation}
            >
              Clear
            </Button>
          </Group>
        </Group>

        <ScrollArea h={200}>
          <Table>
            <thead>
              <tr>
                <th>Message</th>
                <th>Issue</th>
                <th>Type</th>
                <th>Code</th>
              </tr>
            </thead>
            <tbody>
              {sequence.validationResults.map(renderValidationRow)}
            </tbody>
          </Table>
        </ScrollArea>
      </Stack>
    );
  };

  if (!sequence) {
    return (
      <Paper p="md">
        <Group>
          <IconDatabase size={24} color="gray" />
          <Text c="dimmed">No sequence loaded</Text>
        </Group>
      </Paper>
    );
  }

  return (
    <Stack gap="md" h={height}>
      {/* Summary Cards */}
      <Group grow>
        <Paper p="sm">
          <Group justify="center" mb="xs">
            <IconDatabase size={16} color="blue" />
            <Text size="xs" c="dimmed">Tracked Identifiers</Text>
          </Group>
          <Text size="lg" ta="center" fw={600}>
            {trackedIdentifiers.length}
          </Text>
        </Paper>

        <Paper p="sm">
          <Group justify="center" mb="xs">
            <IconAlertCircle size={16} color={validationSummary.errors > 0 ? 'red' : 'green'} />
            <Text size="xs" c="dimmed">Errors</Text>
          </Group>
          <Text size="lg" ta="center" fw={600} c={validationSummary.errors > 0 ? 'red' : 'green'}>
            {validationSummary.errors}
          </Text>
        </Paper>

        <Paper p="sm">
          <Group justify="center" mb="xs">
            <IconCircleDot size={16} color={validationSummary.warnings > 0 ? 'orange' : 'green'} />
            <Text size="xs" c="dimmed">Warnings</Text>
          </Group>
          <Text size="lg" ta="center" fw={600} c={validationSummary.warnings > 0 ? 'orange' : 'green'}>
            {validationSummary.warnings}
          </Text>
        </Paper>
      </Group>

      <Divider />

      {/* Tracked Identifiers Table */}
      <Paper withBorder p="md">
        <Group justify="apart" mb="sm">
          <Text size="md" fw={600}>Configuration Tracking</Text>
          <ActionIcon size="sm" variant="subtle" onClick={validateSequence} loading={state.isValidating}>
            <IconRefresh size={14} />
          </ActionIcon>
        </Group>

        <ScrollArea h={height * 0.4}>
          <Table>
            <thead>
              <tr>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'white' }}>Identifier</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'white' }}>Status</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'white' }}>Messages</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'white' }}>Recent Values</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'white' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {trackedIdentifiers.map(renderIdentifierRow)}
            </tbody>
          </Table>
        </ScrollArea>

        {trackedIdentifiers.length === 0 && (
          <Text c="dimmed" ta="center" p="md">
            No tracked identifiers. Add messages to the sequence to see configuration tracking.
          </Text>
        )}
      </Paper>

      {showValidation && sequence.validationResults.length > 0 && (
        <>
          <Divider />
          {renderValidationSection()}
        </>
      )}
    </Stack>
  );
};

ConfigurationPanel.displayName = 'ConfigurationPanel';

export default ConfigurationPanel;

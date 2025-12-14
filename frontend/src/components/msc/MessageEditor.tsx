import React, { useState, useEffect, useCallback } from 'react';
import {
  Paper,
  Group,
  Stack,
  Text,
  Select,
  Button,
  ActionIcon,
  Badge,
  Tooltip,
  Divider,
  ScrollArea,
  JsonInput,
  SegmentedControl,
  Loader
} from '@mantine/core';
import {
  IconTrash,
  IconCopy,
  IconCheck,
  IconAlertCircle,
  IconChevronDown,
  IconChevronUp,
  IconChevronRight,
  IconCircleDot
} from '@tabler/icons-react';
import { StructuredJsonEditor } from '../editor/StructuredJsonEditor';
import type { MscMessage, ValidationResult, IdentifierSuggestion } from '../../domain/msc/types';
import { formatAsnValue } from '../../types/asn';
import { useMscEditor } from '../../hooks/useMscEditor';

interface MessageEditorProps {
  message: MscMessage | null;
  sequenceId: string;
  onSave: (message: MscMessage) => void;
  onCancel: () => void;
  onDelete?: () => void;
  suggestions?: IdentifierSuggestion[];
  onSuggestionSelect?: (suggestion: IdentifierSuggestion) => void;
  isNew?: boolean;
  availableTypes?: string[];
  protocol?: string;
}

const ACTOR_OPTIONS = [
  { value: 'UE', label: 'UE (User Equipment)' },
  { value: 'gNB', label: 'gNB (Base Station)' },
  { value: 'Network', label: 'Network' },
  { value: 'CoreNetwork', label: 'Core Network' }
];

// Direction presets for common message types
const MESSAGE_DIRECTIONS: Record<string, { source: string; target: string }> = {
  // UE -> gNB messages
  'RRCSetupRequest': { source: 'UE', target: 'gNB' },
  'RRCSetupComplete': { source: 'UE', target: 'gNB' },
  'RRCReconfigurationComplete': { source: 'UE', target: 'gNB' },
  'MeasurementReport': { source: 'UE', target: 'gNB' },
  'SecurityModeComplete': { source: 'UE', target: 'gNB' },
  'UECapabilityInformation': { source: 'UE', target: 'gNB' },
  'RRCConnectionRequest': { source: 'UE', target: 'gNB' },
  'RRCConnectionSetupComplete': { source: 'UE', target: 'gNB' },
  // gNB -> UE messages
  'RRCSetup': { source: 'gNB', target: 'UE' },
  'RRCReconfiguration': { source: 'gNB', target: 'UE' },
  'RRCRelease': { source: 'gNB', target: 'UE' },
  'SecurityModeCommand': { source: 'gNB', target: 'UE' },
  'UECapabilityEnquiry': { source: 'gNB', target: 'UE' },
  'RRCConnectionSetup': { source: 'gNB', target: 'UE' },
  'RRCConnectionReconfiguration': { source: 'gNB', target: 'UE' },
  'RRCConnectionRelease': { source: 'gNB', target: 'UE' },
};

export const MessageEditor: React.FC<MessageEditorProps> = ({
  message,
  sequenceId,
  onSave,
  onCancel,
  onDelete,
  suggestions = [],
  onSuggestionSelect,
  isNew = false,
  availableTypes = [],
  protocol = 'rrc_demo'
}) => {
  const { state: editorState, detectIdentifiers, getFieldSuggestions } = useMscEditor();
  const [localMessage, setLocalMessage] = useState<MscMessage | null>(message);
  const [localData, setLocalData] = useState<any>({});
  const [localDataJson, setLocalDataJson] = useState<string>('{}');
  const [messageType, setMessageType] = useState<string>('');
  const [sourceActor, setSourceActor] = useState<string>('UE');
  const [targetActor, setTargetActor] = useState<string>('gNB');
  const [validationErrors, setValidationErrors] = useState<ValidationResult[]>([]);
  const [availableMessageTypes, setAvailableMessageTypes] = useState<string[]>(availableTypes);
  const [isValidating, setIsValidating] = useState(false);
  const [selectedField, setSelectedField] = useState<string>('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [fieldSuggestions, setFieldSuggestions] = useState<IdentifierSuggestion[]>([]);
  const [editorMode, setEditorMode] = useState<'structured' | 'raw'>('structured');
  const [typeSchema, setTypeSchema] = useState<any>(null);
  const [loadingSchema, setLoadingSchema] = useState(false);

  // Update available types when prop changes
  // Derived state for availableTypes
  const [prevAvailableTypes, setPrevAvailableTypes] = useState(availableTypes);
  if (availableTypes !== prevAvailableTypes) {
    setPrevAvailableTypes(availableTypes);
    if (availableTypes && availableTypes.length > 0) {
      setAvailableMessageTypes(availableTypes);
    }
  }

  // Initialize local state from props
  // Initialize local state from props (Derived State)
  const [prevMessage, setPrevMessage] = useState(message);
  const [prevIsNew, setPrevIsNew] = useState(isNew);

  if (message !== prevMessage || isNew !== prevIsNew) {
    setPrevMessage(message);
    setPrevIsNew(isNew);

    if (message) {
      setLocalMessage(message);
      setLocalData(message.data || {});
      setLocalDataJson(JSON.stringify(message.data || {}, null, 2));
      setMessageType(message.type_name || '');
      setSourceActor(message.sourceActor || 'UE');
      setTargetActor(message.targetActor || 'gNB');
    } else if (isNew) {
      // Initialize new message
      setLocalMessage(null);
      setLocalData({});
      setLocalDataJson('{}');
      setMessageType('');
      setSourceActor('UE');
      setTargetActor('gNB');
      setValidationErrors([]);
      setTypeSchema(null);
    }
  }

  // Load schema when message type changes
  useEffect(() => {
    const loadSchema = async () => {
      if (!messageType || !protocol) {
        setTypeSchema(null);
        return;
      }

      setLoadingSchema(true);
      try {
        const response = await fetch(`/api/asn/protocols/${protocol}/types/${messageType}`);
        if (response.ok) {
          const data = await response.json();
          setTypeSchema(data.tree);
        }
      } catch (error) {
        console.error('Failed to load type schema:', error);
        setTypeSchema(null);
      } finally {
        setLoadingSchema(false);
      }
    };

    loadSchema();
  }, [messageType, protocol]);

  // Detect identifiers when message type changes
  useEffect(() => {
    if (messageType && sequenceId && editorState.currentSequence?.protocol) {
      detectIdentifiers(messageType).then((identifiers) => {
        console.log('Detected identifiers:', identifiers);
      }).catch(console.error);
    }
  }, [messageType, sequenceId, detectIdentifiers, editorState.currentSequence?.protocol]);

  const handleTypeChange = useCallback((type: string | null) => {
    if (!type) return;
    setMessageType(type);
    setLocalData({}); // Reset data for new type
    setLocalDataJson('{}');

    // Auto-set message direction based on type
    const direction = MESSAGE_DIRECTIONS[type];
    if (direction) {
      setSourceActor(direction.source);
      setTargetActor(direction.target);
    }


  }, [sequenceId, getFieldSuggestions]);

  const handleActorChange = useCallback((actor: string, direction: 'source' | 'target') => {
    if (direction === 'source') {
      setSourceActor(actor);
    } else {
      setTargetActor(actor);
    }

    // Validate actor compatibility with message type
    if (messageType) {
      // Could add validation logic here
    }
  }, [messageType]);

  const handleDataChange = useCallback((newData: any) => {
    setLocalData(newData);
    setLocalDataJson(JSON.stringify(newData, null, 2));

    // Auto-validate data changes
    if (messageType && sequenceId) {
      // Trigger validation for changed fields
      validateMessageData(newData);
    }
  }, [messageType, sequenceId]);

  const handleRawJsonChange = useCallback((json: string) => {
    setLocalDataJson(json);
    try {
      const parsed = JSON.parse(json);
      setLocalData(parsed);

      // Auto-validate data changes
      if (messageType && sequenceId) {
        validateMessageData(parsed);
      }
    } catch (e) {
      // JSON is invalid, don't update localData
    }
  }, [messageType, sequenceId]);

  const validateMessageData = useCallback(async (data: any) => {
    setIsValidating(true);

    try {
      // For now, basic client-side validation
      const errors: ValidationResult[] = [];

      // Required fields based on message type
      const requiredFields = getRequiredFieldsForType(messageType);
      for (const field of requiredFields) {
        if (!data[field]) {
          errors.push({
            type: 'error',
            message: `Required field '${field}' is missing`,
            field,
            code: 'MISSING_REQUIRED_FIELD'
          });
        }
      }

      // Identifier consistency check (simplified)
      if (sequenceId && editorState.currentSequence) {
        const currentIndex = editorState.selectedMessageIndex ?? 0;
        const suggestions = await getFieldSuggestions('', currentIndex);

        // Check if required identifiers have values
        const trackedIdentifiers = await detectIdentifiers(messageType);
        for (const identifier of trackedIdentifiers) {
          if (!data[identifier] && suggestions.length > 0) {
            errors.push({
              type: 'warning',
              message: `Suggested value available for '${identifier}'`,
              field: identifier,
              code: 'SUGGESTION_AVAILABLE'
            });
          }
        }
      }

      setValidationErrors(errors);

    } catch (error) {
      console.error('Validation error:', error);
      setValidationErrors([{
        type: 'error',
        message: 'Validation failed',
        code: 'VALIDATION_ERROR'
      }]);
    } finally {
      setIsValidating(false);
    }
  }, [messageType, sequenceId, editorState.currentSequence, editorState.selectedMessageIndex, getFieldSuggestions, detectIdentifiers]);

  const getRequiredFieldsForType = useCallback((type: string): string[] => {
    const requiredFieldsMap: Record<string, string[]> = {
      'RRCConnectionRequest': ['ue-Identity', 'establishmentCause'],
      'RRCConnectionSetup': ['rrc-TransactionIdentifier', 'radioBearerConfig'],
      'RRCConnectionSetupComplete': ['rrc-TransactionIdentifier'],
      'RRCConnectionReconfiguration': ['rrc-TransactionIdentifier', 'radioBearerConfig'],
      'MeasurementReport': ['measResults'],
      'RRCConnectionRelease': ['releaseCause']
    };

    return requiredFieldsMap[type] || [];
  }, []);

  const handleFieldFocus = useCallback((field: string) => {
    setSelectedField(field);
    setShowSuggestions(true);

    if (sequenceId && messageType && editorState.currentSequence) {
      const currentIndex = editorState.selectedMessageIndex ?? 0;
      getFieldSuggestions(field, currentIndex).then((suggestions) => {
        setFieldSuggestions(suggestions || []);
      }).catch(console.error);
    }
  }, [sequenceId, messageType, editorState.currentSequence, editorState.selectedMessageIndex, getFieldSuggestions]);

  const handleSuggestionSelect = useCallback((suggestion: IdentifierSuggestion) => {
    if (selectedField && localData) {
      const updatedData = { ...localData };
      // Handle nested paths if necessary, but for now flat assignment to field name
      // If selectedField is a path (e.g. "a.b"), we need to update deep
      // But StructuredJsonEditor passes simple names usually, or primitive handler keys?
      // Wait, StructuredJsonEditor passes node.name which is simple name.
      // If we need deep update, we need path. 
      // But let's assume flat or simple update for now as per previous implementation.
      // The previous implementation used: [selectedField]: suggestion.value
      updatedData[selectedField] = suggestion.value;

      handleDataChange(updatedData);
      setShowSuggestions(false);

      if (onSuggestionSelect) {
        onSuggestionSelect(suggestion);
      }
    }
  }, [selectedField, localData, handleDataChange, onSuggestionSelect]);
  const handleSave = useCallback(() => {
    if (!messageType || !localData || sourceActor === targetActor) {
      // Basic validation
      const errors = [];
      if (!messageType) errors.push('Message type is required');
      if (sourceActor === targetActor) errors.push('Source and target actors must be different');
      if (errors.length > 0) {
        alert(`Validation errors:\n${errors.join('\n')}`);
        return;
      }
    }

    const finalMessage: MscMessage = {
      id: localMessage?.id || '',
      type_name: messageType,
      data: localData,
      sourceActor,
      targetActor,
      timestamp: Date.now() / 1000,
      validationErrors: validationErrors.length > 0 ? validationErrors : undefined
    };

    onSave(finalMessage);
  }, [messageType, localData, sourceActor, targetActor, validationErrors, localMessage?.id, onSave]);

  const handleDelete = useCallback(() => {
    if (onDelete && localMessage) {
      if (confirm(`Delete message "${localMessage.type_name}"?`)) {
        onDelete();
      }
    }
  }, [onDelete, localMessage]);

  const handleDuplicate = useCallback(() => {
    if (localMessage && onSave) {
      const duplicate = {
        ...localMessage,
        id: '',  // New ID will be generated
        timestamp: Date.now() / 1000
      };
      onSave(duplicate as MscMessage);
    }
  }, [localMessage, onSave]);

  if (!isNew && !localMessage) {
    return (
      <Paper p="md" withBorder>
        <Text>No message selected for editing.</Text>
      </Paper>
    );
  }

  return (
    <Paper withBorder p="md" radius="md" shadow="sm">
      <Group justify="space-between" mb="md">
        <Text size="lg" fw={600}>
          {isNew ? 'New Message' : `Edit Message: ${localMessage?.type_name}`}
        </Text>
        <Group>
          {onDelete && !isNew && (
            <Tooltip label="Delete Message">
              <ActionIcon color="red" onClick={handleDelete} variant="light">
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          {!isNew && (
            <Tooltip label="Duplicate Message">
              <ActionIcon color="blue" onClick={handleDuplicate} variant="light">
                <IconCopy size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          <Group>
            <Button
              variant="outline"
              size="sm"
              onClick={onCancel}
              leftSection={<IconChevronDown size={14} />}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              leftSection={<IconCheck size={14} />}
              loading={isValidating}
              disabled={!messageType || sourceActor === targetActor}
            >
              {isNew ? 'Add Message' : 'Update Message'}
            </Button>
          </Group>
        </Group>
      </Group>

      {/* Message Properties */}
      <Stack gap="sm">
        {/* Message Type */}
        <div>
          <Text size="sm" fw={500} mb="xs">Message Type</Text>
          <Select
            data={availableMessageTypes}
            value={messageType}
            onChange={handleTypeChange}
            placeholder="Select message type"
            searchable
            clearable={false}
            comboboxProps={{ withinPortal: true }}
            size="md"
            style={{ minWidth: 250 }}
          />
          {validationErrors.some(e => e.code === 'MISSING_TYPE_NAME') && (
            <Text size="xs" c="red" mt="xs">
              Message type is required
            </Text>
          )}
        </div>

        {/* Actors */}
        <Group grow>
          <div>
            <Text size="sm" fw={500} mb="xs">From (Source)</Text>
            <Select
              data={ACTOR_OPTIONS}
              value={sourceActor}
              onChange={(value) => handleActorChange(value!, 'source')}
              placeholder="Select source actor"
              clearable={false}
              size="md"
            />
          </div>
          <div style={{ textAlign: 'center', alignSelf: 'center' }}>
            <IconChevronRight size={24} color="#64748b" />
            <Text size="xs" c="dimmed">→</Text>
          </div>
          <div>
            <Text size="sm" fw={500} mb="xs">To (Target)</Text>
            <Select
              data={ACTOR_OPTIONS.filter(opt => opt.value !== sourceActor)}
              value={targetActor}
              onChange={(value) => handleActorChange(value!, 'target')}
              placeholder="Select target actor"
              clearable={false}
              size="md"
            />
          </div>
        </Group>

        {sourceActor === targetActor && (
          <Text size="xs" c="orange" mt="-10px">
            Warning: Source and target actors should be different for message flow
          </Text>
        )}

        {/* Message Data */}
        <div>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500}>Message Data</Text>
            <Group gap="xs">
              <SegmentedControl
                size="xs"
                value={editorMode}
                onChange={(v) => setEditorMode(v as 'structured' | 'raw')}
                data={[
                  { label: 'Structured', value: 'structured' },
                  { label: 'Raw JSON', value: 'raw' }
                ]}
              />
              {validationErrors.length > 0 && (
                <Badge color="red" size="sm" variant="filled">
                  {validationErrors.filter(e => e.type === 'error').length} Errors
                </Badge>
              )}
            </Group>
          </Group>

          {loadingSchema && (
            <Paper p="md" withBorder style={{ textAlign: 'center' }}>
              <Loader size="sm" />
              <Text size="xs" c="dimmed" mt="xs">Loading schema...</Text>
            </Paper>
          )}

          {!loadingSchema && editorMode === 'structured' && (
            <ScrollArea h={300}>
              <StructuredJsonEditor
                data={localData}
                schema={typeSchema}
                onChange={handleDataChange}
                onFieldFocus={handleFieldFocus}
              />
            </ScrollArea>
          )}

          {!loadingSchema && editorMode === 'raw' && (
            <JsonInput
              placeholder='{ "field": "value" }'
              value={localDataJson}
              onChange={handleRawJsonChange}
              formatOnBlur
              autosize
              minRows={8}
              maxRows={15}
              validationError="Invalid JSON"
            />
          )}

          {/* Field Suggestions */}
          {showSuggestions && (suggestions.length > 0 || fieldSuggestions.length > 0) && selectedField && (
            <Paper withBorder p="sm" mt="sm" shadow="xs" style={{ maxHeight: 200, overflowY: 'auto' }}>
              <Group justify="space-between" mb="xs">
                <Text size="sm" fw={500}>
                  Suggestions for '{selectedField}':
                </Text>
                <ActionIcon size="xs" variant="subtle" onClick={() => setShowSuggestions(false)}>
                  <IconChevronUp size={12} />
                </ActionIcon>
              </Group>
              <Stack gap="xs">
                {(fieldSuggestions.length > 0 ? fieldSuggestions : suggestions).slice(0, 5).map((suggestion, index) => (
                  <Group key={index} p="xs" style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    backgroundColor: suggestion.confidence > 0.8 ? '#f0fdf4' : '#fef3c7'
                  }} onClick={() => handleSuggestionSelect(suggestion)}>
                    <Text size="sm" fw={500} c={suggestion.confidence > 0.8 ? 'green' : 'orange'}>
                      {formatAsnValue(suggestion.value)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      (from message {suggestion.source_message_index}, confidence: {Math.round(suggestion.confidence * 100)}%)
                    </Text>
                  </Group>
                ))}
              </Stack>
            </Paper>
          )}

          {/* Validation Errors Display */}
          {validationErrors.length > 0 && (
            <Stack gap="xs" mt="sm">
              <Divider label="Validation" labelPosition="center" />
              <Stack gap="xs">
                {validationErrors.map((error, index) => (
                  <Group key={index} p="xs" style={{
                    backgroundColor: error.type === 'error' ? '#fef2f2' : '#fffbeb',
                    borderRadius: '4px',
                    border: `1px solid ${error.type === 'error' ? '#fecaca' : '#fde68a'}`
                  }}>
                    <ActionIcon size="xs" color={error.type === 'error' ? 'red' : 'yellow'}>
                      {error.type === 'error' ? <IconAlertCircle size={12} /> : <IconCircleDot size={12} />}
                    </ActionIcon>
                    <div>
                      <Text size="sm" fw={500} c={error.type === 'error' ? 'red' : 'orange'}>
                        {error.message}
                      </Text>
                      {error.field && (
                        <Text size="xs" c="dimmed">
                          Field: {error.field}
                        </Text>
                      )}
                      {error.code && (
                        <Text size="xs" c="dimmed">
                          Code: {error.code}
                        </Text>
                      )}
                    </div>
                  </Group>
                ))}
              </Stack>
            </Stack>
          )}
        </div>

        {/* Quick Actions */}
        {!isNew && localMessage && (
          <Group mt="md">
            <Button
              variant="light"
              leftSection={<IconCopy size={14} />}
              onClick={handleDuplicate}
              size="sm"
            >
              Duplicate Message
            </Button>
            <Button
              variant="light"
              color="gray"
              leftSection={<IconChevronUp size={14} />}
              size="sm"
              disabled={true} // Would implement move up/down
            >
              Move Up
            </Button>
            <Button
              variant="light"
              color="gray"
              leftSection={<IconChevronDown size={14} />}
              size="sm"
              disabled={true}
            >
              Move Down
            </Button>
          </Group>
        )}
      </Stack>
    </Paper>
  );
};

MessageEditor.displayName = 'MessageEditor';

export default MessageEditor;

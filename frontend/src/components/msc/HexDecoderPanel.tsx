import React, { useState, useCallback } from 'react';
import {
  Paper,
  Stack,
  Text,
  Textarea,
  Button,
  Group,
  Select,
  Badge,
  Alert,
  Loader,
  Divider,
  ActionIcon,
  Tooltip,
  ScrollArea,
  SegmentedControl
} from '@mantine/core';
import {
  IconUpload,
  IconX,
  IconCheck,
  IconAlertCircle,
  IconPlayerPlay,
  IconTrash,
  IconPlus,
  IconCopy
} from '@tabler/icons-react';

interface DecodedMessage {
  typeName: string;
  data: any;
  hex: string;
  status: 'success' | 'error';
  error?: string;
  sourceActor?: string;
  targetActor?: string;
}

interface HexDecoderPanelProps {
  protocol: string;
  availableTypes: string[];
  onMessagesDecoded: (messages: Array<{ typeName: string; data: any; hex: string; sourceActor?: string; targetActor?: string }>) => void;
  onAddMessage: (message: { typeName: string; data: any; sourceActor?: string; targetActor?: string }) => void;
}

export const HexDecoderPanel: React.FC<HexDecoderPanelProps> = ({
  protocol,
  availableTypes,
  onMessagesDecoded,
  onAddMessage
}) => {
  const [hexInput, setHexInput] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [decodedMessages, setDecodedMessages] = useState<DecodedMessage[]>([]);
  const [isDecoding, setIsDecoding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<'single' | 'multi'>('single');

  const cleanHex = (hex: string): string => {
    return hex
      .replace(/0x/gi, '')
      .replace(/,/g, '')
      .replace(/\s+/g, ' ')
      .replace(/[^0-9a-fA-F\s\n]/g, '')
      .trim();
  };

  const splitMultipleHex = (hex: string): string[] => {
    // Split by newlines or double-newlines for multiple messages
    const lines = hex.split(/\n\n+|\r\n\r\n+/);
    return lines
      .map(line => cleanHex(line))
      .filter(line => line.length > 0);
  };

  const decodeHex = useCallback(async (hexString: string, typeName: string | null): Promise<DecodedMessage> => {
    const cleanedHex = cleanHex(hexString);
    
    try {
      // Use the MSC-specific decode endpoint which auto-detects message direction
      const response = await fetch('/api/msc/decode-hex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hex_data: cleanedHex,
          protocol: protocol,
          type_name: typeName || undefined,
          encoding_rule: 'per'
        })
      });

      const result = await response.json();

      if (result.status === 'success') {
        return {
          typeName: result.typeName || result.type_name,
          data: result.data,
          hex: cleanedHex,
          status: 'success',
          sourceActor: result.sourceActor || result.source_actor || 'UE',
          targetActor: result.targetActor || result.target_actor || 'gNB'
        };
      } else {
        return {
          typeName: typeName || 'Unknown',
          data: null,
          hex: cleanedHex,
          status: 'error',
          error: result.error || result.diagnostics || 'Decode failed'
        };
      }
    } catch (err: any) {
      // Fallback to the ASN decode endpoint
      try {
        const response = await fetch('/api/asn/decode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hex_data: cleanedHex,
            protocol: protocol,
            type_name: typeName || undefined,
            encoding_rule: 'per'
          })
        });

        const result = await response.json();

        if (result.status === 'success') {
          return {
            typeName: result.decoded_type,
            data: result.data,
            hex: cleanedHex,
            status: 'success'
          };
        }
      } catch {
        // Ignore fallback errors
      }
      
      return {
        typeName: typeName || 'Unknown',
        data: null,
        hex: cleanedHex,
        status: 'error',
        error: err.message || 'Network error'
      };
    }
  }, [protocol]);

  const handleDecode = useCallback(async () => {
    if (!hexInput.trim()) {
      setError('Please enter hex data');
      return;
    }

    setIsDecoding(true);
    setError(null);
    setDecodedMessages([]);

    try {
      let hexStrings: string[];
      
      if (inputMode === 'multi') {
        hexStrings = splitMultipleHex(hexInput);
      } else {
        hexStrings = [cleanHex(hexInput)];
      }

      if (hexStrings.length === 0) {
        setError('No valid hex data found');
        setIsDecoding(false);
        return;
      }

      const results: DecodedMessage[] = [];
      
      for (const hex of hexStrings) {
        const result = await decodeHex(hex, selectedType);
        results.push(result);
      }

      setDecodedMessages(results);

      // Notify parent of successful decodes
      const successfulMessages = results
        .filter(r => r.status === 'success')
        .map(r => ({ 
          typeName: r.typeName, 
          data: r.data, 
          hex: r.hex,
          sourceActor: r.sourceActor,
          targetActor: r.targetActor
        }));
      
      if (successfulMessages.length > 0) {
        onMessagesDecoded(successfulMessages);
      }

    } catch (err: any) {
      setError(err.message || 'Decode failed');
    } finally {
      setIsDecoding(false);
    }
  }, [hexInput, selectedType, inputMode, decodeHex, onMessagesDecoded]);

  const handleAddToSequence = useCallback((message: DecodedMessage) => {
    if (message.status === 'success' && message.data) {
      onAddMessage({
        typeName: message.typeName,
        data: message.data,
        sourceActor: message.sourceActor,
        targetActor: message.targetActor
      });
    }
  }, [onAddMessage]);

  const handleAddAllToSequence = useCallback(() => {
    const successful = decodedMessages.filter(m => m.status === 'success');
    successful.forEach(message => {
      onAddMessage({
        typeName: message.typeName,
        data: message.data
      });
    });
  }, [decodedMessages, onAddMessage]);

  const handleClear = useCallback(() => {
    setHexInput('');
    setDecodedMessages([]);
    setError(null);
  }, []);

  const successCount = decodedMessages.filter(m => m.status === 'success').length;
  const errorCount = decodedMessages.filter(m => m.status === 'error').length;

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Text size="lg" fw={600}>Hex Decoder</Text>
          <SegmentedControl
            size="xs"
            value={inputMode}
            onChange={(v) => setInputMode(v as 'single' | 'multi')}
            data={[
              { label: 'Single Message', value: 'single' },
              { label: 'Multiple Messages', value: 'multi' }
            ]}
          />
        </Group>

        <Text size="sm" c="dimmed">
          {inputMode === 'single' 
            ? 'Paste hex data for a single RRC message'
            : 'Paste multiple hex messages separated by blank lines'
          }
        </Text>

        {/* Type Selection */}
        <Select
          label="Message Type (optional)"
          placeholder="Auto-detect or select type"
          data={[
            { value: '', label: '-- Auto-detect --' },
            ...availableTypes.map(t => ({ value: t, label: t }))
          ]}
          value={selectedType || ''}
          onChange={(v) => setSelectedType(v || null)}
          searchable
          clearable
          size="sm"
        />

        {/* Hex Input */}
        <Textarea
          placeholder={inputMode === 'single' 
            ? "80 05 1A 2B 3C... or 0x80, 0x05, 0x1A..."
            : "Message 1:\n80 05 1A 2B...\n\nMessage 2:\n90 06 2C 3D..."
          }
          value={hexInput}
          onChange={(e) => setHexInput(e.currentTarget.value)}
          minRows={inputMode === 'single' ? 3 : 6}
          maxRows={12}
          autosize
          styles={{
            input: {
              fontFamily: 'monospace',
              fontSize: '12px'
            }
          }}
        />

        {/* Actions */}
        <Group>
          <Button
            leftSection={<IconPlayerPlay size={16} />}
            onClick={handleDecode}
            loading={isDecoding}
            disabled={!hexInput.trim()}
          >
            Decode
          </Button>
          <Button
            variant="light"
            leftSection={<IconTrash size={16} />}
            onClick={handleClear}
            disabled={!hexInput && decodedMessages.length === 0}
          >
            Clear
          </Button>
          {decodedMessages.length > 0 && successCount > 0 && (
            <Button
              variant="filled"
              color="green"
              leftSection={<IconPlus size={16} />}
              onClick={handleAddAllToSequence}
            >
              Add All to Sequence ({successCount})
            </Button>
          )}
        </Group>

        {/* Error Display */}
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" title="Error">
            {error}
          </Alert>
        )}

        {/* Results Summary */}
        {decodedMessages.length > 0 && (
          <>
            <Divider />
            <Group justify="space-between">
              <Text size="sm" fw={500}>Decoded Results</Text>
              <Group gap="xs">
                {successCount > 0 && (
                  <Badge color="green" variant="light">
                    {successCount} Success
                  </Badge>
                )}
                {errorCount > 0 && (
                  <Badge color="red" variant="light">
                    {errorCount} Failed
                  </Badge>
                )}
              </Group>
            </Group>

            <ScrollArea h={300}>
              <Stack gap="sm">
                {decodedMessages.map((msg, index) => (
                  <Paper
                    key={index}
                    withBorder
                    p="sm"
                    radius="sm"
                    style={{
                      borderColor: msg.status === 'success' ? 'var(--mantine-color-green-5)' : 'var(--mantine-color-red-5)',
                      backgroundColor: msg.status === 'success' ? 'var(--mantine-color-green-0)' : 'var(--mantine-color-red-0)'
                    }}
                  >
                    <Group justify="space-between" mb="xs">
                      <Group gap="xs">
                        {msg.status === 'success' ? (
                          <IconCheck size={16} color="green" />
                        ) : (
                          <IconX size={16} color="red" />
                        )}
                        <Text size="sm" fw={500}>
                          {msg.typeName}
                        </Text>
                        <Badge size="xs" variant="outline">
                          {msg.hex.substring(0, 20)}...
                        </Badge>
                      </Group>
                      
                      {msg.status === 'success' && (
                        <Group gap="xs">
                          <Tooltip label="Copy JSON">
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              onClick={() => navigator.clipboard.writeText(JSON.stringify(msg.data, null, 2))}
                            >
                              <IconCopy size={14} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Add to Sequence">
                            <ActionIcon
                              size="sm"
                              variant="filled"
                              color="green"
                              onClick={() => handleAddToSequence(msg)}
                            >
                              <IconPlus size={14} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      )}
                    </Group>

                    {msg.status === 'success' ? (
                      <ScrollArea h={100}>
                        <Text size="xs" style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                          {JSON.stringify(msg.data, null, 2).substring(0, 500)}
                          {JSON.stringify(msg.data, null, 2).length > 500 && '...'}
                        </Text>
                      </ScrollArea>
                    ) : (
                      <Text size="xs" c="red">
                        {msg.error}
                      </Text>
                    )}
                  </Paper>
                ))}
              </Stack>
            </ScrollArea>
          </>
        )}
      </Stack>
    </Paper>
  );
};

HexDecoderPanel.displayName = 'HexDecoderPanel';

export default HexDecoderPanel;


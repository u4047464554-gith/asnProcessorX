import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  AppShell,
  Text,
  Group,
  Stack,
  Button,
  Select,
  TextInput,
  Paper,
  Loader,
  Divider,
  ScrollArea,
  Badge,
  Box,
  ThemeIcon
} from '@mantine/core';
import {
  IconCode,
  IconArrowRight,
  IconAlertCircle
} from '@tabler/icons-react';

import { useMscEditor } from '../hooks/useMscEditor';

import { useSession } from '../hooks/useSession';
import { MscHeader } from '../components/msc/MscHeader';
import { MscMessageDetail } from '../components/msc/MscMessageDetail';
import { MscActorPanel } from '../components/msc/MscActorPanel';


const ACTOR_COLORS: Record<string, string> = {
  UE: '#3b82f6',
  gNB: '#ef4444',
  Network: '#10b981',
  CoreNetwork: '#8b5cf6'
};

interface MscEditorProps {
  initialProtocol?: string;
}

export const MscEditor: React.FC<MscEditorProps> = ({ initialProtocol }) => {

  const {
    state,
    createSequence,
    loadSequence,
    deleteSequence,
    addMessage,
    updateMessage,
    removeMessage,

    selectMessage,
    setSequenceName,
    exportSequence,
    importSequence,
    canUndo,
    canRedo,
    undo,
    redo,

    loadAllSequences,
    isInitialized
  } = useMscEditor();

  // UI State with persistence
  const [protocol, setProtocol] = useState(() => {
    const saved = localStorage.getItem('msc-editor-protocol');
    return saved || initialProtocol || 'rrc_demo';
  });
  const [selectedMsgIndex, setSelectedMsgIndex] = useState<number | null>(() => {
    const saved = localStorage.getItem('msc-editor-selected-index');
    return saved ? parseInt(saved, 10) : null;
  });
  const [showMessageDetail, setShowMessageDetail] = useState(() => {
    return localStorage.getItem('msc-editor-show-detail') === 'true';
  });


  // Session state
  // Session state
  const {
    sessions,
    currentSessionId,
  } = useSession();



  // Load sessions on mount - only run once


  // Persist protocol changes
  useEffect(() => {
    localStorage.setItem('msc-editor-protocol', protocol);
  }, [protocol]);



  // Persist selected index changes
  useEffect(() => {
    if (selectedMsgIndex !== null) {
      localStorage.setItem('msc-editor-selected-index', selectedMsgIndex.toString());
    } else {
      localStorage.removeItem('msc-editor-selected-index');
    }
  }, [selectedMsgIndex]);

  // Persist showMessageDetail
  useEffect(() => {
    localStorage.setItem('msc-editor-show-detail', String(showMessageDetail));
  }, [showMessageDetail]);

  const [hexInput, setHexInput] = useState('');
  const [isDecoding, setIsDecoding] = useState(false);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);

  // Local sequence name state (to avoid API call on every keystroke)
  const [localSequenceName, setLocalSequenceName] = useState('');

  // New message form state
  const [newMsgType, setNewMsgType] = useState<string | null>(null);
  const [newMsgSource, setNewMsgSource] = useState('UE');
  const [newMsgTarget, setNewMsgTarget] = useState('gNB');
  const [newMsgData, setNewMsgData] = useState('{}');

  // Load protocol types
  useEffect(() => {
    const loadTypes = async () => {
      if (!protocol) return;
      try {
        const response = await fetch(`/api/asn/protocols/${protocol}/types`);
        if (response.ok) {
          const types = await response.json();
          setAvailableTypes(types);
        }
      } catch (error) {
        console.error('Failed to load types:', error);
      }
    };
    loadTypes();
  }, [protocol]);

  // Sync local sequence name from state (only when sequence changes)
  useEffect(() => {
    if (state.currentSequence?.name && state.currentSequence.name !== localSequenceName) {
      setLocalSequenceName(state.currentSequence.name);
    }
  }, [state.currentSequence?.id]); // Only sync when sequence ID changes, not name

  // Restore selected message index from persistence
  useEffect(() => {
    if (state.selectedMessageIndex !== null && state.selectedMessageIndex !== selectedMsgIndex) {
      setSelectedMsgIndex(state.selectedMessageIndex);
      if (state.selectedMessageIndex !== null) {
        setShowMessageDetail(true);
      }
    }
  }, [state.selectedMessageIndex]);

  // Debounced save of sequence name
  useEffect(() => {
    if (!localSequenceName || !state.currentSequence) return;
    if (localSequenceName === state.currentSequence.name) return;

    const timeoutId = setTimeout(() => {
      setSequenceName(localSequenceName);
    }, 500); // Save after 500ms of no typing

    return () => clearTimeout(timeoutId);
  }, [localSequenceName]);

  // Load sequences when session changes
  useEffect(() => {
    if (currentSessionId) {
      loadAllSequences(currentSessionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSessionId]); // Only depend on currentSessionId, loadAllSequences is stable

  // Track if we've already created a sequence this session
  const hasCreatedSequenceRef = useRef(false);

  // Simple initialization - create sequence if none exists
  useEffect(() => {
    // Wait for hook initialization
    if (!isInitialized) {
      console.log('[MscEditor] Waiting for hook initialization...');
      return;
    }

    // Wait for sessions
    if (sessions.length === 0) {
      console.log('[MscEditor] Waiting for sessions to load...');
      return;
    }

    const sessionId = currentSessionId || sessions[0]?.id;
    if (!sessionId) return;

    // Don't process if loading
    if (state.isLoading) return;

    // Check if we already have a current sequence for this session
    if (state.currentSequence) {
      const currentSeqSession = state.currentSequence.sessionId || (state.currentSequence as any).session_id;
      if (currentSeqSession === sessionId) {
        console.log('[MscEditor] Already have correct sequence:', state.currentSequence.id);
        return;
      }
    }

    // Check if we have loaded sequences for this session
    console.log(`[MscEditor] Checking ${state.sequences.length} loaded sequences for session ${sessionId}`);
    const existingSequence = state.sequences.find(seq =>
      (seq.sessionId || (seq as any).session_id) === sessionId
    );

    if (existingSequence) {
      // We found one! Load it.
      console.log('[MscEditor] Loading existing sequence:', existingSequence.id);
      if (state.currentSequence?.id !== existingSequence.id) {
        loadSequence(existingSequence.id);
      }
      return;
    }

    // Only create once
    if (hasCreatedSequenceRef.current) return;
    hasCreatedSequenceRef.current = true;

    console.log('[MscEditor] Creating new sequence for session:', sessionId);
    createSequence('Untitled Sequence', protocol, sessionId)
      .then(seq => console.log('[MscEditor] Created sequence:', seq?.id))
      .catch(err => {
        console.error('[MscEditor] Failed to create sequence:', err);
        hasCreatedSequenceRef.current = false; // Allow retry
      });
  }, [isInitialized, currentSessionId, sessions, protocol, state.currentSequence, state.sequences, state.isLoading, createSequence, loadSequence]);

  // Get selected message
  const selectedMessage = useMemo(() => {
    if (selectedMsgIndex === null || !state.currentSequence) return null;
    return state.currentSequence.messages[selectedMsgIndex] || null;
  }, [selectedMsgIndex, state.currentSequence]);



  // Get actors in sequence (always show UE and gNB at minimum)
  const actors = useMemo(() => {
    const actorSet = new Set<string>(['UE', 'gNB']);
    if (state.currentSequence) {
      state.currentSequence.messages.forEach(msg => {
        actorSet.add(msg.sourceActor || msg.source_actor || 'UE');
        actorSet.add(msg.targetActor || msg.target_actor || 'gNB');
      });
    }
    // Sort to ensure UE comes before gNB
    return Array.from(actorSet).sort((a, b) => {
      const order = ['UE', 'gNB', 'Network', 'CoreNetwork'];
      return order.indexOf(a) - order.indexOf(b);
    });
  }, [state.currentSequence]);

  // Compute comprehensive actor-specific state at selected message
  const actorStates = useMemo(() => {
    if (!state.currentSequence) return null;

    const messages = state.currentSequence.messages;
    const upToSelected = selectedMsgIndex !== null
      ? messages.slice(0, selectedMsgIndex + 1)
      : messages;

    const actorStateMap: Record<string, {
      actor: string;
      identifiers: Record<string, {
        value: any;
        fromMessage: number;
        isConsistent?: boolean;
        conflicts?: string[];
      }>;
      configurationIds: string[];
      lastMessage: number | null;
      state: string | null;
      configurations: Array<{
        id: string;
        name: string;
        values: Record<number, any>;
        isConsistent: boolean;
        conflicts: string[];
        currentValue?: any;
      }>;
    }> = {};

    // Initialize actors
    actors.forEach(actor => {
      actorStateMap[actor] = {
        actor,
        identifiers: {},
        configurationIds: [],
        lastMessage: null,
        state: null,
        configurations: [],
      };
    });

    // Process tracked identifiers/configurations from sequence
    if (state.currentSequence.configurations) {
      const configs = state.currentSequence.configurations;
      const configDict = typeof configs === 'object' && !Array.isArray(configs)
        ? configs
        : Array.isArray(configs)
          ? Object.fromEntries(configs.map((c: any, i: number) => [c.name || c.identifier || `config_${i}`, c]))
          : {};

      Object.entries(configDict).forEach(([configId, config]: [string, any]) => {
        const configName = config.name || config.identifier || configId;
        const values = config.values || {};
        const isConsistent = config.isConsistent !== undefined ? config.isConsistent :
          config.is_consistent !== undefined ? config.is_consistent : true;
        const conflicts = config.conflicts || [];

        // Determine which actor(s) this configuration belongs to
        const configNameLower = configName.toLowerCase();
        let targetActors: string[] = [];

        // Pattern matching for actor assignment
        if (configNameLower.includes('ue') || configNameLower.includes('user') ||
          configNameLower.includes('initialue') || configNameLower.includes('s-tmsi')) {
          targetActors.push('UE');
        }
        if (configNameLower.includes('gnb') || configNameLower.includes('base') ||
          configNameLower.includes('c-rnti') || configNameLower.includes('paging')) {
          targetActors.push('gNB');
        }
        if (configNameLower.includes('network') || configNameLower.includes('core')) {
          targetActors.push('Network');
          targetActors.push('CoreNetwork');
        }

        // If no pattern match, try to infer from message data
        if (targetActors.length === 0) {
          // Check which messages contain this identifier
          upToSelected.forEach((msg) => {
            if (msg.data) {
              const fieldPath = configName.split('.');
              let value = msg.data;
              for (const part of fieldPath) {
                if (value && typeof value === 'object') {
                  value = value[part];
                } else {
                  value = undefined;
                  break;
                }
              }

              if (value !== undefined) {
                const source = msg.sourceActor || msg.source_actor || 'UE';
                const target = msg.targetActor || msg.target_actor || 'gNB';
                if (!targetActors.includes(source)) targetActors.push(source);
                if (!targetActors.includes(target)) targetActors.push(target);
              }
            }
          });
        }

        // Default to all actors if still unknown
        if (targetActors.length === 0) {
          targetActors = [...actors];
        }

        // Get current value at selected message point
        let currentValue: any = undefined;
        if (selectedMsgIndex !== null && values[selectedMsgIndex] !== undefined) {
          currentValue = values[selectedMsgIndex];
        } else {
          // Get the most recent value up to selected point
          const relevantValues = Object.entries(values)
            .filter(([msgIdx]) => parseInt(msgIdx) <= selectedMsgIndex!)
            .sort(([a], [b]) => parseInt(b) - parseInt(a));
          if (relevantValues.length > 0) {
            currentValue = relevantValues[0][1];
          }
        }

        // Add to each target actor
        targetActors.forEach(actor => {
          if (!actorStateMap[actor]) {
            actorStateMap[actor] = {
              actor,
              identifiers: {},
              configurationIds: [],
              lastMessage: null,
              state: null,
              configurations: [],
            };
          }

          actorStateMap[actor].configurationIds.push(configId);
          actorStateMap[actor].configurations.push({
            id: configId,
            name: configName,
            values,
            isConsistent,
            conflicts,
            currentValue,
          });

          // Also add as identifier for easy access
          if (currentValue !== undefined) {
            const lastMsgIdx = Math.max(...Object.keys(values).map(k => parseInt(k)).filter(k => k <= (selectedMsgIndex ?? messages.length - 1)));
            actorStateMap[actor].identifiers[configName] = {
              value: currentValue,
              fromMessage: lastMsgIdx,
              isConsistent,
              conflicts,
            };
          }
        });
      });
    }

    // Extract additional identifiers directly from messages
    upToSelected.forEach((msg, idx) => {
      const source = msg.sourceActor || msg.source_actor || 'UE';
      const target = msg.targetActor || msg.target_actor || 'gNB';

      if (!actorStateMap[source]) {
        actorStateMap[source] = {
          actor: source,
          identifiers: {},
          configurationIds: [],
          lastMessage: null,
          state: null,
          configurations: [],
        };
      }
      if (!actorStateMap[target]) {
        actorStateMap[target] = {
          actor: target,
          identifiers: {},
          configurationIds: [],
          lastMessage: null,
          state: null,
          configurations: [],
        };
      }

      // Extract identifiers from message data
      if (msg.data) {
        const extractIdentifiers = (data: any, prefix: string = '') => {
          Object.entries(data).forEach(([key, value]) => {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
              extractIdentifiers(value, fullKey);
            } else if (value !== null && value !== undefined) {
              // UE-specific fields
              if (key.includes('ue') || key.includes('UE') || key.includes('Identity') || key.includes('TMSI')) {
                if (!actorStateMap['UE'].identifiers[fullKey]) {
                  actorStateMap['UE'].identifiers[fullKey] = { value, fromMessage: idx };
                }
              }
              // gNB-specific fields
              if (key.includes('gnb') || key.includes('gNB') || key.includes('RNTI') || key.includes('paging')) {
                if (!actorStateMap['gNB'].identifiers[fullKey]) {
                  actorStateMap['gNB'].identifiers[fullKey] = { value, fromMessage: idx };
                }
              }
              // RRC state
              if (key.includes('rrcState') || key.includes('state')) {
                actorStateMap[source].state = String(value);
              }
            }
          });
        };

        extractIdentifiers(msg.data);
      }

      actorStateMap[source].lastMessage = idx;
      actorStateMap[target].lastMessage = idx;
    });

    return Object.values(actorStateMap);
  }, [state.currentSequence, selectedMsgIndex, actors]);


  // Handle message click
  const handleMessageClick = (index: number) => {
    setSelectedMsgIndex(index);
    selectMessage(index);
    setShowMessageDetail(true);
    // Persist selection
    localStorage.setItem('msc-editor-selected-index', index.toString());
  };



  // Handle add message
  const handleAddMessage = async () => {
    if (!newMsgType || !newMsgType.trim()) {
      alert('Please select a message type');
      return;
    }

    // Ensure we have a current sequence
    if (!state.currentSequence) {
      if (!currentSessionId) {
        alert('Please select a session first');
        return;
      }
      // Create a sequence if none exists
      try {
        await createSequence('Untitled Sequence', protocol, currentSessionId);
        // Wait a bit for sequence to be created
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (err) {
        console.error('Failed to create sequence:', err);
        alert('Failed to create sequence. Please try again.');
        return;
      }
    }

    // Ensure we still have a sequence after creation
    if (!state.currentSequence) {
      alert('Sequence not available. Please try again.');
      return;
    }

    try {
      // Try to fetch a default structure for this type
      let data = {};
      try {
        const response = await fetch(`/api/asn/protocols/${protocol}/types/${newMsgType}/example`);
        if (response.ok) {
          const result = await response.json();
          data = result.data || result.example || {};
        }
      } catch (e) {
        // If no example available, use empty object
        console.debug('No example available for type:', newMsgType);
      }

      // Override with any manually entered data
      if (newMsgData && newMsgData.trim() && newMsgData !== '{}') {
        try {
          const parsed = JSON.parse(newMsgData);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            data = parsed;
          } else if (Array.isArray(parsed)) {
            console.warn('Message data must be a JSON object, not an array');
            alert('Message data must be a JSON object, not an array');
            return;
          }
        } catch (e) {
          console.warn('Failed to parse message data JSON:', e);
          // Keep the fetched data if JSON parse fails
        }
      }

      if (!newMsgType || !newMsgType.trim()) {
        alert('Message type is required');
        return;
      }

      await addMessage({
        type_name: newMsgType.trim(),
        data: data || {},
        source_actor: newMsgSource || 'UE',
        target_actor: newMsgTarget || 'gNB'
      });
      setNewMsgType(null);
      setNewMsgData('{}');
    } catch (e: any) {
      console.error('Failed to add message:', e);
      let errorMessage = e?.response?.data?.detail || e?.message || 'Failed to add message';

      // Check for 404 (sequence not found)
      const is404 = e?.response?.status === 404 ||
        (typeof errorMessage === 'string' && errorMessage.toLowerCase().includes('not found'));

      if (is404) {
        alert('The current sequence was not found on the server (it may have been deleted). The page will reload.');
        // Clear persisted state
        localStorage.removeItem('msc-editor-sequence-id');
        window.location.reload();
        return;
      }

      if (typeof errorMessage === 'object') {
        errorMessage = JSON.stringify(errorMessage);
      }
      alert(`Failed to add message: ${errorMessage}`);
    }
  };

  // Handle decode hex
  const handleDecodeHex = async () => {
    if (!hexInput.trim()) return;

    setIsDecoding(true);
    try {
      const cleanHex = hexInput.replace(/0x/gi, '').replace(/,/g, '').replace(/\s+/g, '');
      const response = await fetch('/api/msc/decode-hex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hex_data: cleanHex,
          protocol: protocol
        })
      });

      const result = await response.json();
      if (result.status === 'success') {
        await addMessage({
          type_name: result.typeName || result.type_name,
          data: result.data,
          source_actor: result.sourceActor || result.source_actor || 'UE',
          target_actor: result.targetActor || result.target_actor || 'gNB'
        });
        setHexInput('');
      } else {
        alert(`Decode failed: ${result.error}`);
      }
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setIsDecoding(false);
    }
  };



  // Only show loading spinner if we're truly loading and have no session yet
  // Once we have a session, show the UI even if loading sequences
  if (state.isLoading && sessions.length === 0 && !currentSessionId) {
    return (
      <Box style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Loader size="xl" />
      </Box>
    );
  }

  return (
    <AppShell header={{ height: 50 }} padding={0}>
      {/* Minimal Header */}
      <MscHeader
        protocol={protocol}
        setProtocol={setProtocol}
        currentSequence={state.currentSequence}
        createSequence={createSequence}
        deleteSequence={deleteSequence}
        exportSequence={exportSequence}
        importSequence={importSequence}
        canUndo={canUndo}
        canRedo={canRedo}
        undo={undo}
        redo={redo}
      />

      <AppShell.Main>
        <Box style={{ minHeight: 'calc(100vh - 50px)', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>

          {/* Main Content - MSC View and Detail Panel */}
          <Box style={{ flex: 1, display: 'flex', overflow: 'visible', minHeight: 0 }}>
            {/* MSC Diagram Panel */}
            <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'auto' }}>
              {/* Actor State Panel - Key Feature */}
              <MscActorPanel
                actorStates={actorStates}
                selectedMessageIndex={selectedMsgIndex}
                actorColors={ACTOR_COLORS}
                actors={actors}
              />

              {/* Messages List */}
              <ScrollArea style={{ flex: 1 }} mx="md" mt="xs">
                <Stack gap="xs" pb="md">
                  {state.currentSequence?.messages.map((msg: any, index) => {
                    const typeName = msg.typeName || msg.type_name || msg.type || 'Unknown';
                    const source = msg.sourceActor || msg.source_actor || 'UE';
                    const target = msg.targetActor || msg.target_actor || 'gNB';
                    const isSelected = selectedMsgIndex === index;
                    const hasErrors = msg.validationErrors?.some((e: any) => e.type === 'error');



                    return (
                      <Paper
                        key={msg.id || index}
                        data-testid={`message-item-${index}`}
                        p="sm"
                        withBorder
                        shadow={isSelected ? 'md' : 'xs'}
                        style={{
                          cursor: 'pointer',
                          borderColor: isSelected ? '#3b82f6' : hasErrors ? '#ef4444' : undefined,
                          borderWidth: isSelected ? 2 : 1,
                          backgroundColor: isSelected ? '#eff6ff' : undefined
                        }}
                        onClick={() => handleMessageClick(index)}
                      >
                        <Group justify="space-between" wrap="nowrap">
                          <Group gap="xs" wrap="nowrap">
                            <Badge size="sm" variant="filled" color="gray">{index + 1}</Badge>
                            <Badge
                              size="sm"
                              variant="light"
                              style={{ backgroundColor: ACTOR_COLORS[source], color: 'white' }}
                            >
                              {source}
                            </Badge>
                            <IconArrowRight size={14} color="#64748b" />
                            <Badge
                              size="sm"
                              variant="light"
                              style={{ backgroundColor: ACTOR_COLORS[target], color: 'white' }}
                            >
                              {target}
                            </Badge>
                          </Group>
                          <Group gap="xs" wrap="nowrap">
                            <Text size="sm" fw={600} style={{ fontFamily: 'monospace' }}>
                              {typeName}
                            </Text>
                            {hasErrors && (
                              <ThemeIcon size="xs" color="red" variant="light">
                                <IconAlertCircle size={12} />
                              </ThemeIcon>
                            )}
                          </Group>
                        </Group>
                      </Paper>
                    );
                  })}

                  {(!state.currentSequence?.messages || state.currentSequence.messages.length === 0) && (
                    <Paper p="xl" withBorder style={{ textAlign: 'center' }}>
                      <Text c="dimmed" size="sm">No messages yet</Text>
                      <Text c="dimmed" size="xs">Add messages using the panel below</Text>
                    </Paper>
                  )}
                </Stack>
              </ScrollArea>

              {/* Add Message Panel */}
              <Paper mx="md" mb="md" p="sm" withBorder>
                <Stack gap="xs">
                  <Group gap="xs">
                    <Select
                      size="xs"
                      placeholder="Message type"
                      data={availableTypes}
                      value={newMsgType}
                      onChange={setNewMsgType}
                      searchable
                      style={{ flex: 1 }}
                    />
                    <Select
                      size="xs"
                      value={newMsgSource}
                      onChange={(v) => setNewMsgSource(v || 'UE')}
                      data={['UE', 'gNB', 'Network', 'CoreNetwork']}
                      style={{ width: 90 }}
                    />
                    <IconArrowRight size={14} color="#64748b" />
                    <Select
                      size="xs"
                      value={newMsgTarget}
                      onChange={(v) => setNewMsgTarget(v || 'gNB')}
                      data={['UE', 'gNB', 'Network', 'CoreNetwork'].filter(a => a !== newMsgSource)}
                      style={{ width: 90 }}
                    />
                    <Button size="xs" onClick={handleAddMessage} disabled={!newMsgType}>
                      Add
                    </Button>
                  </Group>

                  <Divider label="or paste hex" labelPosition="center" />

                  <Group gap="xs">
                    <TextInput
                      size="xs"
                      placeholder="Paste hex: 80 05 1A 2B..."
                      value={hexInput}
                      onChange={(e) => setHexInput(e.currentTarget.value)}
                      style={{ flex: 1, fontFamily: 'monospace' }}
                    />
                    <Button
                      size="xs"
                      variant="light"
                      leftSection={<IconCode size={14} />}
                      onClick={handleDecodeHex}
                      loading={isDecoding}
                      disabled={!hexInput.trim()}
                    >
                      Decode & Add
                    </Button>
                  </Group>
                </Stack>
              </Paper>
            </Box>

            {/* Message Detail Panel (shows when message selected) */}
            {showMessageDetail && selectedMessage && (
              <Box>
                <MscMessageDetail
                  message={selectedMessage}
                  protocol={protocol}
                  onClose={() => {
                    setShowMessageDetail(false);
                    setSelectedMsgIndex(null);
                  }}
                  onSave={async (id, data) => {
                    if (state.currentSequence && selectedMsgIndex !== null) {
                      try {
                        await updateMessage(id, data);
                      } catch (e: any) {
                        console.error('Save failed:', e);
                        const msg = e.response?.data?.detail || e.message || 'Unknown error';
                        alert(`Could not save changes: ${msg}`);
                      }
                    }
                  }}
                  onDelete={async (id) => {
                    await removeMessage(id);
                    setShowMessageDetail(false);
                    setSelectedMsgIndex(null);
                  }}
                />
              </Box>
            )}
          </Box>
        </Box>
      </AppShell.Main>


    </AppShell>
  );
};

MscEditor.displayName = 'MscEditor';

export default MscEditor;

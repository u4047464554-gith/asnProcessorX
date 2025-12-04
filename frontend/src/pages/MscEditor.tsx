import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AppShell,
  Text,
  Group,
  Stack,
  Button,
  ActionIcon,
  Select,
  TextInput,
  Modal,
  Paper,
  Loader,
  Alert,
  Divider,
  ScrollArea,
  Badge,
  Textarea,
  JsonInput,
  Tooltip,
  Box,
  SegmentedControl,
  Title,
  ThemeIcon,
  Menu
} from '@mantine/core';
import {
  IconHome,
  IconPlus,
  IconTrash,
  IconDownload,
  IconUpload,
  IconCheck,
  IconX,
  IconAlertCircle,
  IconChevronLeft,
  IconChevronRight,
  IconCode,
  IconFileImport,
  IconDeviceFloppy,
  IconDots,
  IconEdit,
  IconEye,
  IconPlayerPlay,
  IconArrowRight
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useMscEditor } from '../hooks/useMscEditor';
import type { MscSequence, MscMessage } from '../domain/msc/types';
import { StructuredJsonEditor } from '../components/editor/StructuredJsonEditor';
import mscSessionService from '../services/mscSessionService';
import type { MscSession } from '../services/mscSessionService';

const PROTOCOL_OPTIONS = [
  { value: 'rrc_demo', label: 'RRC Demo' },
  { value: 'nr_rel17_rrc', label: 'NR RRC Rel-17' },
  { value: 'multi_file_demo', label: 'Multi-File Demo' },
];

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
  const navigate = useNavigate();
  const {
    state,
    createSequence,
    loadSequence,
    deleteSequence,
    addMessage,
    removeMessage,
    validateSequence,
    selectMessage,
    setSequenceName,
    exportSequence,
    importSequence,
    canUndo,
    canRedo,
    undo,
    redo,
    clearValidation,
    loadAllSequences
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
  const [showAddMessage, setShowAddMessage] = useState(false);

  // Session state
  const [sessions, setSessions] = useState<MscSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => {
    return localStorage.getItem('msc-editor-session-id');
  });
  const [newSessionName, setNewSessionName] = useState('');
  const [showCreateSessionModal, setShowCreateSessionModal] = useState(false);

  // Load sessions on mount - only run once
  useEffect(() => {
    let isMounted = true;
    
    const loadSessions = async () => {
      try {
        const loadedSessions = await mscSessionService.listSessions();
        
        if (!isMounted) return;
        
        // Always ensure we have at least one session
        if (loadedSessions.length === 0) {
          // No sessions exist, create a default one
          try {
            const defaultSession = await mscSessionService.createSession('Default Session', 'Main working session');
            if (!isMounted) return;
            setSessions([defaultSession]);
            setCurrentSessionId(defaultSession.id);
            localStorage.setItem('msc-editor-session-id', defaultSession.id);
            return;
          } catch (e) {
            console.error('Failed to create default session:', e);
            if (!isMounted) return;
            // If creation fails, still set empty array to show UI
            setSessions([]);
            return;
          }
        }
        
        // Sessions exist
        setSessions(loadedSessions);
        
        // Check if current session ID is valid
        const savedSessionId = localStorage.getItem('msc-editor-session-id');
        if (savedSessionId && loadedSessions.find(s => s.id === savedSessionId)) {
          // Valid saved session, use it
          setCurrentSessionId(savedSessionId);
        } else {
          // No valid saved session, use first available
          setCurrentSessionId(loadedSessions[0].id);
          localStorage.setItem('msc-editor-session-id', loadedSessions[0].id);
        }
      } catch (error) {
        console.error('Failed to load sessions:', error);
        if (!isMounted) return;
        // Try to create a default session as fallback
        try {
          const defaultSession = await mscSessionService.createSession('Default Session', 'Main working session');
          if (!isMounted) return;
          setSessions([defaultSession]);
          setCurrentSessionId(defaultSession.id);
          localStorage.setItem('msc-editor-session-id', defaultSession.id);
        } catch (e) {
          console.error('Failed to create default session after error:', e);
          if (!isMounted) return;
          setSessions([]);
        }
      }
    };
    
    loadSessions();
    
    return () => {
      isMounted = false;
    };
  }, []); // Only run on mount

  // Persist protocol changes
  useEffect(() => {
    localStorage.setItem('msc-editor-protocol', protocol);
  }, [protocol]);

  // Persist session changes
  useEffect(() => {
    if (currentSessionId) {
      localStorage.setItem('msc-editor-session-id', currentSessionId);
    }
  }, [currentSessionId]);

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
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState('');
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

  // Initialize sequence - wait a bit to allow persisted state to restore
  useEffect(() => {
    // Only proceed if we have all prerequisites
    if (!currentSessionId || sessions.length === 0 || state.isLoading) {
      return;
    }
    
    // If we already have a sequence, don't create a new one
    if (state.currentSequence) {
      return;
    }
    
    const timer = setTimeout(() => {
      // Double-check conditions before creating
      if (!state.currentSequence && !state.isLoading && currentSessionId && sessions.length > 0) {
        const createPromise = createSequence('Untitled Sequence', protocol, currentSessionId);
        if (createPromise && typeof createPromise.catch === 'function') {
          createPromise.catch(err => {
            console.error('Failed to create initial sequence:', err);
          });
        }
      }
    }, 300); // Small delay to allow persisted state and session to restore first
    
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSessionId, protocol, state.currentSequence?.id, state.isLoading, sessions.length]); // Use sequence ID instead of whole object

  // Get selected message
  const selectedMessage = useMemo(() => {
    if (selectedMsgIndex === null || !state.currentSequence) return null;
    return state.currentSequence.messages[selectedMsgIndex] || null;
  }, [selectedMsgIndex, state.currentSequence]);

  // Editor state for message detail panel
  const [editorMode, setEditorMode] = useState<'structured' | 'raw'>('structured');
  const [messageDataJson, setMessageDataJson] = useState<string>('{}');
  const [messageDefinitionTree, setMessageDefinitionTree] = useState<any>(null);
  const [loadingDefinition, setLoadingDefinition] = useState(false);

  // Load definition tree when message is selected
  useEffect(() => {
    if (selectedMessage && selectedMessage.type_name && protocol) {
      setLoadingDefinition(true);
      fetch(`/api/asn/protocols/${protocol}/types/${selectedMessage.type_name}/tree`)
        .then(res => res.json())
        .then(data => {
          setMessageDefinitionTree(data.tree || null);
          setMessageDataJson(JSON.stringify(selectedMessage.data || {}, null, 2));
        })
        .catch(err => {
          console.error('Failed to load definition tree:', err);
          setMessageDefinitionTree(null);
          setMessageDataJson(JSON.stringify(selectedMessage.data || {}, null, 2));
        })
        .finally(() => setLoadingDefinition(false));
    } else if (selectedMessage) {
      setMessageDataJson(JSON.stringify(selectedMessage.data || {}, null, 2));
      setMessageDefinitionTree(null);
    }
  }, [selectedMessage, protocol]);

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
          upToSelected.forEach((msg, idx) => {
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

  // Handle protocol change
  const handleProtocolChange = (value: string | null) => {
    if (!value) return;
    setProtocol(value);
    createSequence(state.currentSequence?.name || 'New Sequence', value, currentSessionId);
  };

  // Handle session change
  const handleSessionChange = async (sessionId: string | null) => {
    if (!sessionId) return;
    setCurrentSessionId(sessionId);
    // Reload sequences for the new session
    await loadAllSequences(sessionId);
    // Clear current sequence when switching sessions if it doesn't belong to new session
    if (state.currentSequence) {
      const belongsToSession = (state.currentSequence as any).session_id === sessionId;
      if (!belongsToSession) {
        // Clear selection
        setSelectedMsgIndex(null);
        setShowMessageDetail(false);
      }
    }
  };

  // Handle create new session
  const handleCreateSession = async () => {
    if (!newSessionName.trim()) return;
    
    try {
      const newSession = await mscSessionService.createSession(newSessionName.trim());
      setSessions([newSession, ...sessions]);
      setCurrentSessionId(newSession.id);
      setNewSessionName('');
      setShowCreateSessionModal(false);
    } catch (error) {
      console.error('Failed to create session:', error);
      alert('Failed to create session');
    }
  };

  // Handle delete session
  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Delete this session? All sequences in this session will be deleted.')) return;
    try {
      await mscSessionService.deleteSession(sessionId);
      setSessions(sessions.filter(s => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        // Switch to first available session or create default
        const remaining = sessions.filter(s => s.id !== sessionId);
        if (remaining.length > 0) {
          setCurrentSessionId(remaining[0].id);
        } else {
          // Create default session
          const defaultSession = await mscSessionService.createSession('Default Session', 'Main working session');
          setSessions([defaultSession]);
          setCurrentSessionId(defaultSession.id);
        }
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
      alert('Failed to delete session');
    }
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
          if (parsed && typeof parsed === 'object') {
            data = parsed;
          }
        } catch (e) {
          console.warn('Failed to parse message data JSON:', e);
          // Keep the fetched data if JSON parse fails
        }
      }
      
      await addMessage({
        type_name: newMsgType.trim(),
        data: data || {},
        source_actor: newMsgSource || 'UE',
        target_actor: newMsgTarget || 'gNB'
      });
      setShowAddMessage(false);
      setNewMsgType(null);
      setNewMsgData('{}');
    } catch (e: any) {
      console.error('Failed to add message:', e);
      const errorMessage = e?.response?.data?.detail || e?.message || 'Failed to add message';
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

  // Handle save to file
  const handleSaveToFile = () => {
    const data = exportSequence();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.currentSequence?.name || 'sequence'}.msc.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Handle import
  const handleImport = async () => {
    try {
      await importSequence(importData);
      setShowImportModal(false);
      setImportData('');
    } catch (e: any) {
      alert(`Import failed: ${e.message}`);
    }
  };

  // Handle load from file
  const handleLoadFromFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      try {
        await importSequence(content);
      } catch (error) {
        console.error('Failed to load:', error);
      }
    };
    reader.readAsText(file);
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
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="md">
            <ActionIcon variant="subtle" onClick={() => navigate('/')} title="Home">
              <IconHome size={20} />
            </ActionIcon>
            <Title order={4}>MSC Editor</Title>
            <Divider orientation="vertical" />
            <Select
              size="xs"
              value={protocol}
              onChange={handleProtocolChange}
              data={PROTOCOL_OPTIONS}
              style={{ width: 140 }}
            />
            <Group gap={4}>
              <Select
                size="xs"
                value={currentSessionId || ''}
                onChange={handleSessionChange}
                data={sessions.map(s => ({ value: s.id, label: s.name }))}
                placeholder="Select session"
                searchable
                style={{ width: 180 }}
              />
              <ActionIcon
                size="xs"
                variant="subtle"
                onClick={handleCreateSession}
                title="Create new session"
              >
                <IconPlus size={14} />
              </ActionIcon>
            </Group>
            <TextInput
              size="xs"
              label="Sequence name"
              value={localSequenceName}
              onChange={(e) => setLocalSequenceName(e.currentTarget.value)}
              onBlur={() => {
                // Save immediately on blur
                if (localSequenceName && localSequenceName !== state.currentSequence?.name) {
                  setSequenceName(localSequenceName);
                }
              }}
              placeholder="Enter sequence name"
              style={{ width: 160 }}
              aria-label="Sequence name"
            />
          </Group>
          
          <Group gap="xs">
            <ActionIcon variant="subtle" onClick={undo} disabled={!canUndo} title="Undo">
              <IconChevronLeft size={18} />
            </ActionIcon>
            <ActionIcon variant="subtle" onClick={redo} disabled={!canRedo} title="Redo">
              <IconChevronRight size={18} />
            </ActionIcon>
            <Divider orientation="vertical" />
            <ActionIcon variant="subtle" onClick={handleSaveToFile} title="Save">
              <IconDeviceFloppy size={18} />
            </ActionIcon>
            <ActionIcon variant="subtle" onClick={() => document.getElementById('load-file')?.click()} title="Load">
              <IconFileImport size={18} />
            </ActionIcon>
            <input id="load-file" type="file" accept=".json" style={{ display: 'none' }} onChange={handleLoadFromFile} />
            <Menu shadow="md" width={160}>
              <Menu.Target>
                <ActionIcon variant="subtle"><IconDots size={18} /></ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<IconPlus size={14} />} onClick={() => createSequence('New Sequence', protocol, currentSessionId)}>
                  New Sequence
                </Menu.Item>
                <Menu.Item leftSection={<IconUpload size={14} />} onClick={() => setShowImportModal(true)}>
                  Import JSON
                </Menu.Item>
                <Menu.Item leftSection={<IconDownload size={14} />} onClick={handleSaveToFile}>
                  Export JSON
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item leftSection={<IconTrash size={14} />} color="red" onClick={() => {
                  if (state.currentSequence && confirm('Delete this sequence?')) {
                    deleteSequence(state.currentSequence.id);
                  }
                }}>
                  Delete Sequence
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        <Box style={{ minHeight: 'calc(100vh - 50px)', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>

          {/* Main Content - MSC View and Detail Panel */}
          <Box style={{ flex: 1, display: 'flex', overflow: 'visible', minHeight: 0 }}>
            {/* MSC Diagram Panel */}
            <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'auto' }}>
              {/* Actor State Panel - Key Feature */}
              <Paper mx="md" mt="md" p="md" withBorder shadow="sm" style={{ backgroundColor: '#f8f9fa' }}>
                <Text size="xs" fw={700} c="dimmed" mb="sm" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                  Actor State at Message {selectedMsgIndex !== null ? selectedMsgIndex + 1 : '?'}
                </Text>
                <Group gap="md" align="flex-start" wrap="wrap">
                  {actorStates && actorStates.length > 0 ? (
                    actorStates.map(actorState => (
                      <Paper
                        key={actorState.actor}
                        p="sm"
                        withBorder
                        radius="md"
                        style={{
                          flex: 1,
                          minWidth: 280,
                          maxWidth: 400,
                          height: 300,
                          display: 'flex',
                          flexDirection: 'column',
                          backgroundColor: 'white',
                          borderLeft: `4px solid ${ACTOR_COLORS[actorState.actor] || '#64748b'}`,
                        }}
                      >
                        {/* Header - Fixed */}
                        <Group gap="xs" mb="xs" style={{ flexShrink: 0 }}>
                          <ThemeIcon 
                            size="md" 
                            radius="xl" 
                            style={{ backgroundColor: ACTOR_COLORS[actorState.actor] || '#64748b' }}
                          >
                            <Text size="xs" c="white" fw={700}>{actorState.actor.charAt(0)}</Text>
                          </ThemeIcon>
                          <Text size="sm" fw={700}>{actorState.actor}</Text>
                          {actorState.state && (
                            <Badge size="sm" variant="light" color="blue">
                              {actorState.state}
                            </Badge>
                          )}
                        </Group>
                        
                        {/* Scrollable Content */}
                        <ScrollArea style={{ flex: 1, minHeight: 0 }}>
                          <Stack gap="xs">
                                {actorState.configurationIds.length > 0 && (
                              <Box>
                                <Text size="xs" fw={600} c="dimmed" mb={4}>Configuration IDs:</Text>
                                <Group gap="xs" wrap="wrap">
                                  {actorState.configurationIds.map((configId, idx) => (
                                    <Badge key={idx} size="xs" variant="dot" color="blue">
                                      {configId}
                                    </Badge>
                                  ))}
                                </Group>
                              </Box>
                            )}
                            
                            {actorState.configurations.length > 0 && (
                              <Box>
                                <Text size="xs" fw={600} c="dimmed" mb={4}>Tracked Identifiers & Configurations:</Text>
                                <Stack gap="xs">
                                  {actorState.configurations.map((config, idx) => (
                                    <Paper key={idx} p="xs" withBorder radius="sm" style={{ backgroundColor: '#f8f9fa' }}>
                                      <Group gap="xs" justify="space-between" mb={4}>
                                        <Text size="xs" fw={600} style={{ fontFamily: 'monospace' }}>
                                          {config.name}
                                        </Text>
                                        <Badge 
                                          size="xs" 
                                          variant="light" 
                                          color={config.isConsistent ? 'green' : 'red'}
                                        >
                                          {config.isConsistent ? '✓ Consistent' : '✗ Inconsistent'}
                                        </Badge>
                                      </Group>
                                      {config.currentValue !== undefined && (
                                        <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace' }}>
                                          Value: {typeof config.currentValue === 'object' 
                                            ? JSON.stringify(config.currentValue).substring(0, 50) + '...'
                                            : String(config.currentValue)}
                                        </Text>
                                      )}
                                      {config.conflicts && config.conflicts.length > 0 && (
                                        <Text size="xs" c="red" mt={4}>
                                          Conflicts: {config.conflicts.join(', ')}
                                        </Text>
                                      )}
                                      <Text size="xs" c="dimmed" mt={2}>
                                        Seen in {Object.keys(config.values).length} message(s)
                                      </Text>
                                    </Paper>
                                  ))}
                                </Stack>
                              </Box>
                            )}
                            
                            {Object.keys(actorState.identifiers).length > 0 && (
                              <Box>
                                <Text size="xs" fw={600} c="dimmed" mb={4}>Additional Identifiers:</Text>
                                <Stack gap="xs">
                                  {Object.entries(actorState.identifiers)
                                    .filter(([key]) => !actorState.configurations.some(c => c.name === key))
                                    .map(([key, val]) => (
                                      <Group key={key} gap="xs" justify="space-between" wrap="nowrap">
                                        <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace', flex: 1, minWidth: 0 }}>
                                          {key}:
                                        </Text>
                                        <Group gap="xs" wrap="nowrap">
                                          {val.isConsistent === false && (
                                            <Badge size="xs" variant="light" color="red">Inconsistent</Badge>
                                          )}
                                          <Badge size="xs" variant="light" color="gray">
                                            {typeof val.value === 'object' 
                                              ? JSON.stringify(val.value).substring(0, 20) + '...'
                                              : String(val.value).substring(0, 30)}
                                          </Badge>
                                        </Group>
                                      </Group>
                                    ))}
                                </Stack>
                              </Box>
                            )}
                            
                            {Object.keys(actorState.identifiers).length === 0 && actorState.configurations.length === 0 && (
                              <Text size="xs" c="dimmed" mt="xs" style={{ fontStyle: 'italic', textAlign: 'center' }}>
                                No state information yet
                              </Text>
                            )}
                          </Stack>
                        </ScrollArea>
                      </Paper>
                    ))
                  ) : (
                    <Group justify="space-around" style={{ width: '100%' }}>
                      {actors.map(actor => (
                        <Paper
                          key={actor}
                          p="sm"
                          withBorder
                          radius="md"
                          style={{
                            minWidth: 200,
                            height: 300,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: 'white',
                            borderLeft: `4px solid ${ACTOR_COLORS[actor] || '#64748b'}`,
                          }}
                        >
                          <ThemeIcon 
                            size="lg" 
                            radius="xl" 
                            style={{ backgroundColor: ACTOR_COLORS[actor] || '#64748b' }}
                          >
                            <Text size="xs" c="white" fw={700}>{actor.charAt(0)}</Text>
                          </ThemeIcon>
                          <Text size="sm" fw={600} mt={4}>{actor}</Text>
                          <Text size="xs" c="dimmed" mt={2}>No state yet</Text>
                        </Paper>
                      ))}
                    </Group>
                  )}
                </Group>
              </Paper>

              {/* Messages List */}
              <ScrollArea style={{ flex: 1 }} mx="md" mt="xs">
                <Stack gap="xs" pb="md">
                  {state.currentSequence?.messages.map((msg: any, index) => {
                    const typeName = msg.typeName || msg.type_name || msg.type || 'Unknown';
                    const source = msg.sourceActor || msg.source_actor || 'UE';
                    const target = msg.targetActor || msg.target_actor || 'gNB';
                    const isSelected = selectedMsgIndex === index;
                    const hasErrors = msg.validationErrors?.some(e => e.type === 'error');
                    const sourceIdx = actors.indexOf(source);
                    const targetIdx = actors.indexOf(target);
                    const isLeftToRight = sourceIdx < targetIdx;

                    return (
                      <Paper
                        key={msg.id || index}
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
              <Paper 
                style={{ 
                  width: 500, 
                  borderLeft: '1px solid #e5e7eb', 
                  display: 'flex', 
                  flexDirection: 'column',
                  maxHeight: 'calc(100vh - 50px)',
                  overflow: 'hidden'
                }}
              >
                <Group justify="space-between" p="sm" style={{ borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
                  <Text size="sm" fw={600}>
                    {(selectedMessage as any).typeName || selectedMessage.type_name || selectedMessage.type || 'Message Details'}
                  </Text>
                  <ActionIcon variant="subtle" onClick={() => {
                    setShowMessageDetail(false);
                    setSelectedMsgIndex(null);
                  }}>
                    <IconX size={16} />
                  </ActionIcon>
                </Group>
                
                <ScrollArea style={{ flex: 1, minHeight: 0 }} p="sm">
                  <Stack gap="md">
                    {/* Direction */}
                    <Box>
                      <Text size="xs" c="dimmed" mb={4}>Direction</Text>
                      <Group gap="xs">
                        <Badge color="blue">{selectedMessage.sourceActor || selectedMessage.source_actor}</Badge>
                        <IconArrowRight size={14} />
                        <Badge color="red">{selectedMessage.targetActor || selectedMessage.target_actor}</Badge>
                      </Group>
                    </Box>
                    
                    {/* JSON Editor - Same as Main Window */}
                    <Box>
                      <Group justify="space-between" mb="xs">
                        <Text size="sm" fw={500}>Message Data</Text>
                        <SegmentedControl
                          size="xs"
                          value={editorMode}
                          onChange={(v) => setEditorMode(v as 'structured' | 'raw')}
                          data={[
                            { label: 'Structured', value: 'structured' },
                            { label: 'Raw JSON', value: 'raw' }
                          ]}
                        />
                      </Group>
                      
                      {loadingDefinition && (
                        <Paper p="md" withBorder style={{ textAlign: 'center' }}>
                          <Loader size="sm" />
                          <Text size="xs" c="dimmed" mt="xs">Loading schema...</Text>
                        </Paper>
                      )}
                      
                      {!loadingDefinition && editorMode === 'structured' && (
                        <Paper withBorder={false} style={{ minHeight: 300, display: 'flex', flexDirection: 'column' }}>
                          <ScrollArea.Autosize mah={500} type="auto" offsetScrollbars>
                            <StructuredJsonEditor 
                              data={selectedMessage.data || {}} 
                              schema={messageDefinitionTree}
                              onChange={(newData) => {
                                // Update message data
                                if (state.currentSequence && selectedMsgIndex !== null) {
                                  const updatedMessage = {
                                    ...selectedMessage,
                                    data: newData
                                  };
                                  // Update via backend
                                  // Note: This would need to call updateSequence or a message update endpoint
                                  setMessageDataJson(JSON.stringify(newData, null, 2));
                                }
                              }}
                            />
                          </ScrollArea.Autosize>
                        </Paper>
                      )}
                      
                      {!loadingDefinition && editorMode === 'raw' && (
                        <JsonInput
                          placeholder='{ "field": "value" }'
                          value={messageDataJson}
                          onChange={(val) => {
                            setMessageDataJson(val);
                            try {
                              const parsed = JSON.parse(val);
                              // Update message data
                              if (state.currentSequence && selectedMsgIndex !== null) {
                                const updatedMessage = {
                                  ...selectedMessage,
                                  data: parsed
                                };
                                // Update via backend
                                setMessageDataJson(val);
                              }
                            } catch (e) {
                              // Invalid JSON, keep the text but don't update data
                            }
                          }}
                          formatOnBlur
                          autosize
                          minRows={10}
                          maxRows={25}
                          validationError="Invalid JSON"
                        />
                      )}
                    </Box>
                    
                    {/* Validation Errors */}
                    {selectedMessage.validationErrors && selectedMessage.validationErrors.length > 0 && (
                      <Box>
                        <Text size="xs" c="dimmed" mb={4}>Validation Issues</Text>
                        <Stack gap="xs">
                          {selectedMessage.validationErrors.map((err, i) => (
                            <Alert 
                              key={i} 
                              color={err.type === 'error' ? 'red' : 'yellow'} 
                              p="xs"
                              icon={<IconAlertCircle size={14} />}
                            >
                              <Text size="xs">{err.message}</Text>
                            </Alert>
                          ))}
                        </Stack>
                      </Box>
                    )}
                  </Stack>
                </ScrollArea>
                
                <Group p="sm" style={{ borderTop: '1px solid #e5e7eb', flexShrink: 0 }}>
                  <Button 
                    size="xs" 
                    variant="light"
                    onClick={() => {
                      // Save changes
                      if (state.currentSequence && selectedMsgIndex !== null) {
                        try {
                          const data = editorMode === 'raw' ? JSON.parse(messageDataJson) : selectedMessage.data;
                          // Update message via backend
                          // This would need proper message update endpoint
                        } catch (e) {
                          console.error('Failed to save message:', e);
                        }
                      }
                    }}
                  >
                    Save Changes
                  </Button>
                  <Button 
                    size="xs" 
                    variant="light" 
                    color="red"
                    leftSection={<IconTrash size={14} />}
                    onClick={() => {
                      if (confirm('Delete this message?')) {
                        removeMessage(selectedMessage.id);
                        setShowMessageDetail(false);
                        setSelectedMsgIndex(null);
                      }
                    }}
                  >
                    Delete
                  </Button>
                </Group>
              </Paper>
            )}
          </Box>
        </Box>
      </AppShell.Main>

      {/* Import Modal */}
      <Modal opened={showImportModal} onClose={() => setShowImportModal(false)} title="Import Sequence">
        <Stack>
          <Textarea
            placeholder="Paste JSON..."
            value={importData}
            onChange={(e) => setImportData(e.currentTarget.value)}
            minRows={10}
            styles={{ input: { fontFamily: 'monospace', fontSize: '12px' } }}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setShowImportModal(false)}>Cancel</Button>
            <Button onClick={handleImport} disabled={!importData.trim()}>Import</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Error Alert */}
      {state.error && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          color="red"
          title="Error"
          style={{ position: 'fixed', bottom: 16, right: 16, maxWidth: 400, zIndex: 1000 }}
          withCloseButton
          onClose={clearValidation}
        >
          {state.error}
        </Alert>
      )}

      {/* Create Session Modal */}
      <Modal
        opened={showCreateSessionModal}
        onClose={() => {
          setShowCreateSessionModal(false);
          setNewSessionName('');
        }}
        title="Create New Session"
        size="sm"
      >
        <Stack gap="md">
          <TextInput
            label="Session Name"
            placeholder="Enter session name"
            value={newSessionName}
            onChange={(e) => setNewSessionName(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newSessionName.trim()) {
                handleCreateSession();
              }
            }}
            autoFocus
          />
          <Group justify="flex-end">
            <Button
              variant="subtle"
              onClick={() => {
                setShowCreateSessionModal(false);
                setNewSessionName('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateSession}
              disabled={!newSessionName.trim()}
            >
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>
    </AppShell>
  );
};

MscEditor.displayName = 'MscEditor';

export default MscEditor;

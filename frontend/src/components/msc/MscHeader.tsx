import React, { useState } from 'react';
import {
    AppShell,
    Group,
    Title,
    Select,
    Button,
    ActionIcon,
    Menu,
    Divider,
    Modal,
    Stack,
    TextInput,
    Textarea
} from '@mantine/core';
import {
    IconHome,
    IconPlus,
    IconTrash,
    IconDownload,
    IconUpload,
    IconDeviceFloppy,
    IconDots,
    IconFileImport,
    IconChevronLeft,
    IconChevronRight
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../hooks/useSession';
import type { MscSequence } from '../../domain/msc/types';

const PROTOCOL_OPTIONS = [
    { value: 'rrc_demo', label: 'RRC Demo' },
    { value: 'nr_rel17_rrc', label: 'NR RRC Rel-17' },
    { value: 'multi_file_demo', label: 'Multi-File Demo' },
];

interface MscHeaderProps {
    protocol: string;
    setProtocol: (val: string) => void;
    currentSequence: MscSequence | null;
    createSequence: (name: string, protocol: string, sessionId?: string | null) => Promise<MscSequence>;
    deleteSequence: (id: string) => Promise<boolean>;
    exportSequence: () => string;
    importSequence: (data: string) => Promise<any>;
    canUndo: boolean;
    canRedo: boolean;
    undo: () => void;
    redo: () => void;
    sequenceName?: string;
    onSequenceNameChange?: (name: string) => void;
}

export const MscHeader: React.FC<MscHeaderProps> = ({
    protocol,
    setProtocol,
    currentSequence,
    createSequence,
    deleteSequence,
    exportSequence,
    importSequence,
    canUndo,
    canRedo,
    undo,
    redo,
    sequenceName,
    onSequenceNameChange
}) => {
    const navigate = useNavigate();
    const { sessions, currentSessionId, switchSession, createSession, deleteSession } = useSession();

    // Session Modal State
    const [newSessionName, setNewSessionName] = useState('');
    const [showCreateSessionModal, setShowCreateSessionModal] = useState(false);

    // Import Modal State
    const [showImportModal, setShowImportModal] = useState(false);
    const [importData, setImportData] = useState('');

    // Handle session change
    const handleSessionChange = (sessionId: string | null) => {
        if (!sessionId) return;
        switchSession(sessionId);
    };

    // Handle create new session
    const handleCreateSession = async () => {
        if (!newSessionName.trim()) return;

        try {
            const newSession = await createSession(newSessionName.trim());
            // Switch to new session (will reload page)
            switchSession(newSession.id);
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
            await deleteSession(sessionId);
        } catch (error) {
            console.error('Failed to delete session:', error);
            alert('Failed to delete session');
        }
    };

    // Handle protocol change
    const handleProtocolChange = (value: string | null) => {
        if (!value) return;
        setProtocol(value);
        createSequence(currentSequence?.name || 'New Sequence', value, currentSessionId);
    };

    // Handle save to file
    const handleSaveToFile = () => {
        const data = exportSequence();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentSequence?.name || 'sequence'}.msc.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleLoadFromFile = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const content = e.target?.result as string;
                await importSequence(content);
                // Reset file input
                event.target.value = '';
            } catch (err: any) {
                alert('Failed to load sequence: ' + err.message);
            }
        };
        reader.readAsText(file);
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

    return (
        <AppShell.Header p="md">
            <Group justify="space-between">
                <Group>
                    <ActionIcon variant="light" size="lg" onClick={() => navigate('/')}>
                        <IconHome size={20} />
                    </ActionIcon>
                    <Title order={3}>MSC Editor</Title>
                    {currentSequence && (
                        <TextInput
                            size="xs"
                            placeholder="Sequence Name"
                            value={sequenceName || ''}
                            onChange={(e) => onSequenceNameChange?.(e.currentTarget.value)}
                            style={{ width: 200 }}
                            aria-label="Sequence name"
                        />
                    )}
                </Group>

                <Group>
                    <Select
                        placeholder="Select Protocol"
                        data={PROTOCOL_OPTIONS}
                        value={protocol}
                        onChange={handleProtocolChange}
                        style={{ width: 140 }}
                    />
                    <Group gap={4}>
                        <Select
                            placeholder="Session"
                            data={sessions.map(s => ({ value: s.id, label: s.name }))}
                            value={currentSessionId}
                            onChange={handleSessionChange}
                            style={{ width: 160 }}
                            allowDeselect={false}
                            rightSection={
                                currentSessionId && (
                                    <ActionIcon
                                        size="sm"
                                        color="red"
                                        variant="subtle"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteSession(currentSessionId);
                                        }}
                                    >
                                        <IconTrash size={14} />
                                    </ActionIcon>
                                )
                            }
                        />
                        <ActionIcon variant="light" size="lg" onClick={() => setShowCreateSessionModal(true)} title="New Session">
                            <IconPlus size={18} />
                        </ActionIcon>
                    </Group>

                    <Divider orientation="vertical" />

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
                                if (currentSequence && confirm('Delete this sequence?')) {
                                    deleteSequence(currentSequence.id);
                                }
                            }}>
                                Delete Sequence
                            </Menu.Item>
                        </Menu.Dropdown>
                    </Menu>
                </Group>
            </Group>

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
        </AppShell.Header>
    );
};

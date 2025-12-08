import { useState, useEffect } from 'react';
import { Paper, Textarea, Group, Button, Text, Collapse, ActionIcon, Stack } from '@mantine/core';
import { IconDeviceFloppy, IconTrash, IconChevronDown, IconChevronRight, IconNote } from '@tabler/icons-react';
import { useDebouncedValue } from '@mantine/hooks';
import axios from 'axios';
import { useSession } from '../hooks/useSession';

export function ScratchpadPanel() {
    const { currentSessionId } = useSession();
    const [content, setContent] = useState('');
    const [opened, setOpened] = useState(() => {
        return localStorage.getItem('asn-scratchpad-opened') === 'true';
    });
    const [loading, setLoading] = useState(true);

    // Load from backend on mount or session change
    useEffect(() => {
        if (!currentSessionId) return;
        setLoading(true);
        axios.get(`/api/sessions/${currentSessionId}/scratchpad`)
            .then(res => {
                setContent(res.data.content || '');
            })
            .catch(() => {
                setContent('');
            })
            .finally(() => setLoading(false));
    }, [currentSessionId]);

    // Auto-save to backend (debounced)
    const [debouncedContent] = useDebouncedValue(content, 1000);
    useEffect(() => {
        if (loading || !currentSessionId) return;
        axios.put(`/api/sessions/${currentSessionId}/scratchpad`, { content: debouncedContent })
            .catch(console.error);
    }, [debouncedContent, loading, currentSessionId]);

    useEffect(() => {
        localStorage.setItem('asn-scratchpad-opened', String(opened));
    }, [opened]);

    const handleSave = async () => {
        if (!currentSessionId) return;
        try {
            await axios.put(`/api/sessions/${currentSessionId}/scratchpad`, { content });
        } catch (e) {
            console.error('Failed to save scratchpad:', e);
        }
    };

    return (
        <Paper withBorder p="sm" mt="md">
            <Group justify="space-between" onClick={() => setOpened(!opened)} style={{ cursor: 'pointer' }}>
                <Group gap="xs">
                    <IconNote size="1rem" />
                    <Text fw={600}>Scratchpad</Text>
                </Group>
                <ActionIcon variant="subtle" color="gray">
                    {opened ? <IconChevronDown /> : <IconChevronRight />}
                </ActionIcon>
            </Group>
            <Collapse in={opened}>
                <Stack mt="sm">
                    <Textarea
                        value={content}
                        onChange={(e) => setContent(e.currentTarget.value)}
                        autosize
                        minRows={5}
                        maxRows={15}
                        placeholder="Paste values, write notes here. Content is saved automatically."
                        style={{ fontFamily: 'monospace' }}
                    />
                    <Group justify="flex-end">
                        <Button variant="default" size="xs" onClick={handleSave} leftSection={<IconDeviceFloppy size="0.8rem" />}>Save</Button>
                        <Button variant="subtle" color="red" size="xs" onClick={() => setContent('')} leftSection={<IconTrash size="0.8rem" />}>Clear</Button>
                    </Group>
                </Stack>
            </Collapse>
        </Paper>
    );
}

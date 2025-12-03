import { useState, useEffect } from 'react';
import { Paper, Textarea, Group, Button, Text, FileButton, Collapse, ActionIcon, Stack } from '@mantine/core';
import { IconDownload, IconUpload, IconTrash, IconChevronDown, IconChevronRight, IconNote } from '@tabler/icons-react';
import { useDebouncedValue } from '@mantine/hooks';

export function ScratchpadPanel() {
    const [content, setContent] = useState('');
    const [opened, setOpened] = useState(() => {
        return localStorage.getItem('asn-scratchpad-opened') === 'true';
    });

    useEffect(() => {
        const saved = localStorage.getItem('asn-scratchpad');
        if (saved) setContent(saved);
    }, []);

    const [debouncedContent] = useDebouncedValue(content, 1000);
    useEffect(() => {
        localStorage.setItem('asn-scratchpad', debouncedContent);
    }, [debouncedContent]);

    useEffect(() => {
        localStorage.setItem('asn-scratchpad-opened', String(opened));
    }, [opened]);

    const handleDownload = () => {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'scratchpad.txt';
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleUpload = (file: File | null) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
             const text = e.target?.result as string;
             setContent(text); 
        };
        reader.readAsText(file);
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
                         <FileButton onChange={handleUpload} accept="text/plain">
                            {(props) => <Button {...props} variant="default" size="xs" leftSection={<IconUpload size="0.8rem"/>}>Load</Button>}
                         </FileButton>
                         <Button variant="default" size="xs" onClick={handleDownload} leftSection={<IconDownload size="0.8rem"/>}>Save to File</Button>
                         <Button variant="subtle" color="red" size="xs" onClick={() => setContent('')} leftSection={<IconTrash size="0.8rem"/>}>Clear</Button>
                    </Group>
                </Stack>
            </Collapse>
        </Paper>
    );
}








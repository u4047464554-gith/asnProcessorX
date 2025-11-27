import { Modal, Button, Stack, Group, Title, Text, TagsInput } from '@mantine/core';
import { useState, useEffect } from 'react';
import axios from 'axios';

interface SettingsModalProps {
    opened: boolean;
    onClose: () => void;
}

export function SettingsModal({ opened, onClose }: SettingsModalProps) {
    const [specsDirs, setSpecsDirs] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (opened) {
            setLoading(true);
            axios.get('/api/config/')
                .then(res => {
                    setSpecsDirs(res.data.specs_directories);
                    setError(null);
                })
                .catch(err => setError(err.message))
                .finally(() => setLoading(false));
        }
    }, [opened]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await axios.put('/api/config/', {
                specs_directories: specsDirs
            });
            onClose();
            // Reload page to refresh protocols? Or just trigger a refresh callback.
            // For simplicity, we'll let the user know they might need to refresh protocols.
            window.location.reload(); 
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal opened={opened} onClose={onClose} title="Settings" size="lg">
            <Stack>
                <Title order={5}>ASN.1 Specifications</Title>
                <Text size="sm" c="dimmed">
                    Add directories where your .asn files are located. The backend will scan these recursively.
                </Text>
                
                <TagsInput
                    label="Spec Directories"
                    placeholder="Press Enter to add path"
                    value={specsDirs}
                    onChange={setSpecsDirs}
                    disabled={loading}
                />

                {error && <Text c="red" size="sm">{error}</Text>}

                <Group justify="flex-end" mt="md">
                    <Button variant="default" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} loading={saving}>Save & Reload</Button>
                </Group>
            </Stack>
        </Modal>
    );
}

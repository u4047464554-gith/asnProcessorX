import { Modal, Button, Stack, Group, Title, Text, TagsInput, Select, Divider, NumberInput } from '@mantine/core';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { themes } from '../theme';

interface SettingsModalProps {
    opened: boolean;
    onClose: () => void;
    currentTheme: string;
    onThemeChange: (theme: string) => void;
}

export function SettingsModal({ opened, onClose, currentTheme, onThemeChange }: SettingsModalProps) {
    const [specsDirs, setSpecsDirs] = useState<string[]>([]);
    const [splashDuration, setSplashDuration] = useState<number>(3);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (opened) {
            setLoading(true);
            axios.get('/api/config/')
                .then(res => {
                    setSpecsDirs(res.data.specs_directories);
                    setSplashDuration((res.data.splash_duration || 3000) / 1000);
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
                specs_directories: specsDirs,
                splash_duration: splashDuration * 1000
            });
            onClose();
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
                <Title order={5}>User Interface</Title>
                <Select 
                    label="Theme"
                    data={Object.keys(themes)}
                    value={currentTheme}
                    onChange={(val) => val && onThemeChange(val)}
                />
                <NumberInput
                    label="Splash Screen Duration (seconds)"
                    value={splashDuration}
                    onChange={(val) => setSplashDuration(Number(val))}
                    min={0}
                    max={60}
                />

                <Divider my="sm" />

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

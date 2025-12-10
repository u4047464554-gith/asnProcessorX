import { Modal, Button, Stack, Group, Title, Text, TagsInput, Select, Divider, NumberInput, Alert } from '@mantine/core';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { themes } from '../theme';
import { IconAlertTriangle, IconCheck } from '@tabler/icons-react';

interface SettingsModalProps {
    opened: boolean;
    onClose: () => void;
    currentTheme: string;
    onThemeChange: (theme: string) => void;
}

interface CompilationErrors {
    [protocol: string]: string;
}

export function SettingsModal({ opened, onClose, currentTheme, onThemeChange }: SettingsModalProps) {
    const [specsDirs, setSpecsDirs] = useState<string[]>([]);
    const [splashDuration, setSplashDuration] = useState<number>(3);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [compilationErrors, setCompilationErrors] = useState<CompilationErrors | null>(null);
    const [compilationSuccess, setCompilationSuccess] = useState(false);

    useEffect(() => {
        if (opened) {
            setLoading(true);
            setCompilationErrors(null);
            setCompilationSuccess(false);
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
        setCompilationErrors(null);
        setCompilationSuccess(false);
        try {
            const response = await axios.put('/api/config/', {
                specs_directories: specsDirs,
                splash_duration: splashDuration * 1000
            });

            const data = response.data;

            // Check for compilation errors
            if (data.compilation_status === 'warning' && data.compilation_errors) {
                setCompilationErrors(data.compilation_errors);
                // Don't close modal - let user see the errors
                setError(null);
            } else if (data.compilation_status === 'success') {
                setCompilationSuccess(true);
                // Close and reload after a short delay
                setTimeout(() => {
                    onClose();
                    window.location.reload();
                }, 1500);
            } else {
                onClose();
                window.location.reload();
            }
        } catch (err: any) {
            setError(err.response?.data?.detail || err.message);
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

                <Group justify="space-between" align="center">
                    <Title order={5}>ASN.1 Specifications</Title>
                    <Button variant="subtle" size="xs" onClick={() => {
                        if (!specsDirs.includes('asn_specs')) {
                            setSpecsDirs([...specsDirs, 'asn_specs']);
                        }
                    }}>
                        Restore Default Protocols
                    </Button>
                </Group>
                <Text size="sm" c="dimmed">
                    Add directories where your .asn files are located. Each subdirectory will be treated as a protocol.
                </Text>

                <TagsInput
                    label="Spec Directories"
                    placeholder="Press Enter to add path"
                    value={specsDirs}
                    onChange={setSpecsDirs}
                    disabled={loading}
                />

                {error && <Text c="red" size="sm">{error}</Text>}

                {compilationSuccess && (
                    <Alert icon={<IconCheck size={16} />} title="Success" color="green">
                        All specifications compiled successfully. Reloading...
                    </Alert>
                )}

                {compilationErrors && Object.keys(compilationErrors).length > 0 && (
                    <Alert icon={<IconAlertTriangle size={16} />} title="Compilation Errors" color="orange">
                        <Text size="sm" mb="xs">
                            The following protocols failed to compile. Check your ASN.1 syntax:
                        </Text>
                        {Object.entries(compilationErrors).map(([protocol, errorMsg]) => (
                            <div key={protocol} style={{ marginBottom: '8px' }}>
                                <Text size="sm" fw={600}>{protocol}:</Text>
                                <Text size="xs" c="dimmed" style={{
                                    fontFamily: 'monospace',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                    maxHeight: '100px',
                                    overflow: 'auto',
                                    backgroundColor: 'var(--mantine-color-dark-6)',
                                    padding: '4px 8px',
                                    borderRadius: '4px'
                                }}>
                                    {errorMsg}
                                </Text>
                            </div>
                        ))}
                    </Alert>
                )}

                <Group justify="flex-end" mt="md">
                    <Button variant="default" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} loading={saving}>Save & Reload</Button>
                </Group>
            </Stack>
        </Modal>
    );
}


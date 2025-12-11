import { Modal, Button, Stack, Group, Title, Text, TagsInput, Select, Divider, NumberInput, Alert } from '@mantine/core';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { themes } from '../theme';
import { IconAlertTriangle, IconCheck, IconInfoCircle } from '@tabler/icons-react';

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
    const [asnExtensions, setAsnExtensions] = useState<string[]>([]);
    const [splashDuration, setSplashDuration] = useState<number>(3);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [compilationErrors, setCompilationErrors] = useState<CompilationErrors | null>(null);
    const [compilationWarnings, setCompilationWarnings] = useState<string[] | null>(null);
    const [compilationSuccess, setCompilationSuccess] = useState(false);

    useEffect(() => {
        if (opened) {
            setLoading(true);
            setCompilationErrors(null);
            setCompilationWarnings(null);
            setCompilationSuccess(false);
            axios.get('/api/config/')
                .then(res => {
                    setSpecsDirs(res.data.specs_directories);
                    setAsnExtensions(res.data.asn_extensions || ['.asn', '.asn1']);
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
        setCompilationWarnings(null);
        setCompilationSuccess(false);
        try {
            const response = await axios.put('/api/config/', {
                specs_directories: specsDirs,
                asn_extensions: asnExtensions,
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
                // Show warnings if any
                if (data.compilation_warnings && data.compilation_warnings.length > 0) {
                    setCompilationWarnings(data.compilation_warnings);
                } else {
                    // Close and reload after a short delay (only if no warnings to show)
                    setTimeout(() => {
                        onClose();
                        window.location.reload();
                    }, 1500);
                }
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
                    Add directories where your .asn files are located, or full paths to single files.
                </Text>

                <TagsInput
                    label="Spec Directories"
                    placeholder="Press Enter to add path"
                    value={specsDirs}
                    onChange={setSpecsDirs}
                    disabled={loading}
                />

                <TagsInput
                    label="ASN File Extensions"
                    placeholder="e.g. .asn, .asn1, .txt"
                    description="File extensions to treat as ASN.1 specifications"
                    value={asnExtensions}
                    onChange={setAsnExtensions}
                    disabled={loading}
                    mt="sm"
                />

                {error && <Text c="red" size="sm">{error}</Text>}

                {compilationSuccess && !compilationWarnings && (
                    <Alert icon={<IconCheck size={16} />} title="Success" color="green">
                        All specifications compiled successfully. Reloading...
                    </Alert>
                )}

                {compilationWarnings && compilationWarnings.length > 0 && (
                    <Alert
                        icon={<IconInfoCircle size={16} />}
                        title="Compilation Warnings - Missing Imports"
                        color="blue"
                        withCloseButton
                        onClose={() => {
                            setCompilationWarnings(null);
                            // Now that user has seen warnings, reload
                            onClose();
                            window.location.reload();
                        }}
                    >
                        <Text size="sm" mb="xs">
                            Some types were resolved implicitly across modules. Consider adding explicit IMPORTS:
                        </Text>
                        {compilationWarnings.map((warning, index) => (
                            <Text key={index} size="xs" style={{
                                fontFamily: 'monospace',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                backgroundColor: 'var(--mantine-color-dark-6)',
                                padding: '8px',
                                borderRadius: '4px',
                                marginBottom: index < compilationWarnings.length - 1 ? '8px' : 0
                            }}>
                                {warning}
                            </Text>
                        ))}
                        <Group justify="flex-end" mt="sm">
                            <Button size="xs" onClick={() => {
                                setCompilationWarnings(null);
                                onClose();
                                window.location.reload();
                            }}>
                                Dismiss & Reload
                            </Button>
                        </Group>
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


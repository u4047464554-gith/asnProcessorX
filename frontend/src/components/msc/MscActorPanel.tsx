import React from 'react';
import {
    Paper,
    Text,
    Group,
    ThemeIcon,
    Badge,
    ScrollArea,
    Stack,
    Box
} from '@mantine/core';

export interface ActorState {
    actor: string;
    identifiers: Record<string, any>;
    configurationIds: string[];
    lastMessage: any;
    state: string | null;
    configurations: Array<{
        id: string;
        name: string;
        values: any;
        isConsistent: boolean;
        conflicts: string[];
        currentValue?: any;
    }>;
}

interface MscActorPanelProps {
    actorStates: ActorState[] | null;
    selectedMessageIndex: number | null;
    actorColors: Record<string, string>;
    actors: string[];
}

export const MscActorPanel: React.FC<MscActorPanelProps> = ({
    actorStates,
    selectedMessageIndex,
    actorColors,
    actors
}) => {
    return (
        <Paper mx="md" mt="md" p="md" withBorder shadow="sm" style={{ backgroundColor: '#f8f9fa' }}>
            <Text size="xs" fw={700} c="dimmed" mb="sm" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                Actor State at Message {selectedMessageIndex !== null ? selectedMessageIndex + 1 : '?'}
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
                                borderLeft: `4px solid ${actorColors[actorState.actor] || '#64748b'}`,
                            }}
                        >
                            {/* Header - Fixed */}
                            <Group gap="xs" mb="xs" style={{ flexShrink: 0 }}>
                                <ThemeIcon
                                    size="md"
                                    radius="xl"
                                    style={{ backgroundColor: actorColors[actorState.actor] || '#64748b' }}
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
                            <Box key={actor} style={{ textAlign: 'center', opacity: 0.5 }}>
                                <ThemeIcon
                                    size="xl"
                                    radius="xl"
                                    style={{ backgroundColor: actorColors[actor] || '#64748b', marginBottom: 8 }}
                                >
                                    <Text size="md" c="white" fw={700}>{actor.charAt(0)}</Text>
                                </ThemeIcon>
                                <Text fw={700}>{actor}</Text>
                                <Text size="xs" c="dimmed">No state</Text>
                            </Box>
                        ))}
                    </Group>
                )}
            </Group>
        </Paper>
    );
};

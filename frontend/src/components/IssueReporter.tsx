import { ActionIcon, Menu, Button, Text, Stack, CopyButton, Tooltip, Code, ScrollArea } from '@mantine/core';
import { IconBug, IconCopy, IconCheck, IconAlertCircle } from '@tabler/icons-react';
import { useState } from 'react';

interface IssueReporterProps {
    error?: Error | string | null;
    context?: Record<string, any>;
    size?: 'xs' | 'sm' | 'md' | 'lg';
}

/**
 * Simple issue reporter component
 * Generates diagnostic info that users can copy and paste
 */
export function IssueReporter({ error, context, size = 'sm' }: IssueReporterProps) {
    const [menuOpened, setMenuOpened] = useState(false);

    // Get diagnostic information
    const getDiagnosticInfo = () => {
        const info = {
            timestamp: new Date().toISOString(),
            version: '0.3.0',
            userAgent: navigator.userAgent,
            url: window.location.href,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            error: error ? (error instanceof Error ? {
                message: error.message,
                stack: error.stack
            } : error) : 'No error captured',
            context: context || {},
        };

        return `ASN Processor Issue Report
Generated: ${info.timestamp}

Version: ${info.version}
Browser: ${info.userAgent}
URL: ${info.url}
Viewport: ${info.viewport}

${error ? `Error: ${error instanceof Error ? error.message : error}

Stack Trace:
${error instanceof Error ? error.stack : 'N/A'}
` : ''}
${Object.keys(context || {}).length > 0 ? `
Additional Context:
${JSON.stringify(context, null, 2)}
` : ''}

Please describe what you were doing when this occurred:
[Your description here]
`;
    };

    const diagnosticText = getDiagnosticInfo();

    return (
        <Menu opened={menuOpened} onChange={setMenuOpened} position="bottom-end" withinPortal shadow="md">
            <Menu.Target>
                <Tooltip label="Report an issue" withinPortal>
                    <ActionIcon
                        variant="subtle"
                        color={error ? 'red' : 'gray'}
                        size={size}
                        aria-label="Report issue"
                    >
                        {error ? <IconAlertCircle size="1rem" /> : <IconBug size="1rem" />}
                    </ActionIcon>
                </Tooltip>
            </Menu.Target>

            <Menu.Dropdown style={{ maxWidth: 400 }}>
                <Stack gap="xs" p="xs">
                    <Text size="sm" fw={700}>
                        {error ? 'Error Report' : 'Report Issue'}
                    </Text>

                    <Text size="xs" c="dimmed">
                        Copy the info below and share via GitHub Issues, email, or support channel.
                    </Text>

                    <ScrollArea h={150} >
                        <Code block style={{ fontSize: '0.7rem' }}>
                            {diagnosticText}
                        </Code>
                    </ScrollArea>

                    <CopyButton value={diagnosticText}>
                        {({ copied, copy }) => (
                            <Button
                                variant="light"
                                size="xs"
                                leftSection={copied ? <IconCheck size="1rem" /> : <IconCopy size="1rem" />}
                                onClick={copy}
                                fullWidth
                                color={copied ? 'teal' : undefined}
                            >
                                {copied ? 'Copied to Clipboard!' : 'Copy All'}
                            </Button>
                        )}
                    </CopyButton>

                    <Text size="xs" c="dimmed" fs="italic">
                        Paste this into GitHub Issues, email, or chat to report the problem.
                    </Text>
                </Stack>
            </Menu.Dropdown>
        </Menu>
    );
}

/**
 * Hook to capture errors for reporting
 */
export function useIssueReporter() {
    const [lastError, setLastError] = useState<Error | string | null>(null);
    const [context, setContext] = useState<Record<string, any>>({});

    const reportError = (error: Error | string, additionalContext?: Record<string, any>) => {
        setLastError(error);
        if (additionalContext) {
            setContext(prev => ({ ...prev, ...additionalContext }));
        }
    };

    const clearError = () => {
        setLastError(null);
        setContext({});
    };

    return {
        lastError,
        context,
        reportError,
        clearError,
    };
}

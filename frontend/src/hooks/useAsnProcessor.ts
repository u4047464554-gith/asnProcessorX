import { useState, useEffect, useCallback } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import type { ComboboxItem, ComboboxItemGroup } from '@mantine/core';
import { AsnService } from '../services/asnService';
import { formatErrorMessage } from '../utils/error';
import { hexTo0xHex } from '../utils/conversion';
import { downloadBlob } from '../utils/file';
import type { DefinitionNode } from '../components/definition/types';
import type { TraceResponsePayload } from '../components/trace/types';
import type { DemoEntry } from '../data/demos';
import { demoPayloads, demoErrorPayloads } from '../data/demos';
import { useSession } from './useSession';

export type DemoOption = ComboboxItem | ComboboxItemGroup;

export const useAsnProcessor = () => {
    const [protocols, setProtocols] = useState<string[]>([]);
    const [savedMessages, setSavedMessages] = useState<string[]>([]);
    const [selectedProtocol, setSelectedProtocol] = useState<string | null>(null);
    const [demoTypeOptions, setDemoTypeOptions] = useState<DemoOption[]>([]);
    const [selectedDemoOption, setSelectedDemoOption] = useState<string | null>(null);
    const [selectedType, setSelectedType] = useState<string | null>(null);
    const [loadedMessageName, setLoadedMessageName] = useState<string | null>(null);
    const [dynamicExamples, setDynamicExamples] = useState<Record<string, any>>({});
    const [definitionTree, setDefinitionTree] = useState<DefinitionNode | null>(null);

    const [hexData, setHexData] = useState('');
    const [jsonData, setJsonData] = useState('');
    const [formattedHex, setFormattedHex] = useState('');
    const [debouncedHex] = useDebouncedValue(hexData, 500);
    const [debouncedJson] = useDebouncedValue(jsonData, 500);
    const [lastEdited, setLastEdited] = useState<'hex' | 'json' | null>(null);
    const [editorMode, setEditorMode] = useState<'raw' | 'structured'>('structured');

    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [traceData, setTraceData] = useState<TraceResponsePayload | null>(null);
    const [traceLoading, setTraceLoading] = useState(false);
    const [traceError, setTraceError] = useState<string | null>(null);

    const [codegenLoading, setCodegenLoading] = useState(false);
    const [codegenError, setCodegenError] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [savedTrigger, setSavedTrigger] = useState(0);

    const { currentSessionId } = useSession();

    const refreshDefinitions = useCallback(() => {
        setRefreshTrigger(prev => prev + 1);
    }, []);

    const refreshSavedMessages = useCallback(() => {
        setSavedTrigger(prev => prev + 1);
    }, []);

    useEffect(() => {
        AsnService.getProtocols()
            .then(setProtocols)
            .catch((err) => {
                console.error('Failed to load protocols:', err);
                setError(`Failed to load protocols: ${err.message || 'Backend not available. Is the server running on http://localhost:8010?'}`);
                setProtocols([]);
            });
    }, []);

    useEffect(() => {
        AsnService.listSavedMessages(currentSessionId).then(setSavedMessages).catch(console.error);
    }, [savedTrigger, currentSessionId]);

    useEffect(() => {
        if (!selectedProtocol) {
            const savedItems = savedMessages.map(msg => ({
                value: `saved::${msg}`, label: msg
            }));
            if (savedItems.length > 0) {
                setDemoTypeOptions([{ group: 'Saved Messages', items: savedItems }]);
            } else {
                setDemoTypeOptions([]);
            }

            if (!selectedProtocol) {
                setDynamicExamples({});
            }
            return;
        }

        Promise.all([
            AsnService.getTypes(selectedProtocol),
            AsnService.getExamples(selectedProtocol)
        ]).then(([types, examples]) => {
            setDynamicExamples(examples);
            const options: DemoOption[] = [];

            // Saved Messages
            const savedItems = savedMessages.map(msg => ({
                value: `saved::${msg}`, label: msg
            }));
            if (savedItems.length > 0) {
                options.push({ group: 'Saved Messages', items: savedItems });
            }

            // Demos
            const demosItems: ComboboxItem[] = [];

            types.forEach(typeName => {
                if (demoPayloads[selectedProtocol]?.[typeName]) {
                    demosItems.push({ value: `${typeName}::valid`, label: `${typeName} (Valid Demo)` });
                }
                if (examples[typeName]) {
                    demosItems.push({ value: `${typeName}::dynamic`, label: `${typeName} (Custom Example)` });
                }
                demoErrorPayloads[selectedProtocol]?.[typeName]?.forEach((_, idx) => {
                    demosItems.push({ value: `${typeName}::error::${idx}`, label: `${typeName} (Error Demo #${idx + 1})` });
                });
            });

            if (demosItems.length > 0) {
                options.push({ group: 'Demos', items: demosItems });
            } else if (types.length > 0) {
                // If no demos, show types in a group or flat?
                // Let's use group 'Types'
                const typeItems = types.map(t => ({ value: t, label: t }));
                options.push({ group: 'Types', items: typeItems });
            }

            setDemoTypeOptions(options);
        }).catch(console.error);
    }, [selectedProtocol, refreshTrigger, savedMessages]);

    useEffect(() => {
        if (selectedProtocol && selectedType) {
            AsnService.getDefinition(selectedProtocol, selectedType)
                .then(setDefinitionTree)
                .catch(() => setDefinitionTree(null));
        } else {
            setDefinitionTree(null);
        }
        setTraceData(null);
        setTraceError(null);
    }, [selectedProtocol, selectedType, refreshTrigger]);

    const fetchTrace = useCallback(async (protocol: string, type: string, hex: string) => {
        if (!hex.trim()) { setTraceData(null); return; }
        setTraceLoading(true);
        setTraceError(null);
        try {
            const res = await AsnService.trace(protocol, type, hex);
            if (res.status === 'failure') {
                setTraceError(res.diagnostics || res.error || 'Trace failed');
                setTraceData(null);
            } else {
                setTraceData(res);
            }
        } catch (err: any) {
            setTraceError(formatErrorMessage(err));
            setTraceData(null);
        } finally {
            setTraceLoading(false);
        }
    }, []);

    const handleDecode = useCallback(async (hexOverride?: string) => {
        if (!selectedProtocol) return;
        const currentHex = hexOverride ?? hexData;
        if (!currentHex.trim()) return;

        setLoading(true);
        try {
            const res = await AsnService.decode(selectedProtocol, currentHex, selectedType || undefined);
            if (res.status === 'failure') {
                setError(res.diagnostics || res.error || 'Decode failed');
                return;
            }

            setError(null);
            setJsonData(JSON.stringify(res.data ?? res, null, 2));

            const resolvedType = selectedType || res.decoded_type;
            if (resolvedType) {
                await fetchTrace(selectedProtocol, resolvedType, currentHex);
            } else {
                setTraceError("Bit tracing requires a message type.");
            }
        } catch (err) {
            setError(formatErrorMessage(err));
        } finally {
            setLoading(false);
        }
    }, [hexData, selectedProtocol, selectedType, fetchTrace]);

    const handleEncode = useCallback(async (jsonOverride?: string) => {
        if (!selectedProtocol || !selectedType) return;
        const currentJson = jsonOverride ?? jsonData;
        if (!currentJson.trim()) return;

        setLoading(true);
        try {
            let parsed;
            try { parsed = JSON.parse(currentJson); } catch { setError("Invalid JSON"); return; }

            const res = await AsnService.encode(selectedProtocol, selectedType, parsed);
            if (res.status === 'failure') {
                setError(res.diagnostics || res.error || 'Encode failed');
                return;
            }

            setError(null);
            const newHex = res.hex_data || '';
            setHexData(newHex);
            setFormattedHex(hexTo0xHex(newHex));

            await fetchTrace(selectedProtocol, selectedType, newHex);
        } catch (err) {
            setError(formatErrorMessage(err));
        } finally {
            setLoading(false);
        }
    }, [jsonData, selectedProtocol, selectedType, fetchTrace]);

    useEffect(() => {
        if (lastEdited === 'hex' && debouncedHex) handleDecode(debouncedHex);
    }, [debouncedHex, lastEdited, handleDecode]);

    useEffect(() => {
        if (lastEdited === 'json' && debouncedJson) handleEncode(debouncedJson);
    }, [debouncedJson, lastEdited, handleEncode]);

    const handleDemoSelect = (value: string | null) => {
        setSelectedDemoOption(value);
        if (!value) {
            setSelectedType(null);
            setJsonData('');
            setError(null);
            setTraceError(null);
            setLoadedMessageName(null);
            return;
        }
        const parts = value.split('::');
        const mode = parts[0];

        if (mode === 'saved') {
            const filename = parts[1];
            setLoading(true);
            AsnService.loadMessage(filename, currentSessionId).then(msg => {
                // Set protocol and type from loaded message
                setSelectedProtocol(msg.protocol);
                setSelectedType(msg.type);
                setJsonData(JSON.stringify(msg.data, null, 2));
                setLastEdited('json');
                setError(null);
                setTraceError(null);
                // Track the loaded filename (without .json for display)
                setLoadedMessageName(filename.replace(/\.json$/, ''));
                // Set the dropdown to show the ASN message type
                setSelectedDemoOption(msg.type);
            }).catch(err => {
                setError("Failed to load message: " + (err.response?.data?.detail || err.message));
                setTraceError(null);
                setLoadedMessageName(null);
            }).finally(() => setLoading(false));
            return;
        }

        // Not a saved message - clear loaded name
        setLoadedMessageName(null);

        const typeName = parts[0];
        setSelectedType(typeName);

        if (selectedProtocol && parts.length > 1) {
            const [, variant, errorIndex] = parts;
            let example: DemoEntry | undefined;
            if (variant === 'error') {
                example = demoErrorPayloads[selectedProtocol]?.[typeName]?.[Number(errorIndex)];
            } else if (variant === 'dynamic') {
                example = dynamicExamples[typeName];
            } else {
                example = demoPayloads[selectedProtocol]?.[typeName];
            }

            if (example) {
                setJsonData(JSON.stringify(example, null, 2));
                setLastEdited('json');
                setError(null);
                setTraceError(null);
            } else {
                setJsonData('');
                setError(null);
                setTraceError(null);
            }
        } else {
            setJsonData('');
            setError(null);
            setTraceError(null);
        }
    };

    const handleSaveMessage = async (filename: string) => {
        if (!selectedProtocol || !selectedType || !jsonData) return false;
        try {
            const parsed = JSON.parse(jsonData);
            await AsnService.saveMessage(filename, selectedProtocol, selectedType, parsed, currentSessionId);
            refreshSavedMessages();
            return true;
        } catch (e: any) {
            setError(formatErrorMessage(e));
            return false;
        }
    };

    const handleDeleteMessage = async (filename: string) => {
        try {
            await AsnService.deleteMessage(filename, currentSessionId);
            refreshSavedMessages();
            if (selectedDemoOption === `saved::${filename}`) {
                setSelectedDemoOption(null);
                setJsonData('');
            }
        } catch (e: any) {
            setError(formatErrorMessage(e));
        }
    };

    const handleClearMessages = async () => {
        if (!confirm("Delete all saved messages?")) return;
        try {
            await AsnService.clearMessages(currentSessionId);
            refreshSavedMessages();
            if (selectedDemoOption?.startsWith('saved::')) {
                setSelectedDemoOption(null);
                setJsonData('');
            }
        } catch (e: any) {
            setError(formatErrorMessage(e));
        }
    };

    const loadExample = () => {
        // Clear all error states first
        setError(null);
        setTraceError(null);
        // Reset hex data to force fresh encoding
        setHexData('');
        setFormattedHex('');
        setTraceData(null);
        // Reload the example data
        handleDemoSelect(selectedDemoOption);
    };

    const handleCodegen = async () => {
        if (!selectedProtocol) return false;
        setCodegenLoading(true);
        setCodegenError(null);
        try {
            const blob = await AsnService.generateCStubs(selectedProtocol, selectedType ? [selectedType] : []);
            downloadBlob(blob, `${selectedProtocol}_c_stubs.zip`);
            return true;
        } catch (err: any) {
            if (err.response?.data instanceof Blob) {
                const text = await err.response.data.text();
                try {
                    const json = JSON.parse(text);
                    setCodegenError(json.detail || 'Generation failed');
                } catch {
                    setCodegenError(text);
                }
            } else {
                setCodegenError(formatErrorMessage(err));
            }
            return false;
        } finally {
            setCodegenLoading(false);
        }
    };

    const handleProtocolChange = (protocol: string | null) => {
        setSelectedProtocol(protocol);
        setSelectedType(null);
        setSelectedDemoOption(null);
        setJsonData('');
        setHexData('');
        setFormattedHex('');
        setError(null);
        setTraceData(null);
        setTraceError(null);
    };

    return {
        protocols, selectedProtocol, setSelectedProtocol, handleProtocolChange,
        demoTypeOptions, selectedDemoOption, handleDemoSelect,
        selectedType, setSelectedType,
        definitionTree,
        hexData, setHexData,
        jsonData, setJsonData,
        formattedHex, setFormattedHex,
        error, setError, loading,
        traceData, traceLoading, traceError,
        editorMode, setEditorMode,
        setLastEdited,
        handleDecode, handleEncode, loadExample,
        codegenLoading, codegenError, handleCodegen,
        refreshDefinitions,
        savedMessages, handleSaveMessage, handleDeleteMessage, handleClearMessages,
        loadedMessageName
    };
};


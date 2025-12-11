import axios from 'axios';
import type { DefinitionNode } from '../components/definition/types';
import type { TraceResponsePayload } from '../components/trace/types';

// Configuration
const resolveApiBase = () => {
    if (import.meta.env.VITE_API_BASE) {
        return import.meta.env.VITE_API_BASE as string;
    }
    if (import.meta.env.DEV) {
        return 'http://localhost:8000';
    }
    return undefined;
};

const apiBase = resolveApiBase();
if (apiBase) {
    axios.defaults.baseURL = apiBase;
}

// Types
export interface ApiResponse<T> {
    status?: 'success' | 'failure';
    data?: T;
    error?: string;
    diagnostics?: string;
    decoded_type?: string;
    hex_data?: string;
}

// Service
export const AsnService = {
    async getProtocols(): Promise<string[]> {
        const res = await axios.get<string[]>('/api/asn/protocols');
        return res.data;
    },

    async getProtocolsWithMetadata(): Promise<Array<{ name: string, error?: string | null, is_bundled?: boolean }>> {
        const res = await axios.get<Array<{ name: string, error?: string | null, is_bundled?: boolean }>>('/api/asn/protocols/metadata');
        return res.data;
    },

    async getProtocolMetadata(protocol: string): Promise<{ is_bundled: boolean }> {
        const res = await axios.get(`/api/asn/protocols/${protocol}/metadata`);
        return res.data;
    },

    async getTypes(protocol: string): Promise<string[]> {
        const res = await axios.get<string[]>(`/api/asn/protocols/${protocol}/types`);
        return res.data;
    },

    async getExamples(protocol: string): Promise<Record<string, any>> {
        try {
            const res = await axios.get<Record<string, any>>(`/api/asn/protocols/${protocol}/examples`);
            return res.data;
        } catch {
            return {};
        }
    },

    async getDefinition(protocol: string, type: string): Promise<DefinitionNode> {
        const res = await axios.get<{ tree: DefinitionNode }>(`/api/asn/protocols/${protocol}/types/${type}`);
        return res.data.tree;
    },

    async decode(protocol: string, hex: string, type?: string): Promise<ApiResponse<any>> {
        const res = await axios.post<ApiResponse<any>>('/api/asn/decode', {
            hex_data: hex,
            protocol,
            type_name: type,
            encoding_rule: 'per'
        });
        return res.data;
    },

    async encode(protocol: string, type: string, data: any): Promise<ApiResponse<any>> {
        const res = await axios.post<ApiResponse<any>>('/api/asn/encode', {
            data,
            protocol,
            type_name: type,
            encoding_rule: 'per'
        });
        return res.data;
    },

    async trace(protocol: string, type: string, hex: string): Promise<TraceResponsePayload> {
        const res = await axios.post<TraceResponsePayload>('/api/asn/trace', {
            hex_data: hex,
            protocol,
            type_name: type,
            encoding_rule: 'per',
        });
        return res.data;
    },

    async generateCStubs(protocol: string, types: string[]): Promise<Blob> {
        const res = await axios.post('/api/asn/codegen', {
            protocol,
            types,
            options: { 'compound-names': true }
        }, {
            responseType: 'blob'
        });
        return res.data;
    },

    // Messages
    // Messages
    async listSavedMessages(sessionId?: string): Promise<string[]> {
        const url = sessionId && sessionId !== 'default'
            ? `/api/sessions/${sessionId}/messages`
            : '/api/messages';
        const res = await axios.get<string[]>(url);
        return res.data;
    },

    async saveMessage(filename: string, protocol: string, type: string, data: any, sessionId?: string): Promise<any> {
        const url = sessionId && sessionId !== 'default'
            ? `/api/sessions/${sessionId}/messages`
            : '/api/messages';
        return axios.post(url, { filename, protocol, type, data });
    },

    async loadMessage(filename: string, sessionId?: string): Promise<any> {
        const url = sessionId && sessionId !== 'default'
            ? `/api/sessions/${sessionId}/messages/${filename}`
            : `/api/messages/${filename}`;
        const res = await axios.get<any>(url);
        return res.data;
    },

    async deleteMessage(filename: string, sessionId?: string): Promise<any> {
        const url = sessionId && sessionId !== 'default'
            ? `/api/sessions/${sessionId}/messages/${filename}`
            : `/api/messages/${filename}`;
        return axios.delete(url);
    },

    async clearMessages(sessionId?: string): Promise<any> {
        const url = sessionId && sessionId !== 'default'
            ? `/api/sessions/${sessionId}/messages`
            : '/api/messages';
        return axios.delete(url);
    }
};


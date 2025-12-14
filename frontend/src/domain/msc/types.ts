import type { AsnValue } from '../../types/asn';

export interface MscSequence {
  id: string;
  name: string;
  protocol: string;
  sessionId?: string;
  messages: MscMessage[];
  subSequences: MscSequence[];
  configurations: TrackedConfiguration[] | Record<string, TrackedConfiguration>;
  validationResults: ValidationResult[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface MscMessage {
  id: string;
  type_name: string;  // Align with backend naming
  type?: string;      // Legacy support
  data: AsnValue;
  sourceActor: string;
  targetActor: string;
  source_actor?: string;  // Backend naming support
  target_actor?: string;  // Backend naming support
  timestamp: number;
  validationErrors?: ValidationResult[];
  validation_errors?: ValidationResult[];  // Backend naming support
}

export interface TrackedConfiguration {
  identifier?: string;
  name?: string;  // Backend naming
  values: Record<number, AsnValue>; // message index -> value
  isConsistent?: boolean;
  is_consistent?: boolean;  // Backend naming support
  conflicts: string[];
}

export interface ValidationResult {
  type: 'error' | 'warning';
  message: string;
  field?: string;
  messageIndex?: number;
  message_index?: number;  // Backend naming support
  code?: string;
}

export interface IdentifierSuggestion {
  identifier: string;
  value: AsnValue;
  sourceMessageIndex?: number;
  source_message_index?: number;  // Backend naming support
  confidence: number;
  reason?: string;
}

// Helper function to normalize message from backend
// Uses unknown since backend response shape may vary
export function normalizeMessage(msg: unknown): MscMessage {
  const m = msg as Record<string, unknown>;
  return {
    id: String(m.id || ''),
    type_name: String(m.type_name || m.typeName || m.type || ''),
    type: String(m.type_name || m.typeName || m.type || ''),
    data: (m.data ?? {}) as AsnValue,
    sourceActor: String(m.sourceActor || m.source_actor || 'UE'),
    targetActor: String(m.targetActor || m.target_actor || 'gNB'),
    timestamp: Number(m.timestamp) || Date.now() / 1000,
    validationErrors: (m.validationErrors || m.validation_errors || []) as ValidationResult[]
  };
}

// Helper function to normalize sequence from backend
// Uses unknown since backend response shape may vary
export function normalizeSequence(seq: unknown): MscSequence {
  const s = seq as Record<string, unknown>;
  return {
    id: String(s.id || ''),
    name: String(s.name || ''),
    protocol: String(s.protocol || ''),
    messages: (Array.isArray(s.messages) ? s.messages : []).map(normalizeMessage),
    subSequences: (Array.isArray(s.subSequences) ? s.subSequences :
      Array.isArray(s.sub_sequences) ? s.sub_sequences : []).map(normalizeSequence),
    configurations: (s.configurations || s.tracked_identifiers || {}) as TrackedConfiguration[] | Record<string, TrackedConfiguration>,
    validationResults: (s.validationResults || s.validation_results || []) as ValidationResult[],
    createdAt: (s.createdAt || s.created_at || new Date()) as Date | string,
    updatedAt: (s.updatedAt || s.updated_at || new Date()) as Date | string
  };
}



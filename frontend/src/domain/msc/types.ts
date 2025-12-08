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
  data: any;
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
  values: Record<number, any>; // message index -> value
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
  value: any;
  sourceMessageIndex?: number;
  source_message_index?: number;  // Backend naming support
  confidence: number;
  reason?: string;
}

// Helper function to normalize message from backend
export function normalizeMessage(msg: any): MscMessage {
  return {
    id: msg.id,
    type_name: msg.type_name || msg.typeName || msg.type || '',
    type: msg.type_name || msg.typeName || msg.type || '',
    data: msg.data || {},
    sourceActor: msg.sourceActor || msg.source_actor || 'UE',
    targetActor: msg.targetActor || msg.target_actor || 'gNB',
    timestamp: msg.timestamp || Date.now() / 1000,
    validationErrors: msg.validationErrors || msg.validation_errors || []
  };
}

// Helper function to normalize sequence from backend
export function normalizeSequence(seq: any): MscSequence {
  return {
    id: seq.id,
    name: seq.name,
    protocol: seq.protocol,
    messages: (seq.messages || []).map(normalizeMessage),
    subSequences: (seq.subSequences || seq.sub_sequences || []).map(normalizeSequence),
    configurations: seq.configurations || seq.tracked_identifiers || {},
    validationResults: seq.validationResults || seq.validation_results || [],
    createdAt: seq.createdAt || seq.created_at || new Date(),
    updatedAt: seq.updatedAt || seq.updated_at || new Date()
  };
}


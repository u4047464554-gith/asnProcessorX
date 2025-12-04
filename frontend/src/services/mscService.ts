import axios from 'axios';
import type { 
  MscSequence, 
  MscMessage, 
  TrackedConfiguration, 
  ValidationResult,
  IdentifierSuggestion 
} from '../domain/msc/types';

// API base URL - should match backend configuration
const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8000/api/msc'
  : '/api/msc';

class MscService {
  private api: ReturnType<typeof axios.create>;

  constructor(baseURL: string = API_BASE_URL) {
    this.api = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        // Handle common errors
        if (error.response?.status === 404) {
          throw new Error(`MSC resource not found: ${error.response.data?.detail || error.message}`);
        }
        if (error.response?.status >= 500) {
          throw new Error(`MSC service error: ${error.response.data?.detail || 'Server error'}`);
        }
        throw error;
      }
    );
  }

  // Sequence CRUD Operations

  async createSequence(name: string, protocol: string, sessionId?: string): Promise<MscSequence> {
    const payload: any = { name, protocol };
    if (sessionId) {
      payload.session_id = sessionId;
    }
    const response = await this.api.post<MscSequence>('/sequences', payload);
    return response.data;
  }

  async getSequence(sequenceId: string): Promise<MscSequence | null> {
    try {
      const response = await this.api.get<MscSequence>(`/sequences/${sequenceId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async updateSequence(
    sequenceId: string, 
    updates: { 
      name?: string; 
      add_message?: Partial<MscMessage>; 
      remove_message?: string; 
    }
  ): Promise<MscSequence | null> {
    const response = await this.api.put<MscSequence>(`/sequences/${sequenceId}`, updates);
    return response.data;
  }

  async deleteSequence(sequenceId: string): Promise<boolean> {
    try {
      await this.api.delete(`/sequences/${sequenceId}`);
      return true;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return false;
      }
      throw error;
    }
  }

  async addMessageToSequence(
    sequenceId: string, 
    message: Partial<MscMessage>
  ): Promise<MscSequence> {
    const response = await this.api.post<MscSequence>(`/sequences/${sequenceId}/messages`, message);
    return response.data;
  }

  async listSequences(protocol?: string): Promise<MscSequence[]> {
    const params = protocol ? { protocol } : {};
    const response = await this.api.get<MscSequence[]>('/sequences', { params });
    return response.data;
  }

  // Validation Operations

  async validateSequence(sequenceId: string): Promise<{
    results: ValidationResult[];
    hasErrors: boolean;
    errorCount: number;
    warningCount: number;
  }> {
    const response = await this.api.post<{
      results: ValidationResult[];
      hasErrors: boolean;
      errorCount: number;
      warningCount: number;
    }>(`/sequences/${sequenceId}/validate`);
    return response.data;
  }

  // Identifier Detection

  async detectIdentifiers(protocol: string, typeName: string): Promise<string[]> {
    const response = await this.api.get<{
      identifiers: string[];
      protocol: string;
      type_name: string;
      count: number;
      detected_at: string;
    }>(`/protocols/${protocol}/identifiers/${typeName}`);
    return response.data.identifiers;
  }

  // Configuration Suggestions

  async getFieldSuggestions(
    sequenceId: string,
    messageIndex: number,
    fieldName: string,
    protocol: string,
    typeName: string
  ): Promise<IdentifierSuggestion[]> {
    const params = {
      message_index: messageIndex,
      field_name: fieldName,
      protocol,
      type_name: typeName,
    };
    
    const response = await this.api.get<IdentifierSuggestion[]>(
      `/sequences/${sequenceId}/suggestions`, 
      { params }
    );
    return response.data;
  }

  // Batch Operations

  async validateMultipleSequences(sequenceIds: string[]): Promise<{
    [sequenceId: string]: {
      results: ValidationResult[];
      hasErrors: boolean;
    };
  }> {
    // Note: This would require a batch endpoint on backend
    // For now, validate sequentially
    const results: { [sequenceId: string]: any } = {};
    
    for (const sequenceId of sequenceIds) {
      try {
        const validation = await this.validateSequence(sequenceId);
        results[sequenceId] = {
          results: validation.results,
          hasErrors: validation.hasErrors,
        };
      } catch (error: any) {
        results[sequenceId] = {
          results: [{
            type: 'error' as const,
            message: `Validation failed: ${error.message}`,
            code: 'VALIDATION_ERROR'
          }],
          hasErrors: true,
        };
      }
    }
    
    return results;
  }

  // Utility Methods

  async healthCheck(): Promise<{
    status: string;
    service: string;
    version: string;
    features: {
      sequence_crud: boolean;
      validation: boolean;
      identifier_detection: boolean;
      rrc_state_machine: boolean;
    };
  }> {
    const response = await this.api.get('/health');
    return response.data;
  }

  // Error Handling Helpers

  private handleMscError(error: any, operation: string): never {
    console.error(`MSC Service ${operation} failed:`, error);
    
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const detail = error.response.data?.detail || 'Unknown error';
      
      if (status === 400) {
        throw new Error(`Invalid ${operation} request: ${detail}`);
      } else if (status === 404) {
        throw new Error(`${operation} resource not found: ${detail}`);
      } else if (status >= 500) {
        throw new Error(`MSC service unavailable: ${detail}`);
      }
    }
    
    // Network or other error
    throw new Error(`Failed to ${operation}: ${error.message}`);
  }
}

// Types for API responses (if needed beyond domain types)
export interface ApiValidationResult {
  type: 'error' | 'warning';
  message: string;
  field?: string;
  message_index?: number;
  code?: string;
}

export interface ApiSuggestion {
  identifier: string;
  value: any;
  source_message_index: number;
  confidence: number;
  reason?: string;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  features: {
    sequence_crud: boolean;
    validation: boolean;
    identifier_detection: boolean;
    rrc_state_machine: boolean;
  };
}

export interface IdentifierDetectionResponse {
  identifiers: string[];
  protocol: string;
  type_name: string;
  count: number;
  detected_at: string;
}

export interface ValidationResponse {
  results: ApiValidationResult[];
  has_errors: boolean;
  error_count: number;
  warning_count: number;
}

export default MscService;

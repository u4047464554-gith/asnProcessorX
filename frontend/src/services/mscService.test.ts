import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import MscService from './mscService';
import type { MscSequence, MscMessage } from '../domain/msc/types';

vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('MscService', () => {
  let service: MscService;
  let mockAxiosInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        response: {
          use: vi.fn(),
        },
      },
    };
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
    service = new MscService();
  });

  describe('createSequence', () => {
    it('creates a new sequence', async () => {
      const mockSequence: MscSequence = {
        id: 'seq-1',
        name: 'Test Sequence',
        protocol: 'rrc_demo',
        messages: [],
        subSequences: [],
        configurations: {},
        validationResults: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockSequence });

      const result = await service.createSequence('Test Sequence', 'rrc_demo');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/sequences', {
        name: 'Test Sequence',
        protocol: 'rrc_demo',
      });
      expect(result).toEqual(mockSequence);
    });

    it('handles creation errors', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('Network error'));

      await expect(service.createSequence('Test', 'rrc_demo')).rejects.toThrow();
    });
  });

  describe('getSequence', () => {
    it('retrieves a sequence by ID', async () => {
      const mockSequence: MscSequence = {
        id: 'seq-1',
        name: 'Test',
        protocol: 'rrc_demo',
        messages: [],
        subSequences: [],
        configurations: {},
        validationResults: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockSequence });

      const result = await service.getSequence('seq-1');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/sequences/seq-1');
      expect(result).toEqual(mockSequence);
    });

    it('returns null for 404 errors', async () => {
      const error: any = new Error('Not found');
      error.response = { status: 404 };
      mockAxiosInstance.get.mockRejectedValue(error);

      const result = await service.getSequence('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('addMessageToSequence', () => {
    it('adds a message to a sequence', async () => {
      const mockMessage: Partial<MscMessage> = {
        type_name: 'RRCConnectionRequest',
        data: { test: 'data' },
        source_actor: 'UE',
        target_actor: 'gNB',
      };

      const updatedSequence: MscSequence = {
        id: 'seq-1',
        name: 'Test',
        protocol: 'rrc_demo',
        messages: [
          {
            id: 'msg-1',
            type_name: 'RRCConnectionRequest',
            data: { test: 'data' },
            sourceActor: 'UE',
            targetActor: 'gNB',
            timestamp: Date.now() / 1000,
          },
        ],
        subSequences: [],
        configurations: {},
        validationResults: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockAxiosInstance.post.mockResolvedValue({ data: updatedSequence });

      const result = await service.addMessageToSequence('seq-1', mockMessage);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/sequences/seq-1/messages',
        mockMessage
      );
      expect(result).toEqual(updatedSequence);
    });
  });

  describe('validateSequence', () => {
    it('validates a sequence', async () => {
      const validationResult = {
        results: [
          { type: 'error' as const, message: 'Test error' },
        ],
        hasErrors: true,
        errorCount: 1,
        warningCount: 0,
      };

      mockAxiosInstance.post.mockResolvedValue({ data: validationResult });

      const result = await service.validateSequence('seq-1');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/sequences/seq-1/validate');
      expect(result).toEqual(validationResult);
    });
  });

  describe('deleteSequence', () => {
    it('deletes a sequence', async () => {
      mockAxiosInstance.delete.mockResolvedValue({});

      const result = await service.deleteSequence('seq-1');

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/sequences/seq-1');
      expect(result).toBe(true);
    });

    it('returns false for 404 errors', async () => {
      const error: any = new Error('Not found');
      error.response = { status: 404 };
      mockAxiosInstance.delete.mockRejectedValue(error);

      const result = await service.deleteSequence('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('listSequences', () => {
    it('lists all sequences', async () => {
      const mockSequences: MscSequence[] = [
        {
          id: 'seq-1',
          name: 'Test 1',
          protocol: 'rrc_demo',
          messages: [],
          subSequences: [],
          configurations: {},
          validationResults: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      mockAxiosInstance.get.mockResolvedValue({ data: mockSequences });

      const result = await service.listSequences();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/sequences', { params: {} });
      expect(result).toEqual(mockSequences);
    });

    it('filters by protocol', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: [] });

      await service.listSequences('rrc_demo');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/sequences', {
        params: { protocol: 'rrc_demo' },
      });
    });
  });

  describe('getFieldSuggestions', () => {
    it('gets field suggestions', async () => {
      const suggestions = [
        {
          identifier: 'ue-Identity',
          value: '12345',
          sourceMessageIndex: 0,
          confidence: 0.9,
        },
      ];

      mockAxiosInstance.get.mockResolvedValue({ data: suggestions });

      const result = await service.getFieldSuggestions(
        'seq-1',
        0,
        'ue-Identity',
        'rrc_demo',
        'RRCConnectionRequest'
      );

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/sequences/seq-1/suggestions',
        {
          params: {
            message_index: 0,
            field_name: 'ue-Identity',
            protocol: 'rrc_demo',
            type_name: 'RRCConnectionRequest',
          },
        }
      );
      expect(result).toEqual(suggestions);
    });
  });

  describe('detectIdentifiers', () => {
    it('detects identifiers in a type', async () => {
      const response = {
        identifiers: ['ue-Identity', 'establishmentCause'],
        protocol: 'rrc_demo',
        type_name: 'RRCConnectionRequest',
        count: 2,
        detected_at: new Date().toISOString(),
      };

      mockAxiosInstance.get.mockResolvedValue({ data: response });

      const result = await service.detectIdentifiers('rrc_demo', 'RRCConnectionRequest');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/protocols/rrc_demo/identifiers/RRCConnectionRequest'
      );
      expect(result).toEqual(response.identifiers);
    });
  });

  describe('healthCheck', () => {
    it('checks service health', async () => {
      const healthResponse = {
        status: 'ok',
        service: 'msc',
        version: '1.0.0',
        features: {
          sequence_crud: true,
          validation: true,
          identifier_detection: true,
          rrc_state_machine: true,
        },
      };

      mockAxiosInstance.get.mockResolvedValue({ data: healthResponse });

      const result = await service.healthCheck();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/health');
      expect(result).toEqual(healthResponse);
    });
  });

  describe('validateMultipleSequences', () => {
    it('validates multiple sequences', async () => {
      const validationResult1 = {
        results: [],
        hasErrors: false,
        errorCount: 0,
        warningCount: 0,
      };
      const validationResult2 = {
        results: [{ type: 'error' as const, message: 'Error' }],
        hasErrors: true,
        errorCount: 1,
        warningCount: 0,
      };

      mockAxiosInstance.post
        .mockResolvedValueOnce({ data: validationResult1 })
        .mockResolvedValueOnce({ data: validationResult2 });

      const result = await service.validateMultipleSequences(['seq-1', 'seq-2']);

      expect(result).toEqual({
        'seq-1': {
          results: [],
          hasErrors: false,
        },
        'seq-2': {
          results: [{ type: 'error', message: 'Error' }],
          hasErrors: true,
        },
      });
    });

    it('handles validation errors gracefully', async () => {
      const error = new Error('Validation failed');
      mockAxiosInstance.post.mockRejectedValue(error);

      const result = await service.validateMultipleSequences(['seq-1']);

      expect(result['seq-1'].hasErrors).toBe(true);
      expect(result['seq-1'].results[0].message).toContain('Validation failed');
    });
  });

  describe('error handling', () => {
    it('handles 404 errors gracefully', async () => {
      const error: any = new Error('Not found');
      error.response = { status: 404, data: { detail: 'Sequence not found' } };
      mockAxiosInstance.get.mockRejectedValue(error);

      await expect(service.getSequence('nonexistent')).resolves.toBeNull();
    });

    it('handles 500 errors', async () => {
      const error: any = new Error('Server error');
      error.response = { status: 500, data: { detail: 'Internal server error' } };
      mockAxiosInstance.post.mockRejectedValue(error);

      // The interceptor should handle this, but it may throw a generic error
      await expect(service.createSequence('Test', 'rrc_demo')).rejects.toThrow();
    });

    it('handles network errors', async () => {
      const error = new Error('Network error');
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(service.createSequence('Test', 'rrc_demo')).rejects.toThrow();
    });

    it('handles 400 errors', async () => {
      const error: any = new Error('Bad request');
      error.response = { status: 400, data: { detail: 'Invalid data' } };
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(service.createSequence('', 'rrc_demo')).rejects.toThrow();
    });
  });
});


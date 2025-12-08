import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SchemaEditor } from './SchemaEditor';
import axios from 'axios';
import { MantineProvider } from '@mantine/core';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

// Mock Monaco Editor
vi.mock('@monaco-editor/react', () => ({
  default: () => <div data-testid="monaco-editor">Monaco Editor Mock</div>,
}));

// Wrapper component for Mantine
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <MantineProvider>{children}</MantineProvider>
);

describe('SchemaEditor - Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle API returning non-array data gracefully', async () => {
    // Simulate API returning object instead of array
    mockedAxios.get.mockResolvedValueOnce({
      data: { error: 'Some error' }, // NOT an array
    });

    render(
      <TestWrapper>
        <SchemaEditor protocol="test_protocol" />
      </TestWrapper>
    );

    // Wait for API call
    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith(
        '/api/files/protocols/test_protocol/files'
      );
    });

    // Should show error message instead of crashing
    await waitFor(() => {
      const errorAlert = screen.queryByText(/unexpected response format/i);
      expect(errorAlert).toBeInTheDocument();
    });
  });

  it('should handle API failure and show error to user', async () => {
    // Simulate API failure
    mockedAxios.get.mockRejectedValueOnce({
      response: {
        data: {
          detail: 'Protocol not found',
        },
      },
    });

    render(
      <TestWrapper>
        <SchemaEditor protocol="test_protocol" />
      </TestWrapper>
    );

    // Should show error message to user
    await waitFor(() => {
      const errorMessage = screen.queryByText(/error loading files/i);
      expect(errorMessage).toBeInTheDocument();
    });
  });

  it('should handle empty file list gracefully', async () => {
    // API returns empty array
    mockedAxios.get.mockResolvedValueOnce({
      data: [],
    });

    render(
      <TestWrapper>
        <SchemaEditor protocol="test_protocol" />
      </TestWrapper>
    );

    // Should show helpful message
    await waitFor(() => {
      const message = screen.queryByText(/no schema files found/i);
      expect(message).toBeInTheDocument();
    });
  });

  it('should successfully load files when API returns array', async () => {
    // API returns proper array
    mockedAxios.get.mockImplementation((url) => {
      if (url.includes('/files')) {
        return Promise.resolve({
          data: ['file1.asn', 'file2.asn'],
        });
      }
      if (url.includes('/definitions')) {
        return Promise.resolve({
          data: {},
        });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    render(
      <TestWrapper>
        <SchemaEditor protocol="test_protocol" />
      </TestWrapper>
    );

    // Should load files successfully
    await waitFor(() => {
      expect(screen.queryByText(/file1.asn/i)).toBeInTheDocument();
    });

    // Should NOT show error
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
  });

  it('should validate response data exists before processing', async () => {
    // API returns response with no data
    mockedAxios.get.mockResolvedValueOnce({
      data: null,
    });

    render(
      <TestWrapper>
        <SchemaEditor protocol="test_protocol" />
      </TestWrapper>
    );

    // Should handle null data
    await waitFor(() => {
      const errorMessage = screen.queryByText(/no data received/i);
      expect(errorMessage).toBeInTheDocument();
    });
  });
});

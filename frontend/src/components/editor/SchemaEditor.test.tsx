import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SchemaEditor } from './SchemaEditor';
import axios from 'axios';
import { MantineProvider } from '@mantine/core';

// Mock axios
vi.mock('axios');

// Mock Monaco Editor
vi.mock('@monaco-editor/react', () => ({
  default: () => <div data-testid="monaco-editor">Monaco Editor Mock</div>,
}));

// Wrapper component for Mantine
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <MantineProvider>{children}</MantineProvider>
);

describe('SchemaEditor - Core Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset axios mock for each test
    (axios.get as any) = vi.fn();
  });

  it('renders the component with basic structure', async () => {
    // Mock successful file list
    (axios.get as any).mockImplementation((url: string) => {
      if (url.includes('/files') && !url.includes('/definitions')) {
        return Promise.resolve({ data: ['test.asn'] });
      }
      if (url.includes('/definitions')) {
        return Promise.resolve({ data: {} });
      }
      return Promise.resolve({ data: { content: '-- test' } });
    });

    render(
      <TestWrapper>
        <SchemaEditor protocol="test_protocol" />
      </TestWrapper>
    );

    // Should render basic UI elements
    await waitFor(() => {
      expect(screen.getByText('New File')).toBeInTheDocument();
    });
  });

  it('renders file list when API returns files', async () => {
    (axios.get as any).mockImplementation((url: string) => {
      if (url.includes('/files') && !url.includes('/definitions')) {
        return Promise.resolve({ data: ['schema.asn', 'types.asn'] });
      }
      if (url.includes('/definitions')) {
        return Promise.resolve({ data: {} });
      }
      return Promise.resolve({ data: { content: '-- ASN.1' } });
    });

    render(
      <TestWrapper>
        <SchemaEditor protocol="test_protocol" />
      </TestWrapper>
    );

    // Should show files in list - may appear multiple times
    await waitFor(() => {
      const fileElements = screen.getAllByText('schema.asn');
      expect(fileElements.length).toBeGreaterThan(0);
    });
  });

  it('displays Monaco editor placeholder', async () => {
    (axios.get as any).mockImplementation((url: string) => {
      if (url.includes('/files') && !url.includes('/definitions')) {
        return Promise.resolve({ data: ['test.asn'] });
      }
      if (url.includes('/definitions')) {
        return Promise.resolve({ data: {} });
      }
      return Promise.resolve({ data: { content: '-- test' } });
    });

    render(
      <TestWrapper>
        <SchemaEditor protocol="test_protocol" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });
  });

  it('has save and snapshot buttons', async () => {
    (axios.get as any).mockImplementation((url: string) => {
      if (url.includes('/files') && !url.includes('/definitions')) {
        return Promise.resolve({ data: ['test.asn'] });
      }
      if (url.includes('/definitions')) {
        return Promise.resolve({ data: {} });
      }
      return Promise.resolve({ data: { content: '-- test' } });
    });

    render(
      <TestWrapper>
        <SchemaEditor protocol="test_protocol" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Save')).toBeInTheDocument();
      expect(screen.getByText('Snapshot')).toBeInTheDocument();
    });
  });
});

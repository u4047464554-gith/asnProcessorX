import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SchemaEditor } from './SchemaEditor';
import { MantineProvider } from '@mantine/core';
import axios from 'axios';
import { vi } from 'vitest';

const setModelMarkers = vi.fn();
const executeEdits = vi.fn();

vi.mock('axios');
vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange, onMount }: any) => {
    if (onMount) {
        const model = {
            getValue: () => value,
            getPositionAt: () => ({ lineNumber: 1, column: 1 }),
        };
        const editor = {
            getModel: () => model,
            onDidChangeModelContent: (cb: any) => {},
            getSelection: () => ({}),
            executeEdits,
            focus: vi.fn(),
            getValue: () => value
        };
        const monaco = {
            MarkerSeverity: { Warning: 1 },
            languages: { 
                register: vi.fn(), 
                setMonarchTokensProvider: vi.fn(),
                getLanguages: () => []
            },
            editor: { 
                defineTheme: vi.fn(), 
                setModelMarkers 
            }
        };
        setTimeout(() => onMount(editor, monaco), 0);
    }
    return <textarea 
      data-testid="monaco-editor"
      value={value} 
      onChange={(e) => onChange(e.target.value)} 
    />;
  },
  useMonaco: () => ({
    languages: { register: vi.fn(), setMonarchTokensProvider: vi.fn() },
    editor: { defineTheme: vi.fn(), setModelMarkers }
  })
}));

const renderWithMantine = (ui: React.ReactNode) => {
  return render(<MantineProvider>{ui}</MantineProvider>);
};

describe('SchemaEditor', () => {
  const protocol = 'test_proto';
  const files = ['file1.asn', 'file2.asn'];

  beforeEach(() => {
    vi.clearAllMocks();
    (axios.get as any).mockImplementation((url: string) => {
      if (url.endsWith('/files')) return Promise.resolve({ data: files });
      if (url.endsWith('/files/file1.asn')) return Promise.resolve({ data: { content: 'Content 1' } });
      if (url.endsWith('/definitions')) return Promise.resolve({ data: { 'file1.asn': ['TypeA'] } });
      return Promise.resolve({ data: '' });
    });
    window.alert = vi.fn();
    console.error = vi.fn();
  });

  it('renders and loads files', async () => {
    renderWithMantine(<SchemaEditor protocol={protocol} />);
    await waitFor(() => {
        expect(screen.getAllByText('file1.asn').length).toBeGreaterThan(0);
    });
  });

  it('loads file content on selection', async () => {
    renderWithMantine(<SchemaEditor protocol={protocol} />);
    await waitFor(() => screen.getAllByText('file1.asn'));
    
    fireEvent.click(screen.getAllByText('file1.asn')[0]); 
    await waitFor(() => expect(screen.getByDisplayValue('Content 1')).toBeInTheDocument());
  });

  it('creates new file', async () => {
    (axios.post as any).mockResolvedValue({});
    renderWithMantine(<SchemaEditor protocol={protocol} />);
    
    fireEvent.click(screen.getByLabelText('Create new file'));
    await waitFor(() => expect(screen.getByText('New File')).toBeInTheDocument());
    
    const input = await screen.findByLabelText('Filename');
    fireEvent.change(input, { target: { value: 'new.asn' } });
    fireEvent.click(screen.getByText('Create'));
    
    await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith(`/api/files/protocols/${protocol}/files`, { filename: 'new.asn' });
    });
  });

  it('saves file', async () => {
    (axios.put as any).mockResolvedValue({});
    renderWithMantine(<SchemaEditor protocol={protocol} />);
    await waitFor(() => screen.getAllByText('file1.asn'));
    fireEvent.click(screen.getAllByText('file1.asn')[0]);
    await waitFor(() => screen.getByDisplayValue('Content 1'));

    fireEvent.change(screen.getByTestId('monaco-editor'), { target: { value: 'New Content' } });
    fireEvent.click(screen.getByLabelText('Save file'));
    
    await waitFor(() => {
        expect(axios.put).toHaveBeenCalledWith(
            `/api/files/protocols/${protocol}/files/file1.asn`,
            { content: 'New Content' }
        );
    });
  });

  it('saves snapshot', async () => {
    (axios.post as any).mockResolvedValue({});
    renderWithMantine(<SchemaEditor protocol={protocol} />);
    await waitFor(() => screen.getAllByText('file1.asn'));
    fireEvent.click(screen.getAllByText('file1.asn')[0]);
    
    fireEvent.click(screen.getByLabelText('Create snapshot'));
    
    await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith(
            `/api/files/protocols/${protocol}/files`,
            expect.objectContaining({ filename: expect.stringContaining('_snap_') })
        );
    });
  });

  it('inserts snippet', async () => {
    renderWithMantine(<SchemaEditor protocol={protocol} />);
    await waitFor(() => screen.getAllByText('file1.asn'));
    fireEvent.click(screen.getAllByText('file1.asn')[0]);
    
    fireEvent.click(screen.getByText('Integer (Range)'));
    expect(executeEdits).toHaveBeenCalled();
  });

  it('validates content', async () => {
    renderWithMantine(<SchemaEditor protocol={protocol} />);
    await waitFor(() => {
        expect(setModelMarkers).toHaveBeenCalled();
    });
  });

  it('handles save error', async () => {
    (axios.put as any).mockRejectedValue(new Error('Save Failed'));
    renderWithMantine(<SchemaEditor protocol={protocol} />);
    await waitFor(() => screen.getAllByText('file1.asn'));
    fireEvent.click(screen.getAllByText('file1.asn')[0]);
    await waitFor(() => screen.getByDisplayValue('Content 1'));
    
    fireEvent.change(screen.getByTestId('monaco-editor'), { target: { value: 'Changed' } });
    fireEvent.click(screen.getByLabelText('Save file'));
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Failed to save file'));
  });

  it('handles fetch error', async () => {
    (axios.get as any).mockRejectedValue(new Error('Fetch Failed'));
    renderWithMantine(<SchemaEditor protocol={protocol} />);
    await waitFor(() => expect(console.error).toHaveBeenCalled());
  });
});

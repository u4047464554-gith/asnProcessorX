import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SchemaEditor } from './SchemaEditor';
import { MantineProvider } from '@mantine/core';
import axios from 'axios';
import { vi } from 'vitest';

vi.mock('axios');
vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange }: any) => {
    return <textarea 
      data-testid="monaco-editor"
      value={value} 
      onChange={(e) => onChange(e.target.value)} 
    />;
  },
  useMonaco: () => ({
    languages: { register: vi.fn(), setMonarchTokensProvider: vi.fn() },
    editor: { defineTheme: vi.fn(), setModelMarkers: vi.fn() }
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
  });

  it('renders and loads files', async () => {
    renderWithMantine(<SchemaEditor protocol={protocol} />);
    
    await waitFor(() => {
        const items = screen.getAllByText('file1.asn');
        expect(items.length).toBeGreaterThan(0);
    });
  });

  it('loads file content on selection', async () => {
    renderWithMantine(<SchemaEditor protocol={protocol} />);
    
    await waitFor(() => screen.getAllByText('file1.asn'));
    
    const fileLinks = screen.getAllByText('file1.asn');
    fireEvent.click(fileLinks[0]); 
    
    await waitFor(() => {
       expect(screen.getByDisplayValue('Content 1')).toBeInTheDocument();
    });
  });

  it('creates new file', async () => {
    (axios.post as any).mockResolvedValue({});
    renderWithMantine(<SchemaEditor protocol={protocol} />);
    
    fireEvent.click(screen.getByLabelText('Create new file'));
    
    await waitFor(() => expect(screen.getByText('New File')).toBeInTheDocument());
    
    const input = screen.getByPlaceholderText('my_spec.asn');
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

    const editor = screen.getByTestId('monaco-editor');
    fireEvent.change(editor, { target: { value: 'New Content' } });
    
    fireEvent.click(screen.getByLabelText('Save file'));
    
    await waitFor(() => {
        expect(axios.put).toHaveBeenCalledWith(
            `/api/files/protocols/${protocol}/files/file1.asn`,
            { content: 'New Content' }
        );
    });
  });
});

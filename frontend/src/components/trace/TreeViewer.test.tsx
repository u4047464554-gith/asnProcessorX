import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TreeViewer } from './TreeViewer'
import type { TraceNode } from './types'
import { renderWithMantine } from '../../test/render'

const sampleTree: TraceNode = {
  name: 'Person',
  type: 'SEQUENCE',
  value: { name: 'Alice', age: 30 },
  bits: { start: 0, end: 64, length: 64 },
  children: [
    {
      name: 'name',
      type: 'IA5String',
      value: 'Alice',
      bits: { start: 0, end: 40, length: 40 },
      children: [],
    },
    {
      name: 'age',
      type: 'INTEGER',
      value: 30,
      bits: { start: 56, end: 64, length: 8 },
      children: [],
    },
  ],
}

describe('TreeViewer', () => {
  it('renders nodes and child values', () => {
    renderWithMantine(<TreeViewer root={sampleTree} />)
    expect(screen.getByText(/^Person$/)).toBeInTheDocument()
    expect(screen.getByText(/^name$/)).toBeInTheDocument()
    expect(screen.getByText(/^age$/)).toBeInTheDocument()
  })

  it('invokes onSelect when node clicked', () => {
    const handler = vi.fn()
    renderWithMantine(<TreeViewer root={sampleTree} onSelect={handler} />)

    const nameNode = screen.getByText(/^name$/i)
    fireEvent.click(nameNode)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler.mock.calls[0][0]).toEqual({ start: 0, end: 40, length: 40 })
  })

  it('toggles child visibility', () => {
    renderWithMantine(<TreeViewer root={sampleTree} />)
    const toggleButton = screen.getByLabelText(/collapse node/i)
    fireEvent.click(toggleButton)
    expect(screen.queryByText(/^name$/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText(/expand node/i))
    expect(screen.getByText(/^name$/i)).toBeInTheDocument()
  })
})


import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BitInspectorPanel } from './BitInspectorPanel'
import type { TraceNode } from './types'
import { renderWithMantine } from '../../test/render'

const traceRoot: TraceNode = {
  name: 'Direction',
  type: 'CHOICE',
  value: { $choice: 'uplink' },
  bits: { start: 0, end: 72, length: 72 },
  children: [
    {
      name: 'uplink',
      type: 'Person',
      value: null,
      bits: { start: 0, end: 72, length: 72 },
      children: [
        {
          name: 'name',
          type: 'IA5String',
          value: 'Bob',
          bits: { start: 0, end: 32, length: 32 },
          children: [],
        },
      ],
    },
  ],
}

describe('BitInspectorPanel', () => {
  it('renders tree and hex viewers when trace present', () => {
    renderWithMantine(
      <BitInspectorPanel
        hexInput="0a0b0c"
        traceRoot={traceRoot}
        totalBits={72}
        loading={false}
      />,
    )

    expect(screen.getByTestId('bit-inspector')).toBeInTheDocument()
    expect(screen.getByText(/Consumed bits/i)).toHaveTextContent('72')
    expect(screen.getByText(/Field Map/)).toBeInTheDocument()
    expect(screen.getByText(/Hex View/)).toBeInTheDocument()
  })

  it('synchronizes selection between tree and hex', () => {
    renderWithMantine(
      <BitInspectorPanel
        hexInput="0a0b0c"
        traceRoot={traceRoot}
        totalBits={72}
        loading={false}
      />,
    )

    const nameNode = screen.getByText(/name/)
    fireEvent.click(nameNode)
    const firstByte = screen.getByTestId('hex-byte-0')
    expect(firstByte).toHaveClass('hex-byte--selected')
  })
})


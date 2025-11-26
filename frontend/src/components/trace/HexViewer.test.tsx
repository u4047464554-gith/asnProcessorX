import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HexViewer } from './HexViewer'
import { renderWithMantine } from '../../test/render'

describe('HexViewer', () => {
  it('renders bytes with offsets', () => {
    renderWithMantine(<HexViewer hex="0a0b0c" />)
    expect(screen.getByText('0000')).toBeInTheDocument()
    expect(screen.getByText(/0A/i)).toBeInTheDocument()
    expect(screen.getByText(/0B/i)).toBeInTheDocument()
    expect(screen.getByText(/0C/i)).toBeInTheDocument()
  })

  it('highlights selected bytes and supports clicking', () => {
    const onSelect = vi.fn()
    renderWithMantine(
      <HexViewer
        hex="0a0b0c"
        selectedRange={{ start: 8, end: 16, length: 8 }}
        onSelect={onSelect}
      />,
    )
    const secondByte = screen.getByTestId('hex-byte-1')
    expect(secondByte).toHaveClass('hex-byte--selected')

    const firstByte = screen.getByTestId('hex-byte-0')
    fireEvent.click(firstByte)
    expect(onSelect).toHaveBeenCalledWith({ start: 0, end: 8, length: 8 })
  })
})


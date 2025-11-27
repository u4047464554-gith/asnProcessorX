export interface BitRange {
  start: number
  end: number
  length: number
}

export interface TraceNode {
  name: string
  type: string
  value: unknown
  bits?: BitRange | null
  children: TraceNode[]
}

export interface TraceResponsePayload {
  status: string
  protocol: string
  type_name: string
  decoded?: unknown
  trace?: TraceNode
  total_bits?: number
  error?: string
  diagnostics?: string
}

import type { AsnValue } from '../../types/asn';

export interface DefinitionNode {
  name?: string | null
  type: string
  kind?: string // Internal ASN.1 class name (Sequence, Integer, etc.)
  constraints?: Record<string, unknown>
  children?: DefinitionNode[]
  note?: string
  optional?: boolean
  default?: AsnValue
}

export interface DefinitionNode {
  name?: string | null
  type: string
  constraints?: Record<string, unknown>
  children?: DefinitionNode[]
  note?: string
}






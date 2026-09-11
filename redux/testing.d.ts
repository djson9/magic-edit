export type MagicEditDiagnosticClock = {
  now(): number
  monotonicNow(): number
}

export type MagicEditDiagnosticTransition = Record<string, unknown> & {
  sequence: number
  storeId: string
  type: string
  action: unknown
  resultingState: unknown
}

export type MagicEditDiagnosticStore = {
  storeId: string
  currentState: unknown
  transitions: MagicEditDiagnosticTransition[]
}

export type MagicEditDiagnosticSnapshot = {
  schemaVersion: number
  capture: Record<string, unknown>
  app: Record<string, unknown>
  redux: {
    stores: MagicEditDiagnosticStore[]
    asyncOperations: Array<Record<string, unknown>>
  }
  network: {requests: Array<Record<string, unknown>>}
  runtimeEvents: Array<Record<string, unknown>>
  recorderErrors: Array<Record<string, unknown>>
  summary: Record<string, unknown>
}

export declare function resetMagicEditDiagnostics(): void
export declare function setMagicEditDiagnosticClock(clock: MagicEditDiagnosticClock): void
export declare function getMagicEditDiagnosticSnapshot(): MagicEditDiagnosticSnapshot
export declare function registerMagicEditAppMetadata(metadata: Record<string, unknown>): void

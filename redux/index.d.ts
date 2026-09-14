import type {Middleware} from 'redux'

export type MagicEditDiagnosticsOptions = {
  includeStateSnapshots?: boolean
  maximumStateChanges?: number
  maximumTransitions?: number
  selectAction?: (action: unknown) => unknown
  selectState?: (state: unknown) => unknown
  shouldRecordAction?: (action: unknown) => boolean
}

export declare function createMagicEditMiddleware(
  options?: MagicEditDiagnosticsOptions,
): Middleware
export declare const magicEditMiddleware: Middleware

import type { Middleware } from 'redux'
import { diagnosticRuntime } from '../src/diagnostics/runtime'

export type MagicEditDiagnosticsOptions = {
  includeStateSnapshots?: boolean
  maximumStateChanges?: number
  maximumTransitions?: number
  selectAction?: (action: unknown) => unknown
  selectState?: (state: unknown) => unknown
  shouldRecordAction?: (action: unknown) => boolean
}

export function createMagicEditMiddleware(
  options: MagicEditDiagnosticsOptions = {},
): Middleware {
  return store => {
    const runtime = diagnosticRuntime()
    const selectState = (state: unknown) => {
      if (!options.selectState) return state
      try {
        return options.selectState(state)
      } catch (error) {
        runtime.recordError('redux_state_selector_failed', error)
        return null
      }
    }
    const storeId = runtime.attachStore(
      store as object,
      selectState(store.getState()),
      options,
    )
    return next => action => {
      let shouldRecord = true
      if (options.shouldRecordAction) {
        try {
          shouldRecord = options.shouldRecordAction(action)
        } catch (error) {
          runtime.recordError('redux_action_filter_failed', error)
        }
      }
      const before = shouldRecord ? selectState(store.getState()) : null
      const started = runtime.time()
      let result: unknown
      let thrown: unknown
      let didThrow = false
      try {
        result = next(action)
      } catch (error) {
        didThrow = true
        thrown = error
      }
      const completed = runtime.time()
      const after = selectState(store.getState())
      if (!shouldRecord) {
        runtime.updateStoreState(storeId, after)
        if (didThrow) throw thrown
        return result
      }
      let recordedAction = action
      if (options.selectAction) {
        try {
          recordedAction = options.selectAction(action)
        } catch (error) {
          runtime.recordError('redux_action_selector_failed', error)
          recordedAction = { type: '<action-selector-failed>' }
        }
      }
      runtime.recordAction(
        storeId,
        action,
        recordedAction,
        before,
        after,
        started.now,
        started.monotonicNow,
        completed.monotonicNow,
        didThrow,
        thrown,
      )
      if (didThrow) throw thrown
      return result
    }
  }
}

export const magicEditMiddleware: Middleware = createMagicEditMiddleware()

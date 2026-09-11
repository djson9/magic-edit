import type { Middleware } from 'redux'
import { diagnosticRuntime } from '../src/diagnostics/runtime'

export const magicEditMiddleware: Middleware = store => {
  const runtime = diagnosticRuntime()
  const storeId = runtime.attachStore(store as object, store.getState())
  return next => action => {
    const before = store.getState()
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
    runtime.recordAction(
      storeId,
      action,
      before,
      store.getState(),
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

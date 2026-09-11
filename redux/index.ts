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
    try {
      result = next(action)
    } catch (error) {
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
      thrown,
    )
    if (thrown !== undefined) throw thrown
    return result
  }
}

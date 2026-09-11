import { normalizeDiagnosticValue } from './normalize'
import { installNetworkRecorder, restoreNetworkRecorderForTests } from './network'

export type DiagnosticClock = {
  now(): number
  monotonicNow(): number
}

type StoreState = {
  storeId: string
  lastActionAt: number | null
  currentState: unknown
  transitions: Array<Record<string, unknown>>
}

type PendingOperation = {
  storeId: string
  requestId: string
  operation: string
  startedAt: number
  startedMonotonicAtMs: number
  startedSequence: number
  action: unknown
}

type RuntimeListener = () => void

const DEFAULT_CLOCK: DiagnosticClock = {
  now: () => Date.now(),
  monotonicNow: () => typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now(),
}

const GLOBAL_KEY = Symbol.for('@djson9/magic-edit/diagnostics/v1')

function iso(milliseconds: number) {
  return new Date(milliseconds).toISOString()
}

function recordObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function actionType(action: unknown) {
  const type = recordObject(action).type
  return typeof type === 'string' ? type : String(type ?? '<unknown>')
}

function topLevelChanges(before: unknown, after: unknown) {
  if (before === after) return []
  if (!before || !after || typeof before !== 'object' || typeof after !== 'object') return ['$root']
  const left = before as Record<string, unknown>
  const right = after as Record<string, unknown>
  return Array.from(new Set([...Object.keys(left), ...Object.keys(right)]))
    .filter(key => left[key] !== right[key])
}

function operationDetails(action: unknown) {
  const record = recordObject(action)
  const meta = recordObject(record.meta)
  const requestId = typeof meta.requestId === 'string' ? meta.requestId : null
  const explicitStatus = typeof meta.requestStatus === 'string' ? meta.requestStatus : null
  const type = actionType(action)
  const suffix = type.match(/\/(pending|fulfilled|rejected)$/)?.[1] ?? null
  const status = explicitStatus || suffix
  if (!requestId || !['pending', 'fulfilled', 'rejected'].includes(status ?? '')) return null
  return {
    requestId,
    status: status as 'pending' | 'fulfilled' | 'rejected',
    operation: suffix ? type.slice(0, -(suffix.length + 1)) : type,
    aborted: meta.aborted === true,
    condition: meta.condition === true,
  }
}

function actionStormCount(transitions: Array<Record<string, unknown>>) {
  let storms = 0
  let start = 0
  let insideStorm = false
  for (let end = 0; end < transitions.length; end += 1) {
    const endAt = Number(transitions[end].wallTimeMs)
    while (start < end && endAt - Number(transitions[start].wallTimeMs) > 1000) start += 1
    const isStorm = end - start + 1 >= 20
    if (isStorm && !insideStorm) storms += 1
    insideStorm = isStorm
  }
  return storms
}

export class MagicEditDiagnosticRuntime {
  private clock: DiagnosticClock = DEFAULT_CLOCK
  private nextStoreNumber = 1
  private globalSequence = 0
  private nextNetworkSequence = 1
  private stores = new Map<object, StoreState>()
  private storeStates = new Map<string, StoreState>()
  private pendingOperations = new Map<string, PendingOperation>()
  private settledOperations: Array<Record<string, unknown>> = []
  private networkRequests: Array<Record<string, unknown>> = []
  private activeNetwork = new Map<number, Record<string, unknown>>()
  private runtimeEvents: Array<Record<string, unknown>> = []
  private recorderErrors: Array<Record<string, unknown>> = []
  private listeners = new Set<RuntimeListener>()
  private appMetadata: Record<string, unknown> = {
    id: typeof location !== 'undefined' && location.host ? location.host : 'unknown-app',
    platform: typeof navigator !== 'undefined' ? navigator.platform || 'unknown' : 'unknown',
  }
  private networkInstalled = false
  private stallTimer: ReturnType<typeof setInterval> | null = null

  setClockForTests(clock: DiagnosticClock) {
    this.clock = clock
  }

  time() {
    return { now: this.clock.now(), monotonicNow: this.clock.monotonicNow() }
  }

  attachStore(store: object, initialState: unknown) {
    const existing = this.stores.get(store)
    if (existing) return existing.storeId
    const state: StoreState = {
      storeId: `store-${this.nextStoreNumber++}`,
      lastActionAt: null,
      currentState: normalizeDiagnosticValue(initialState),
      transitions: [],
    }
    this.stores.set(store, state)
    this.storeStates.set(state.storeId, state)
    if (!this.networkInstalled) {
      this.networkInstalled = true
      try {
        installNetworkRecorder(this)
      } catch (error) {
        this.recordError('network_install_failed', error)
      }
      this.installStallSampler()
    }
    this.emit()
    return state.storeId
  }

  hasAttachedStore() {
    return this.storeStates.size > 0
  }

  subscribe(listener: RuntimeListener) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  currentReduxSequence() {
    return this.globalSequence
  }

  recordAction(
    storeId: string,
    action: unknown,
    before: unknown,
    after: unknown,
    startedAt: number,
    startedMonotonicAtMs: number,
    completedMonotonicAtMs: number,
    thrown?: unknown,
  ) {
    const store = this.storeStates.get(storeId)
    if (!store) return
    try {
      const sequence = ++this.globalSequence
      const changedSlices = topLevelChanges(before, after)
      const transition: Record<string, unknown> = {
        sequence,
        storeId,
        type: actionType(action),
        at: iso(startedAt),
        wallTimeMs: startedAt,
        monotonicAtMs: startedMonotonicAtMs,
        dispatchDurationMs: Math.max(0, completedMonotonicAtMs - startedMonotonicAtMs),
        sincePreviousActionMs: store.lastActionAt === null ? null : Math.max(0, startedAt - store.lastActionAt),
        changedSlices,
        noOp: before === after,
        action: normalizeDiagnosticValue(action),
        resultingState: normalizeDiagnosticValue(after),
        ...(thrown === undefined ? {} : { threw: normalizeDiagnosticValue(thrown) }),
      }
      store.lastActionAt = startedAt
      store.currentState = transition.resultingState
      store.transitions.push(transition)
      this.correlateOperation(storeId, action, transition)
    } catch (error) {
      this.recordError('redux_record_failed', error)
    }
  }

  registerAppMetadata(metadata: Record<string, unknown>) {
    try {
      this.appMetadata = recordObject(normalizeDiagnosticValue({ ...this.appMetadata, ...metadata }))
      this.recordRuntimeEvent('app_metadata_registered', this.appMetadata)
    } catch (error) {
      this.recordError('app_metadata_failed', error)
    }
  }

  recordRuntimeEvent(type: string, details: Record<string, unknown> = {}) {
    try {
      const now = this.clock.now()
      this.runtimeEvents.push({
        type,
        at: iso(now),
        wallTimeMs: now,
        monotonicAtMs: this.clock.monotonicNow(),
        details: normalizeDiagnosticValue(details),
      })
    } catch (error) {
      this.recordError('runtime_event_failed', error)
    }
  }

  beginNetwork(details: Record<string, unknown>) {
    const sequence = this.nextNetworkSequence++
    const now = this.clock.now()
    const record: Record<string, unknown> = {
      sequence,
      ...details,
      startedAt: iso(now),
      wallTimeMs: now,
      monotonicAtMs: this.clock.monotonicNow(),
      concurrencyAtStart: this.activeNetwork.size + 1,
      reduxSequenceAtStart: this.globalSequence,
      outcome: 'in_flight',
      completedAt: null,
      durationMs: null,
      status: null,
      reduxSequenceAtEnd: null,
      retryOfSequence: this.retryCandidate(details),
    }
    this.activeNetwork.set(sequence, record)
    this.networkRequests.push(record)
    return sequence
  }

  completeNetwork(sequence: number, details: Record<string, unknown>) {
    const record = this.activeNetwork.get(sequence)
    if (!record) return
    const now = this.clock.now()
    const monotonic = this.clock.monotonicNow()
    Object.assign(record, details, {
      completedAt: iso(now),
      completedWallTimeMs: now,
      durationMs: Math.max(0, monotonic - Number(record.monotonicAtMs)),
      reduxSequenceAtEnd: this.globalSequence,
    })
    this.activeNetwork.delete(sequence)
  }

  recordError(code: string, error: unknown) {
    const now = this.clock.now()
    this.recorderErrors.push({
      code,
      at: iso(now),
      wallTimeMs: now,
      error: normalizeDiagnosticValue(error),
    })
  }

  snapshot() {
    const now = this.clock.now()
    const monotonic = this.clock.monotonicNow()
    const stores = Array.from(this.storeStates.values(), store => ({
      storeId: store.storeId,
      currentState: store.currentState,
      transitions: store.transitions,
    }))
    const transitions = stores.flatMap(store => store.transitions) as Array<Record<string, unknown>>
    transitions.sort((left, right) => Number(left.sequence) - Number(right.sequence))
    const pending = Array.from(this.pendingOperations.values(), operation => ({
      ...operation,
      startedAt: iso(operation.startedAt),
      outcome: 'pending',
      settledSequence: null,
      durationMs: Math.max(0, monotonic - operation.startedMonotonicAtMs),
      cancelled: false,
      conditionRejected: false,
    }))
    const sliceCounts = new Map<string, number>()
    for (const transition of transitions) {
      for (const slice of transition.changedSlices as string[]) {
        sliceCounts.set(slice, (sliceCounts.get(slice) ?? 0) + 1)
      }
    }
    const mostChangedSlice = Array.from(sliceCounts.entries())
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? null
    const gaps = transitions.map(transition => transition.sincePreviousActionMs)
      .filter((value): value is number => typeof value === 'number')
    return {
      schemaVersion: 1,
      capture: { createdAt: iso(now), monotonicAtMs: monotonic },
      app: this.appMetadata,
      redux: {
        stores,
        asyncOperations: [...this.settledOperations, ...pending],
      },
      network: { requests: this.networkRequests },
      runtimeEvents: this.runtimeEvents,
      recorderErrors: this.recorderErrors,
      summary: {
        actions: transitions.length,
        stores: stores.length,
        slowDispatches: transitions.filter(entry => Number(entry.dispatchDurationMs) > 16).length,
        noOpActions: transitions.filter(entry => entry.noOp === true).length,
        actionStorms: actionStormCount(transitions),
        rejectedOperations: this.settledOperations.filter(entry => entry.outcome === 'rejected').length,
        pendingOperations: pending.length,
        mostChangedSlice,
        largestInterActionGapMs: gaps.length ? Math.max(...gaps) : null,
        networkRequests: this.networkRequests.length,
        inFlightRequests: this.activeNetwork.size,
        peakNetworkConcurrency: this.networkRequests.reduce(
          (peak, request) => Math.max(peak, Number(request.concurrencyAtStart) || 0),
          0,
        ),
        recorderErrors: this.recorderErrors.length,
      },
    }
  }

  resetForTests() {
    if (this.stallTimer) clearInterval(this.stallTimer)
    this.stallTimer = null
    this.clock = DEFAULT_CLOCK
    this.nextStoreNumber = 1
    this.globalSequence = 0
    this.nextNetworkSequence = 1
    this.stores = new Map()
    this.storeStates = new Map()
    this.pendingOperations = new Map()
    this.settledOperations = []
    this.networkRequests = []
    this.activeNetwork = new Map()
    this.runtimeEvents = []
    this.recorderErrors = []
    this.appMetadata = { id: 'unknown-app', platform: 'unknown' }
    this.networkInstalled = false
    restoreNetworkRecorderForTests()
    this.emit()
  }

  private correlateOperation(storeId: string, action: unknown, transition: Record<string, unknown>) {
    const details = operationDetails(action)
    if (!details) return
    const key = `${storeId}\u0000${details.requestId}`
    if (details.status === 'pending') {
      this.pendingOperations.set(key, {
        storeId,
        requestId: details.requestId,
        operation: details.operation,
        startedAt: Number(transition.wallTimeMs),
        startedMonotonicAtMs: Number(transition.monotonicAtMs),
        startedSequence: Number(transition.sequence),
        action: transition.action,
      })
      return
    }
    const pending = this.pendingOperations.get(key)
    const startedAt = pending?.startedAt ?? Number(transition.wallTimeMs)
    const startedMonotonicAtMs = pending?.startedMonotonicAtMs ?? Number(transition.monotonicAtMs)
    this.settledOperations.push({
      storeId,
      requestId: details.requestId,
      operation: pending?.operation ?? details.operation,
      outcome: details.status,
      startedAt: iso(startedAt),
      settledAt: transition.at,
      startedSequence: pending?.startedSequence ?? transition.sequence,
      settledSequence: transition.sequence,
      durationMs: Math.max(0, Number(transition.monotonicAtMs) - startedMonotonicAtMs),
      cancelled: details.aborted,
      conditionRejected: details.condition,
      pendingAction: pending?.action ?? null,
      settledAction: transition.action,
    })
    this.pendingOperations.delete(key)
  }

  private retryCandidate(details: Record<string, unknown>) {
    const method = details.method
    const url = details.url
    for (let index = this.networkRequests.length - 1; index >= 0; index -= 1) {
      const previous = this.networkRequests[index]
      if (previous.method !== method || previous.url !== url) continue
      const outcome = previous.outcome
      const status = Number(previous.status)
      if (outcome === 'network_error' || outcome === 'timeout' || outcome === 'aborted' || status >= 400) {
        return previous.sequence
      }
      return null
    }
    return null
  }

  private installStallSampler() {
    if (typeof setInterval !== 'function' || this.stallTimer) return
    let expected = this.clock.monotonicNow() + 250
    this.stallTimer = setInterval(() => {
      const observed = this.clock.monotonicNow()
      const drift = observed - expected
      expected = observed + 250
      if (drift > 50) this.recordRuntimeEvent('javascript_event_loop_stall', { durationMs: drift })
    }, 250)
    const timer = this.stallTimer as unknown as { unref?: () => void }
    timer.unref?.()
  }

  private emit() {
    for (const listener of this.listeners) {
      try { listener() } catch { /* observer failures are isolated */ }
    }
  }
}

export function diagnosticRuntime() {
  const root = globalThis as typeof globalThis & { [GLOBAL_KEY]?: MagicEditDiagnosticRuntime }
  if (!root[GLOBAL_KEY]) root[GLOBAL_KEY] = new MagicEditDiagnosticRuntime()
  return root[GLOBAL_KEY]
}

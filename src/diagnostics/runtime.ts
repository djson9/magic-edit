import { normalizeDiagnosticValue } from './normalize'
import { installNetworkRecorder, restoreNetworkRecorderForTests } from './network'
import { diagnosticStateChanges } from './state-changes'

export type DiagnosticClock = {
  now(): number
  monotonicNow(): number
}

type StoreState = {
  storeId: string
  lastActionAt: number | null
  currentState: unknown
  transitions: Array<Record<string, unknown>>
  includeStateSnapshots: boolean
  maximumStateChanges: number
  maximumTransitions: number
  droppedTransitions: number
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

export type DiagnosticStoreOptions = {
  includeStateSnapshots?: boolean
  maximumStateChanges?: number
  maximumTransitions?: number
}

const DEFAULT_MAXIMUM_STATE_CHANGES = 256
const DEFAULT_MAXIMUM_TRANSITIONS = 200
const MAXIMUM_NETWORK_REQUESTS = 200
const MAXIMUM_RUNTIME_EVENTS = 200
const MAXIMUM_RECORDER_ERRORS = 50
const MAXIMUM_SETTLED_OPERATIONS = 200

const DEFAULT_CLOCK: DiagnosticClock = {
  now: () => Date.now(),
  monotonicNow: () => {
    const candidate = (globalThis as { performance?: { now?: () => number } }).performance
    return typeof candidate?.now === 'function' ? candidate.now() : Date.now()
  },
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
    const endTransition = transitions[end]
    if (!endTransition) continue
    const endAt = Number(endTransition.wallTimeMs)
    while (start < end) {
      const startTransition = transitions[start]
      if (!startTransition || endAt - Number(startTransition.wallTimeMs) <= 1000) break
      start += 1
    }
    const isStorm = end - start + 1 >= 20
    if (isStorm && !insideStorm) storms += 1
    insideStorm = isStorm
  }
  return storms
}

function positiveInteger(value: number | undefined, fallback: number) {
  return Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : fallback
}

function appendBounded<T>(values: T[], value: T, maximum: number) {
  values.push(value)
  const dropped = Math.max(0, values.length - maximum)
  if (dropped > 0) values.splice(0, dropped)
  return dropped
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
  private droppedNetworkRequests = 0
  private droppedRuntimeEvents = 0
  private droppedRecorderErrors = 0
  private droppedSettledOperations = 0
  private listeners = new Set<RuntimeListener>()
  private appMetadata: Record<string, unknown> = (() => {
    const environment = globalThis as {
      location?: { host?: string }
      navigator?: { platform?: string }
    }
    return {
      id: environment.location?.host || 'unknown-app',
      platform: environment.navigator?.platform || 'unknown',
    }
  })()
  private networkInstalled = false
  private stallTimer: ReturnType<typeof setInterval> | null = null

  setClockForTests(clock: DiagnosticClock) {
    this.clock = clock
  }

  time() {
    return { now: this.clock.now(), monotonicNow: this.clock.monotonicNow() }
  }

  attachStore(store: object, initialState: unknown, options: DiagnosticStoreOptions = {}) {
    const existing = this.stores.get(store)
    if (existing) return existing.storeId
    const state: StoreState = {
      storeId: `store-${this.nextStoreNumber++}`,
      lastActionAt: null,
      currentState: initialState,
      transitions: [],
      includeStateSnapshots: options.includeStateSnapshots === true,
      maximumStateChanges: positiveInteger(
        options.maximumStateChanges,
        DEFAULT_MAXIMUM_STATE_CHANGES,
      ),
      maximumTransitions: positiveInteger(
        options.maximumTransitions,
        DEFAULT_MAXIMUM_TRANSITIONS,
      ),
      droppedTransitions: 0,
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

  updateStoreState(storeId: string, currentState: unknown) {
    const store = this.storeStates.get(storeId)
    if (store) store.currentState = currentState
  }

  recordAction(
    storeId: string,
    action: unknown,
    recordedAction: unknown,
    before: unknown,
    after: unknown,
    startedAt: number,
    startedMonotonicAtMs: number,
    completedMonotonicAtMs: number,
    didThrow: boolean,
    thrown: unknown,
  ) {
    const store = this.storeStates.get(storeId)
    if (!store) return
    try {
      const sequence = ++this.globalSequence
      const changedSlices = topLevelChanges(before, after)
      const stateChanges = diagnosticStateChanges(
        before,
        after,
        store.maximumStateChanges,
      )
      const noOp = stateChanges.changes.length === 0 && !stateChanges.truncated
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
        noOp,
        action: normalizeDiagnosticValue(recordedAction),
        stateChanges: stateChanges.changes,
        stateChangesTruncated: stateChanges.truncated,
        ...(!noOp && store.includeStateSnapshots
          ? { resultingState: normalizeDiagnosticValue(after) }
          : {}),
        ...(didThrow ? { threw: normalizeDiagnosticValue(thrown) } : {}),
      }
      store.lastActionAt = startedAt
      store.currentState = after
      store.transitions.push(transition)
      if (store.transitions.length > store.maximumTransitions) {
        const dropCount = store.transitions.length - store.maximumTransitions
        store.transitions.splice(0, dropCount)
        store.droppedTransitions += dropCount
      }
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
      this.droppedRuntimeEvents += appendBounded(this.runtimeEvents, {
        type,
        at: iso(now),
        wallTimeMs: now,
        monotonicAtMs: this.clock.monotonicNow(),
        details: normalizeDiagnosticValue(details),
      }, MAXIMUM_RUNTIME_EVENTS)
    } catch (error) {
      this.recordError('runtime_event_failed', error)
    }
  }

  beginNetwork(details: Record<string, unknown>) {
    const sequence = this.nextNetworkSequence++
    const now = this.clock.now()
    const normalizedDetails = recordObject(normalizeDiagnosticValue(details))
    const record: Record<string, unknown> = {
      sequence,
      ...normalizedDetails,
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
    this.droppedNetworkRequests += appendBounded(
      this.networkRequests,
      record,
      MAXIMUM_NETWORK_REQUESTS,
    )
    return sequence
  }

  completeNetwork(sequence: number, details: Record<string, unknown>) {
    const record = this.activeNetwork.get(sequence)
    if (!record) return
    const now = this.clock.now()
    const monotonic = this.clock.monotonicNow()
    Object.assign(record, recordObject(normalizeDiagnosticValue(details)), {
      completedAt: iso(now),
      completedWallTimeMs: now,
      durationMs: Math.max(0, monotonic - Number(record.monotonicAtMs)),
      reduxSequenceAtEnd: this.globalSequence,
    })
    this.activeNetwork.delete(sequence)
  }

  recordError(code: string, error: unknown) {
    const now = this.clock.now()
    this.droppedRecorderErrors += appendBounded(this.recorderErrors, {
      code,
      at: iso(now),
      wallTimeMs: now,
      error: normalizeDiagnosticValue(error),
    }, MAXIMUM_RECORDER_ERRORS)
  }

  snapshot() {
    const now = this.clock.now()
    const monotonic = this.clock.monotonicNow()
    const stores = Array.from(this.storeStates.values(), store => ({
      storeId: store.storeId,
      currentState: normalizeDiagnosticValue(store.currentState),
      transitions: store.transitions,
      droppedTransitions: store.droppedTransitions,
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
        actions: this.globalSequence,
        retainedActions: transitions.length,
        droppedActions: stores.reduce((total, store) => total + store.droppedTransitions, 0),
        stores: stores.length,
        slowDispatches: transitions.filter(entry => Number(entry.dispatchDurationMs) > 16).length,
        noOpActions: transitions.filter(entry => entry.noOp === true).length,
        actionStorms: actionStormCount(transitions),
        rejectedOperations: this.settledOperations.filter(entry => entry.outcome === 'rejected').length,
        pendingOperations: pending.length,
        mostChangedSlice,
        largestInterActionGapMs: gaps.length ? Math.max(...gaps) : null,
        networkRequests: this.networkRequests.length,
        droppedNetworkRequests: this.droppedNetworkRequests,
        inFlightRequests: this.activeNetwork.size,
        peakNetworkConcurrency: this.networkRequests.reduce(
          (peak, request) => Math.max(peak, Number(request.concurrencyAtStart) || 0),
          0,
        ),
        recorderErrors: this.recorderErrors.length,
        droppedRuntimeEvents: this.droppedRuntimeEvents,
        droppedRecorderErrors: this.droppedRecorderErrors,
        droppedSettledOperations: this.droppedSettledOperations,
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
    this.droppedNetworkRequests = 0
    this.droppedRuntimeEvents = 0
    this.droppedRecorderErrors = 0
    this.droppedSettledOperations = 0
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
    this.droppedSettledOperations += appendBounded(this.settledOperations, {
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
    }, MAXIMUM_SETTLED_OPERATIONS)
    this.pendingOperations.delete(key)
  }

  private retryCandidate(details: Record<string, unknown>) {
    const method = details.method
    const url = details.url
    for (let index = this.networkRequests.length - 1; index >= 0; index -= 1) {
      const previous = this.networkRequests[index]
      if (!previous) continue
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

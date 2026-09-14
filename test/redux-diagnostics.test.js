import { applyMiddleware, createStore } from 'redux'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMagicEditMiddleware, magicEditMiddleware } from '../dist/redux.cjs'
import {
  getMagicEditDiagnosticSnapshot,
  registerMagicEditAppMetadata,
  resetMagicEditDiagnostics,
  setMagicEditDiagnosticClock,
} from '../dist/redux-testing.cjs'

function clockFixture() {
  let wall = Date.parse('2026-09-11T12:00:00.000Z')
  let monotonic = 100
  return {
    clock: { now: () => wall, monotonicNow: () => monotonic },
    advance({ wallMs = 0, monotonicMs = wallMs } = {}) {
      wall += wallMs
      monotonic += monotonicMs
    },
  }
}

function reducer(timing) {
  return (state = { count: 0, nested: { ready: false } }, action) => {
    if (action.type === 'counter/increment') return { ...state, count: state.count + action.payload }
    if (action.type === 'counter/slow') {
      timing.advance({ monotonicMs: 20 })
      return { ...state, count: state.count + 1 }
    }
    if (action.type === 'counter/throw') throw new Error('reducer exploded')
    if (action.type === 'counter/throw-undefined') throw undefined
    return state
  }
}

describe('zero-configuration Redux diagnostics', () => {
  beforeEach(() => resetMagicEditDiagnostics())

  it('captures complete actions, state changes, ordering, timings, no-ops, and all attached stores', () => {
    const timing = clockFixture()
    setMagicEditDiagnosticClock(timing.clock)
    registerMagicEditAppMetadata({ id: 'fixture.money.live', build: '42' })
    const first = createStore(reducer(timing), applyMiddleware(magicEditMiddleware))
    const second = createStore(reducer(timing), applyMiddleware(magicEditMiddleware))

    first.dispatch({ type: 'counter/increment', payload: 2, meta: { source: 'fixture' } })
    timing.advance({ wallMs: 87, monotonicMs: 87 })
    first.dispatch({ type: 'counter/noop', payload: { retained: true } })
    second.dispatch({ type: 'counter/slow' })

    const snapshot = getMagicEditDiagnosticSnapshot()
    expect(snapshot.app).toMatchObject({ id: 'fixture.money.live', build: '42' })
    expect(snapshot.redux.stores).toHaveLength(2)
    expect(snapshot.redux.stores[0].currentState).toEqual({ count: 2, nested: { ready: false } })
    expect(snapshot.redux.stores[0].transitions[0]).toMatchObject({
      sequence: 1,
      type: 'counter/increment',
      changedSlices: ['count'],
      noOp: false,
      action: { type: 'counter/increment', payload: 2, meta: { source: 'fixture' } },
      stateChanges: [{ operation: 'replace', path: ['count'], value: 2 }],
      stateChangesTruncated: false,
    })
    expect(snapshot.redux.stores[0].transitions[1]).toMatchObject({
      sequence: 2,
      sincePreviousActionMs: 87,
      noOp: true,
      stateChanges: [],
    })
    expect(snapshot.redux.stores[1].transitions[0]).toMatchObject({
      sequence: 3,
      dispatchDurationMs: 20,
    })
    expect(snapshot.summary).toMatchObject({
      actions: 3,
      stores: 2,
      slowDispatches: 1,
      noOpActions: 1,
      mostChangedSlice: 'count',
    })
  })

  it('correlates fulfilled, rejected, cancelled, concurrent, and still-pending thunk lifecycles', () => {
    const timing = clockFixture()
    setMagicEditDiagnosticClock(timing.clock)
    const store = createStore(reducer(timing), applyMiddleware(magicEditMiddleware))

    store.dispatch({ type: 'sync/run/pending', meta: { requestId: 'a', requestStatus: 'pending', arg: { raw: true } } })
    timing.advance({ wallMs: 40, monotonicMs: 40 })
    store.dispatch({ type: 'sync/run/pending', meta: { requestId: 'b', requestStatus: 'pending' } })
    timing.advance({ wallMs: 60, monotonicMs: 60 })
    store.dispatch({ type: 'sync/run/fulfilled', payload: { ok: true }, meta: { requestId: 'a', requestStatus: 'fulfilled' } })
    timing.advance({ wallMs: 20, monotonicMs: 20 })
    store.dispatch({ type: 'sync/run/rejected', error: { message: 'cancelled' }, meta: { requestId: 'b', requestStatus: 'rejected', aborted: true } })
    store.dispatch({ type: 'sync/run/pending', meta: { requestId: 'c', requestStatus: 'pending' } })
    timing.advance({ wallMs: 25, monotonicMs: 25 })

    const operations = getMagicEditDiagnosticSnapshot().redux.asyncOperations
    expect(operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ requestId: 'a', operation: 'sync/run', outcome: 'fulfilled', durationMs: 100 }),
      expect.objectContaining({ requestId: 'b', outcome: 'rejected', durationMs: 80, cancelled: true }),
      expect.objectContaining({ requestId: 'c', outcome: 'pending', durationMs: 25, settledSequence: null }),
    ]))
  })

  it('preserves reducer errors while recording the failed transition and normalizes cyclic values', () => {
    const timing = clockFixture()
    setMagicEditDiagnosticClock(timing.clock)
    const store = createStore(reducer(timing), applyMiddleware(magicEditMiddleware))
    const cyclic = { label: 'raw' }
    cyclic.self = cyclic

    expect(() => store.dispatch({ type: 'counter/throw', payload: cyclic })).toThrow('reducer exploded')
    const transition = getMagicEditDiagnosticSnapshot().redux.stores[0].transitions[0]
    expect(transition.action.payload).toEqual({
      label: 'raw',
      self: { $magicEditType: 'circular', path: '$.payload' },
    })
    expect(transition.threw).toMatchObject({ $magicEditType: 'error', message: 'reducer exploded' })

    let caught = false
    let thrown
    try {
      store.dispatch({ type: 'counter/throw-undefined' })
    } catch (error) {
      caught = true
      thrown = error
    }
    expect(caught).toBe(true)
    expect(thrown).toBeUndefined()
    expect(getMagicEditDiagnosticSnapshot().redux.stores[0].transitions[1].threw).toEqual({
      $magicEditType: 'undefined',
    })
  })

  it('copies shared references completely while tagging only ancestor cycles', () => {
    const shared = { retained: true }
    const value = { first: shared, second: shared }
    value.self = value
    const timing = clockFixture()
    setMagicEditDiagnosticClock(timing.clock)
    const store = createStore(() => value, applyMiddleware(magicEditMiddleware))

    store.dispatch({ type: 'shared/capture' })

    expect(getMagicEditDiagnosticSnapshot().redux.stores[0].currentState).toEqual({
      first: { retained: true },
      second: { retained: true },
      self: { $magicEditType: 'circular', path: '$' },
    })
  })

  it('retains bounded action history, reports dropped actions, and detects an action storm', () => {
    const timing = clockFixture()
    setMagicEditDiagnosticClock(timing.clock)
    const store = createStore(reducer(timing), applyMiddleware(magicEditMiddleware))
    for (let index = 0; index < 300; index += 1) {
      store.dispatch({ type: 'counter/increment', payload: 1, index })
      timing.advance({ wallMs: 2, monotonicMs: 2 })
    }
    const snapshot = getMagicEditDiagnosticSnapshot()
    expect(snapshot.redux.stores[0].transitions).toHaveLength(200)
    expect(snapshot.redux.stores[0].transitions[0].sequence).toBe(101)
    expect(snapshot.redux.stores[0].droppedTransitions).toBe(100)
    expect(snapshot.redux.stores[0].currentState.count).toBe(300)
    expect(snapshot.summary.actionStorms).toBe(1)
    expect(snapshot.summary).toMatchObject({
      actions: 300,
      retainedActions: 200,
      droppedActions: 100,
    })
  })

  it('records a selected state projection and filters derived diagnostic actions', () => {
    const timing = clockFixture()
    setMagicEditDiagnosticClock(timing.clock)
    const middleware = createMagicEditMiddleware({
      includeStateSnapshots: true,
      maximumTransitions: 2,
      selectAction: action => ({ type: action.type }),
      selectState: state => ({ phase: state.phase, active: state.interaction.active }),
      shouldRecordAction: action => action.type !== 'diagnostics/actionRecorded',
    })
    const store = createStore((state = {
      phase: 'idle',
      interaction: { active: false },
      entities: { hidden: { large: 'value' } },
    }, action) => {
      if (action.type === 'press') return { ...state, phase: 'pressing' }
      if (action.type === 'activate') return {
        ...state,
        interaction: { active: true },
      }
      if (action.type === 'diagnostics/actionRecorded') return {
        ...state,
        entities: { hidden: { large: 'new-value' } },
      }
      return state
    }, applyMiddleware(middleware))

    store.dispatch({ type: 'press' })
    store.dispatch({ type: 'diagnostics/actionRecorded' })
    store.dispatch({ type: 'activate' })

    const snapshot = getMagicEditDiagnosticSnapshot()
    expect(snapshot.redux.stores[0]).toMatchObject({
      currentState: { phase: 'pressing', active: true },
      droppedTransitions: 0,
    })
    expect(snapshot.redux.stores[0].transitions.map(transition => transition.type)).toEqual([
      'press',
      'activate',
    ])
    expect(snapshot.redux.stores[0].transitions.map(transition => transition.action)).toEqual([
      { type: 'press' },
      { type: 'activate' },
    ])
    expect(snapshot.redux.stores[0].transitions[1].stateChanges).toEqual([
      { operation: 'replace', path: ['active'], value: true },
    ])
    expect(snapshot.redux.stores[0].transitions[1].resultingState).toEqual({
      phase: 'pressing',
      active: true,
    })
    expect(JSON.stringify(snapshot)).not.toContain('new-value')
  })

  it('caps unusually broad state changes without losing the latest complete state', () => {
    const timing = clockFixture()
    setMagicEditDiagnosticClock(timing.clock)
    const middleware = createMagicEditMiddleware({ maximumStateChanges: 2 })
    const store = createStore((state = {}, action) =>
      action.type === 'replace' ? { first: 1, second: 2, third: 3 } : state,
    applyMiddleware(middleware))

    store.dispatch({ type: 'replace' })

    const snapshot = getMagicEditDiagnosticSnapshot()
    expect(snapshot.redux.stores[0].currentState).toEqual({ first: 1, second: 2, third: 3 })
    expect(snapshot.redux.stores[0].transitions[0]).toMatchObject({
      stateChangesTruncated: true,
      stateChanges: [
        { operation: 'add', path: ['first'], value: 1 },
        { operation: 'add', path: ['second'], value: 2 },
      ],
    })
  })
})

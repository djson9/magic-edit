import { applyMiddleware, createStore } from 'redux'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { magicEditMiddleware } from '../dist/redux.cjs'
import {
  getMagicEditDiagnosticSnapshot,
  resetMagicEditDiagnostics,
  setMagicEditDiagnosticClock,
} from '../dist/redux-testing.cjs'

class FakeHeaders {
  constructor(values = {}) { this.values = values }
  forEach(callback) { for (const [key, value] of Object.entries(this.values)) callback(value, key) }
  get(name) {
    const entry = Object.entries(this.values).find(([key]) => key.toLowerCase() === name.toLowerCase())
    return entry?.[1] ?? null
  }
}

class FakeXHR {
  static instances = []
  listeners = new Map()
  headers = {}
  responseHeaders = 'content-length: 7\r\nx-raw: yes\r\n'
  responseText = 'payload'
  responseType = ''
  status = 0
  constructor() { FakeXHR.instances.push(this) }
  open(method, url) { this.method = method; this.url = url }
  setRequestHeader(name, value) { this.headers[name] = value }
  addEventListener(name, listener) {
    const listeners = this.listeners.get(name) ?? []
    listeners.push(listener)
    this.listeners.set(name, listeners)
  }
  send(body) { this.body = body }
  getAllResponseHeaders() { return this.responseHeaders }
  emit(name) { for (const listener of this.listeners.get(name) ?? []) listener() }
}

describe('automatic network diagnostics', () => {
  let originalFetch
  let originalXHR
  let wall
  let monotonic

  beforeEach(() => {
    resetMagicEditDiagnostics()
    originalFetch = globalThis.fetch
    originalXHR = globalThis.XMLHttpRequest
    wall = Date.parse('2026-09-11T12:00:00.000Z')
    monotonic = 100
    setMagicEditDiagnosticClock({ now: () => wall, monotonicNow: () => monotonic })
    FakeXHR.instances = []
    globalThis.XMLHttpRequest = FakeXHR
  })

  afterEach(() => {
    resetMagicEditDiagnostics()
    globalThis.fetch = originalFetch
    globalThis.XMLHttpRequest = originalXHR
  })

  it('captures raw fetch details and correlates surrounding Redux actions without changing the response', async () => {
    const response = {
      ok: true,
      status: 201,
      headers: new FakeHeaders({ 'content-length': '9', 'x-response-token': 'raw-secret' }),
    }
    globalThis.fetch = vi.fn(async () => response)
    const store = createStore((state = 0, action) => action.type === 'step' ? state + 1 : state, applyMiddleware(magicEditMiddleware))
    store.dispatch({ type: 'step' })
    const request = fetch('https://example.test/items/123?token=unredacted', {
      method: 'POST',
      headers: { Authorization: 'Bearer unredacted' },
      body: 'request-body',
    })
    store.dispatch({ type: 'step' })
    wall += 50
    monotonic += 50

    await expect(request).resolves.toBe(response)
    const record = getMagicEditDiagnosticSnapshot().network.requests[0]
    expect(record).toMatchObject({
      transport: 'fetch',
      method: 'POST',
      url: 'https://example.test/items/123?token=unredacted',
      requestHeaders: { Authorization: 'Bearer unredacted' },
      requestBytes: 12,
      responseHeaders: { 'content-length': '9', 'x-response-token': 'raw-secret' },
      responseBytes: 9,
      status: 201,
      outcome: 'success',
      reduxSequenceAtStart: 1,
      reduxSequenceAtEnd: 2,
      durationMs: 50,
    })
  })

  it('captures concurrent failures and probable retries while excluding its own upload', async () => {
    const requests = []
    globalThis.fetch = vi.fn((_input, init) => new Promise((resolve, reject) => requests.push({ init, resolve, reject })))
    createStore(state => state ?? {}, applyMiddleware(magicEditMiddleware))
    const first = fetch('https://example.test/retry')
    const concurrent = fetch('https://example.test/other')
    requests[0].reject(Object.assign(new Error('offline'), { name: 'NetworkError' }))
    await expect(first).rejects.toThrow('offline')
    const retry = fetch('https://example.test/retry')
    requests[1].resolve({ status: 500, headers: new FakeHeaders() })
    requests[2].resolve({ status: 200, headers: new FakeHeaders() })
    await concurrent
    await retry
    const internal = fetch('https://magicedit.dev/api/v1/captures', {
      headers: { 'X-Magic-Edit-Internal': 'capture-upload' },
    })
    requests[3].resolve({ status: 201, headers: new FakeHeaders() })
    await internal

    const records = getMagicEditDiagnosticSnapshot().network.requests
    expect(records).toHaveLength(3)
    expect(records[0]).toMatchObject({ outcome: 'network_error', concurrencyAtStart: 1 })
    expect(records[1]).toMatchObject({ outcome: 'http_error', concurrencyAtStart: 2 })
    expect(records[2]).toMatchObject({ outcome: 'success', retryOfSequence: 1 })
  })

  it('captures XHR headers, body size, status, response size, and abort outcome', () => {
    createStore(state => state ?? {}, applyMiddleware(magicEditMiddleware))
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', 'https://example.test/raw?id=44')
    xhr.setRequestHeader('Authorization', 'raw-xhr-secret')
    xhr.send('hello')
    monotonic += 25
    wall += 25
    xhr.status = 0
    xhr.emit('abort')
    xhr.emit('loadend')

    expect(getMagicEditDiagnosticSnapshot().network.requests[0]).toMatchObject({
      transport: 'xhr',
      method: 'PUT',
      url: 'https://example.test/raw?id=44',
      requestHeaders: { Authorization: 'raw-xhr-secret' },
      requestBytes: 5,
      responseHeaders: { 'content-length': '7', 'x-raw': 'yes' },
      responseBytes: 7,
      outcome: 'aborted',
      durationMs: 25,
    })
  })
})

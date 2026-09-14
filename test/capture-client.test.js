import { applyMiddleware, createStore } from 'redux'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMagicEditMiddleware } from '../dist/redux.cjs'
import {
  getMagicEditDiagnosticSnapshot,
  resetMagicEditDiagnostics,
} from '../dist/redux-testing.cjs'
import { uploadMagicEditCapture } from '../src/diagnostics/capture-client'

describe('diagnostic capture preparation', () => {
  beforeEach(() => resetMagicEditDiagnostics())

  it('returns client timings and records serialization size without adding it to the upload recorder', async () => {
    const store = createStore(
      (state = { phase: 'idle' }, action) =>
        action.type === 'activate' ? { phase: 'active' } : state,
      applyMiddleware(createMagicEditMiddleware()),
    )
    store.dispatch({ type: 'activate' })
    let uploadedBody = ''
    const fetcher = vi.fn(async (_url, init) => {
      uploadedBody = String(init.body)
      return {
        ok: true,
        json: async () => ({
          ok: true,
          captureId: 'f38c5bc2-703d-492a-aab0-27d6dd24a45a',
          captureUrl: 'https://magicedit.dev/api/v1/captures/f38c5bc2-703d-492a-aab0-27d6dd24a45a',
          latestUrl: 'https://magicedit.dev/api/v1/captures/latest?appId=fixture',
          storedAt: '2026-09-14T14:00:00.000Z',
          byteSize: 1,
        }),
      }
    })

    const receipt = await uploadMagicEditCapture(fetcher)

    expect(receipt.clientTiming).toMatchObject({
      snapshotDurationMs: expect.any(Number),
      serializationDurationMs: expect.any(Number),
      uploadDurationMs: expect.any(Number),
      totalDurationMs: expect.any(Number),
    })
    const prepared = getMagicEditDiagnosticSnapshot().runtimeEvents.find(
      event => event.type === 'capture_prepared',
    )
    expect(prepared.details).toMatchObject({
      byteSize: Buffer.byteLength(uploadedBody),
      serializationDurationMs: expect.any(Number),
      snapshotDurationMs: expect.any(Number),
    })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})

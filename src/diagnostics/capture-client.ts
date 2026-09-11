import { diagnosticRuntime } from './runtime'
import { utf8ByteLength } from './normalize'

export const MAGIC_EDIT_CAPTURE_ENDPOINT = 'https://magicedit.dev/api/v1/captures'

export type MagicEditCaptureReceipt = {
  ok: true
  captureId: string
  captureUrl: string
  latestUrl: string
  storedAt: string
  byteSize: number
}

function receipt(value: unknown): MagicEditCaptureReceipt {
  if (!value || typeof value !== 'object') throw new Error('Magic Edit returned an invalid capture receipt.')
  const candidate = value as Record<string, unknown>
  if (
    candidate.ok !== true ||
    typeof candidate.captureId !== 'string' ||
    typeof candidate.captureUrl !== 'string' ||
    typeof candidate.latestUrl !== 'string' ||
    typeof candidate.storedAt !== 'string' ||
    typeof candidate.byteSize !== 'number'
  ) throw new Error('Magic Edit returned an invalid capture receipt.')
  return candidate as MagicEditCaptureReceipt
}

export async function uploadMagicEditCapture(fetcher: typeof fetch = fetch) {
  const runtime = diagnosticRuntime()
  runtime.recordRuntimeEvent('capture_upload_started')
  const snapshot = runtime.snapshot()
  const body = JSON.stringify(snapshot)
  const appId = typeof snapshot.app.id === 'string' && snapshot.app.id.trim()
    ? snapshot.app.id.trim()
    : 'unknown-app'
  const started = typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
  try {
    const response = await fetcher(MAGIC_EDIT_CAPTURE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Magic-Edit-App-Id': appId,
        'X-Magic-Edit-Internal': 'capture-upload',
        'X-Magic-Edit-Schema-Version': '1',
      },
      body,
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      const code = payload && typeof payload === 'object' && typeof (payload as Record<string, unknown>).error === 'string'
        ? (payload as Record<string, unknown>).error
        : `HTTP ${response.status}`
      throw new Error(`Magic Edit capture failed: ${code}`)
    }
    const result = receipt(payload)
    runtime.recordRuntimeEvent('capture_upload_succeeded', {
      captureId: result.captureId,
      byteSize: utf8ByteLength(body),
      durationMs: (typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()) - started,
    })
    return result
  } catch (error) {
    runtime.recordRuntimeEvent('capture_upload_failed', {
      error,
      byteSize: utf8ByteLength(body),
      durationMs: (typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()) - started,
    })
    throw error
  }
}

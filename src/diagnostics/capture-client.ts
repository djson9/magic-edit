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
  clientTiming: {
    snapshotDurationMs: number
    serializationDurationMs: number
    uploadDurationMs: number
    totalDurationMs: number
  }
}

type MagicEditCaptureServerReceipt = Omit<MagicEditCaptureReceipt, 'clientTiming'>

function receipt(value: unknown): MagicEditCaptureServerReceipt {
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
  return candidate as MagicEditCaptureServerReceipt
}

function monotonicNow() {
  const candidate = (globalThis as { performance?: { now?: () => number } }).performance
  return typeof candidate?.now === 'function' ? candidate.now() : Date.now()
}

export async function uploadMagicEditCapture(fetcher: typeof fetch = fetch) {
  const runtime = diagnosticRuntime()
  const totalStarted = monotonicNow()
  runtime.recordRuntimeEvent('capture_upload_started')
  const snapshotStarted = monotonicNow()
  const snapshot = runtime.snapshot()
  const snapshotDurationMs = monotonicNow() - snapshotStarted
  const serializationStarted = monotonicNow()
  const body = JSON.stringify(snapshot)
  const serializationDurationMs = monotonicNow() - serializationStarted
  const bodyByteSize = utf8ByteLength(body)
  runtime.recordRuntimeEvent('capture_prepared', {
    byteSize: bodyByteSize,
    serializationDurationMs,
    snapshotDurationMs,
  })
  const appId = typeof snapshot.app.id === 'string' && snapshot.app.id.trim()
    ? snapshot.app.id.trim()
    : 'unknown-app'
  const started = monotonicNow()
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
    const uploadDurationMs = monotonicNow() - started
    runtime.recordRuntimeEvent('capture_upload_succeeded', {
      captureId: result.captureId,
      byteSize: bodyByteSize,
      durationMs: uploadDurationMs,
    })
    return {
      ...result,
      clientTiming: {
        snapshotDurationMs,
        serializationDurationMs,
        uploadDurationMs,
        totalDurationMs: monotonicNow() - totalStarted,
      },
    }
  } catch (error) {
    runtime.recordRuntimeEvent('capture_upload_failed', {
      error,
      byteSize: bodyByteSize,
      durationMs: monotonicNow() - started,
    })
    throw error
  }
}

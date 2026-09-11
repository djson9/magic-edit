import { utf8ByteLength } from './normalize'

type RuntimeNetworkSink = {
  beginNetwork(details: Record<string, unknown>): number
  completeNetwork(sequence: number, details: Record<string, unknown>): void
  recordError(code: string, error: unknown): void
}

type NetworkInstallation = {
  fetch?: typeof fetch
  xhrOpen?: (...args: unknown[]) => unknown
  xhrSend?: (...args: unknown[]) => unknown
  xhrSetRequestHeader?: (...args: unknown[]) => unknown
}

type FetchInit = {
  method?: string
  headers?: unknown
  body?: unknown
}

type ResponseLike = {
  status: number
  headers?: {
    get?(name: string): string | null
    forEach?(callback: (value: string, key: string) => void): void
  }
}

const INSTALLATION_KEY = Symbol.for('@djson9/magic-edit/network-installation/v1')
const XHR_RECORD_KEY = Symbol.for('@djson9/magic-edit/xhr-record/v1')

function headersRecord(headers: unknown): Record<string, string> {
  const result: Record<string, string> = {}
  if (!headers) return result
  try {
    if (typeof (headers as { forEach?: unknown }).forEach === 'function') {
      ;(headers as { forEach(callback: (value: string, key: string) => void): void })
        .forEach((value, key) => { result[String(key)] = String(value) })
      return result
    }
    if (Array.isArray(headers)) {
      for (const entry of headers) {
        if (Array.isArray(entry) && entry.length >= 2) result[String(entry[0])] = String(entry[1])
      }
      return result
    }
    if (typeof headers === 'object') {
      for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
        result[key] = Array.isArray(value) ? value.map(String).join(', ') : String(value)
      }
    }
  } catch {
    return result
  }
  return result
}

function internalUpload(headers: Record<string, string>) {
  return Object.entries(headers).some(([key, value]) =>
    key.toLowerCase() === 'x-magic-edit-internal' && value === 'capture-upload')
}

function bodyBytes(body: unknown): number | null {
  if (typeof body === 'string') return utf8ByteLength(body)
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
    return utf8ByteLength(body.toString())
  }
  if (typeof Blob !== 'undefined' && body instanceof Blob) return body.size
  if (body instanceof ArrayBuffer) return body.byteLength
  if (ArrayBuffer.isView(body)) return body.byteLength
  return null
}

function requestDetails(input: unknown, init?: FetchInit) {
  const request = typeof Request !== 'undefined' && input instanceof Request ? input : null
  const initHeaders = headersRecord(init?.headers)
  const requestHeaders = Object.keys(initHeaders).length ? initHeaders : headersRecord(request?.headers)
  return {
    method: String(init?.method || request?.method || 'GET').toUpperCase(),
    url: String(request?.url || input),
    requestHeaders,
    requestBytes: bodyBytes(init?.body),
  }
}

function responseBytes(response: ResponseLike) {
  const contentLength = response.headers?.get?.('content-length')
  if (contentLength && /^\d+$/.test(contentLength)) return Number(contentLength)
  return null
}

function responseOutcome(response: ResponseLike) {
  return response.status >= 400 ? 'http_error' : 'success'
}

function errorOutcome(error: unknown) {
  const name = error && typeof error === 'object' ? String((error as { name?: unknown }).name ?? '') : ''
  return name === 'AbortError' ? 'aborted' : name === 'TimeoutError' ? 'timeout' : 'network_error'
}

function xhrResponseHeaders(xhr: XMLHttpRequest) {
  const result: Record<string, string> = {}
  try {
    const raw = xhr.getAllResponseHeaders?.() || ''
    for (const line of raw.trim().split(/[\r\n]+/)) {
      const separator = line.indexOf(':')
      if (separator > 0) result[line.slice(0, separator).trim()] = line.slice(separator + 1).trim()
    }
  } catch {
    return result
  }
  return result
}

function xhrResponseBytes(xhr: XMLHttpRequest) {
  const headers = xhrResponseHeaders(xhr)
  const length = Object.entries(headers).find(([key]) => key.toLowerCase() === 'content-length')?.[1]
  if (length && /^\d+$/.test(length)) return Number(length)
  try {
    if (xhr.responseType === '' || xhr.responseType === 'text') return utf8ByteLength(xhr.responseText || '')
    if (xhr.response instanceof ArrayBuffer) return xhr.response.byteLength
    if (typeof Blob !== 'undefined' && xhr.response instanceof Blob) return xhr.response.size
  } catch {
    return null
  }
  return null
}

export function installNetworkRecorder(runtime: RuntimeNetworkSink) {
  const root = globalThis as typeof globalThis & { [INSTALLATION_KEY]?: NetworkInstallation }
  if (root[INSTALLATION_KEY]) return
  const installation: NetworkInstallation = {}

  if (typeof root.fetch === 'function') {
    const originalFetch = root.fetch
    installation.fetch = originalFetch
    root.fetch = function magicEditFetch(this: unknown, ...args: Parameters<typeof originalFetch>) {
      const [input, init] = args
      const details = requestDetails(input, init)
      if (internalUpload(details.requestHeaders)) return originalFetch.apply(this, args)
      const sequence = runtime.beginNetwork({ transport: 'fetch', ...details })
      let request: ReturnType<typeof originalFetch>
      try {
        request = originalFetch.apply(this, args)
      } catch (error) {
        runtime.completeNetwork(sequence, { outcome: errorOutcome(error), error })
        throw error
      }
      return request.then(response => {
        runtime.completeNetwork(sequence, {
          status: response.status,
          outcome: responseOutcome(response),
          responseHeaders: headersRecord(response.headers),
          responseBytes: responseBytes(response),
        })
        return response
      }, error => {
        runtime.completeNetwork(sequence, { outcome: errorOutcome(error), error })
        throw error
      })
    }
  }

  const XHR = root.XMLHttpRequest
  if (typeof XHR === 'function' && XHR.prototype) {
    const prototype = XHR.prototype as XMLHttpRequest & Record<PropertyKey, unknown>
    const originalOpen = prototype.open as unknown as (...args: unknown[]) => unknown
    const originalSend = prototype.send as unknown as (...args: unknown[]) => unknown
    const originalSetRequestHeader = prototype.setRequestHeader as unknown as (...args: unknown[]) => unknown
    installation.xhrOpen = originalOpen
    installation.xhrSend = originalSend
    installation.xhrSetRequestHeader = originalSetRequestHeader

    prototype.open = function magicEditOpen(this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
      ;(this as unknown as Record<PropertyKey, unknown>)[XHR_RECORD_KEY] = {
        method: String(method).toUpperCase(),
        url: String(url),
        requestHeaders: {},
      }
      return originalOpen.apply(this, [method, url, ...rest])
    } as typeof prototype.open
    prototype.setRequestHeader = function magicEditSetRequestHeader(this: XMLHttpRequest, name: string, value: string) {
      const metadata = (this as unknown as Record<PropertyKey, unknown>)[XHR_RECORD_KEY] as Record<string, unknown> | undefined
      const headers = metadata?.requestHeaders as Record<string, string> | undefined
      if (headers) headers[name] = headers[name] ? `${headers[name]}, ${value}` : String(value)
      return originalSetRequestHeader.apply(this, [name, value])
    } as typeof prototype.setRequestHeader
    prototype.send = function magicEditSend(this: XMLHttpRequest, body?: unknown) {
      const metadata = (this as unknown as Record<PropertyKey, unknown>)[XHR_RECORD_KEY] as Record<string, unknown> | undefined
      const requestHeaders = headersRecord(metadata?.requestHeaders)
      if (!metadata || internalUpload(requestHeaders)) return originalSend.apply(this, [body])
      const xhr = this as unknown as XMLHttpRequest
      const sequence = runtime.beginNetwork({
        transport: 'xhr',
        method: metadata.method,
        url: metadata.url,
        requestHeaders,
        requestBytes: bodyBytes(body),
      })
      let settled = false
      let forcedOutcome: string | null = null
      const settle = () => {
        if (settled) return
        settled = true
        const status = Number(xhr.status) || 0
        runtime.completeNetwork(sequence, {
          status,
          outcome: forcedOutcome || (status === 0 ? 'network_error' : status >= 400 ? 'http_error' : 'success'),
          responseHeaders: xhrResponseHeaders(xhr),
          responseBytes: xhrResponseBytes(xhr),
        })
      }
      xhr.addEventListener('abort', () => { forcedOutcome = 'aborted' })
      xhr.addEventListener('timeout', () => { forcedOutcome = 'timeout' })
      xhr.addEventListener('error', () => { forcedOutcome = 'network_error' })
      xhr.addEventListener('loadend', settle)
      try {
        return originalSend.apply(this, [body])
      } catch (error) {
        forcedOutcome = errorOutcome(error)
        settle()
        throw error
      }
    } as typeof prototype.send
  }

  root[INSTALLATION_KEY] = installation
}

export function restoreNetworkRecorderForTests() {
  const root = globalThis as typeof globalThis & { [INSTALLATION_KEY]?: NetworkInstallation }
  const installation = root[INSTALLATION_KEY]
  if (!installation) return
  if (installation.fetch) root.fetch = installation.fetch
  const XHR = root.XMLHttpRequest
  if (typeof XHR === 'function' && XHR.prototype) {
    if (installation.xhrOpen) XHR.prototype.open = installation.xhrOpen as typeof XHR.prototype.open
    if (installation.xhrSend) XHR.prototype.send = installation.xhrSend as typeof XHR.prototype.send
    if (installation.xhrSetRequestHeader) {
      XHR.prototype.setRequestHeader = installation.xhrSetRequestHeader as typeof XHR.prototype.setRequestHeader
    }
  }
  delete root[INSTALLATION_KEY]
}

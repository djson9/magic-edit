type TaggedValue = Record<string, unknown>

function tag(type: string, values: Record<string, unknown> = {}): TaggedValue {
  return { $magicEditType: type, ...values }
}

function objectName(value: object) {
  try {
    return value.constructor?.name || 'Object'
  } catch {
    return 'Object'
  }
}

function bytesFromView(value: ArrayBuffer | ArrayBufferView) {
  const bytes = value instanceof ArrayBuffer
    ? new Uint8Array(value)
    : new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  return Array.from(bytes)
}

/** Convert an arbitrary JavaScript graph into JSON-safe data without filtering or truncation. */
export function normalizeDiagnosticValue(value: unknown): unknown {
  const seen = new WeakMap<object, string>()

  const visit = (candidate: unknown, path: string): unknown => {
    if (candidate === null || typeof candidate === 'string' || typeof candidate === 'boolean') {
      return candidate
    }
    if (typeof candidate === 'number') {
      return Number.isFinite(candidate) ? candidate : tag('number', { value: String(candidate) })
    }
    if (typeof candidate === 'undefined') return tag('undefined')
    if (typeof candidate === 'bigint') return tag('bigint', { value: candidate.toString() })
    if (typeof candidate === 'symbol') return tag('symbol', { value: candidate.description ?? '' })
    if (typeof candidate === 'function') {
      return tag('function', { name: candidate.name || '', source: String(candidate) })
    }
    if (typeof candidate !== 'object') return tag(typeof candidate, { value: String(candidate) })

    const previousPath = seen.get(candidate)
    if (previousPath) return tag('circular', { path: previousPath })
    seen.set(candidate, path)

    if (candidate instanceof Date) {
      return tag('date', { value: Number.isNaN(candidate.getTime()) ? 'Invalid Date' : candidate.toISOString() })
    }
    if (candidate instanceof Error) {
      const normalized: Record<string, unknown> = {
        name: candidate.name,
        message: candidate.message,
        stack: candidate.stack ?? null,
      }
      for (const key of Object.keys(candidate)) {
        try {
          normalized[key] = visit((candidate as unknown as Record<string, unknown>)[key], `${path}.${key}`)
        } catch (error) {
          normalized[key] = tag('property-error', { error: String(error) })
        }
      }
      return tag('error', normalized)
    }
    if (candidate instanceof Map) {
      return tag('map', {
        entries: Array.from(candidate.entries(), ([key, entry], index) => [
          visit(key, `${path}.mapKey[${index}]`),
          visit(entry, `${path}.mapValue[${index}]`),
        ]),
      })
    }
    if (candidate instanceof Set) {
      return tag('set', {
        values: Array.from(candidate.values(), (entry, index) => visit(entry, `${path}.set[${index}]`)),
      })
    }
    if (candidate instanceof ArrayBuffer || ArrayBuffer.isView(candidate)) {
      return tag(objectName(candidate), { bytes: bytesFromView(candidate as ArrayBuffer | ArrayBufferView) })
    }
    if (Array.isArray(candidate)) {
      return candidate.map((entry, index) => visit(entry, `${path}[${index}]`))
    }

    const normalized: Record<string, unknown> = {}
    const prototypeName = objectName(candidate)
    if (prototypeName !== 'Object') normalized.$magicEditPrototype = prototypeName
    for (const key of Object.keys(candidate)) {
      try {
        Object.defineProperty(normalized, key, {
          configurable: true,
          enumerable: true,
          writable: true,
          value: visit((candidate as Record<string, unknown>)[key], `${path}.${key}`),
        })
      } catch (error) {
        Object.defineProperty(normalized, key, {
          configurable: true,
          enumerable: true,
          writable: true,
          value: tag('property-error', { error: String(error) }),
        })
      }
    }
    return normalized
  }

  return visit(value, '$')
}

export function utf8ByteLength(value: string) {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(value).byteLength
  let bytes = 0
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code < 0x80) bytes += 1
    else if (code < 0x800) bytes += 2
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      bytes += 4
      index += 1
    } else bytes += 3
  }
  return bytes
}

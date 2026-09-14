import { normalizeDiagnosticValue } from './normalize'

export type DiagnosticStateChange = {
  operation: 'add' | 'remove' | 'replace'
  path: Array<string | number>
  value?: unknown
}

export type DiagnosticStateChanges = {
  changes: DiagnosticStateChange[]
  truncated: boolean
}

function traversable(value: unknown): value is Record<string, unknown> | unknown[] {
  if (!value || typeof value !== 'object') return false
  if (Array.isArray(value)) return true
  try {
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
  } catch {
    return false
  }
}

function sameContainer(left: unknown, right: unknown) {
  return traversable(left) && traversable(right) && Array.isArray(left) === Array.isArray(right)
}

export function diagnosticStateChanges(
  before: unknown,
  after: unknown,
  maximumChanges: number,
): DiagnosticStateChanges {
  const changes: DiagnosticStateChange[] = []
  let truncated = false
  const ancestorPairs = new WeakMap<object, WeakSet<object>>()

  const append = (change: DiagnosticStateChange) => {
    if (changes.length >= maximumChanges) {
      truncated = true
      return false
    }
    changes.push(change)
    return true
  }

  const compare = (left: unknown, right: unknown, path: Array<string | number>) => {
    if (left === right || truncated) return
    if (!sameContainer(left, right)) {
      append({ operation: 'replace', path, value: normalizeDiagnosticValue(right) })
      return
    }

    const leftObject = left as object
    const rightObject = right as object
    const seenRights = ancestorPairs.get(leftObject) ?? new WeakSet<object>()
    if (seenRights.has(rightObject)) {
      append({ operation: 'replace', path, value: normalizeDiagnosticValue(right) })
      return
    }
    seenRights.add(rightObject)
    ancestorPairs.set(leftObject, seenRights)

    const leftRecord = left as Record<string, unknown>
    const rightRecord = right as Record<string, unknown>
    try {
      const leftKeys = Object.keys(leftRecord)
      const rightKeys = Object.keys(rightRecord)
      const rightKeySet = new Set(rightKeys)

      for (const key of leftKeys) {
        if (truncated) return
        if (!rightKeySet.has(key)) {
          append({
            operation: 'remove',
            path: [...path, Array.isArray(right) ? Number(key) : key],
          })
        }
      }

      const leftKeySet = new Set(leftKeys)
      for (const key of rightKeys) {
        if (truncated) return
        const segment = Array.isArray(right) ? Number(key) : key
        let rightValue: unknown
        try {
          rightValue = rightRecord[key]
        } catch (error) {
          append({ operation: 'replace', path: [...path, segment], value: normalizeDiagnosticValue(error) })
          continue
        }
        if (!leftKeySet.has(key)) {
          append({ operation: 'add', path: [...path, segment], value: normalizeDiagnosticValue(rightValue) })
          continue
        }
        let leftValue: unknown
        try {
          leftValue = leftRecord[key]
        } catch {
          append({ operation: 'replace', path: [...path, segment], value: normalizeDiagnosticValue(rightValue) })
          continue
        }
        compare(leftValue, rightValue, [...path, segment])
      }
    } finally {
      seenRights.delete(rightObject)
    }
  }

  compare(before, after, [])
  return { changes, truncated }
}

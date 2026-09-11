import type { DiagnosticClock } from '../src/diagnostics/runtime'
import { diagnosticRuntime } from '../src/diagnostics/runtime'

export function resetMagicEditDiagnostics() {
  diagnosticRuntime().resetForTests()
}

export function setMagicEditDiagnosticClock(clock: DiagnosticClock) {
  diagnosticRuntime().setClockForTests(clock)
}

export function getMagicEditDiagnosticSnapshot() {
  return diagnosticRuntime().snapshot()
}

export function registerMagicEditAppMetadata(metadata: Record<string, unknown>) {
  diagnosticRuntime().registerAppMetadata(metadata)
}

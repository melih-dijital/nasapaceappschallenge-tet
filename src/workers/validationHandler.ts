// Ayrı doğrulama Web Worker mesaj işleyicisi (FAZ_08 §3.5).
// Canlı simülasyon worker'ını (`sim.worker.ts`) bloklamadan REQUEST_VALIDATION / CANCEL_VALIDATION yürütür.
import { runSuiteAsync, type ValidationReport } from '../core/validation'
import type { UiToWorkerMessage, WorkerToUiMessage } from './protocol'
import { parseUiToWorkerMessage } from './protocolSchema'

export interface ValidationWorkerHandlerDeps {
  postMessage: (message: WorkerToUiMessage) => void
  /** Olay döngüsüne nefes aldırıp iptal mesajlarının işlenmesini sağlayan kanca. */
  yieldTurn?: () => Promise<void>
}

export interface ValidationWorkerHandler {
  handleMessage(raw: unknown): void
  isRunning(): boolean
  dispose(): void
}

export function createValidationWorkerHandler(
  deps: ValidationWorkerHandlerDeps,
): ValidationWorkerHandler {
  let activeRunId = 0
  let running = false
  let disposed = false

  const startValidation = (msg: Extract<UiToWorkerMessage, { type: 'REQUEST_VALIDATION' }>): void => {
    const runId = ++activeRunId
    running = true

    const isCancelled = (): boolean => disposed || runId !== activeRunId

    void runSuiteAsync({
      ...(msg.scenarios ? { scenarios: msg.scenarios } : {}),
      ...(msg.seeds ? { seeds: msg.seeds } : {}),
      ...(msg.quick !== undefined ? { quick: msg.quick } : {}),
      onProgress: (done, total) => {
        if (isCancelled()) return
        deps.postMessage({ type: 'VALIDATION_PROGRESS', done, total })
      },
      isCancelled,
      ...(deps.yieldTurn ? { yieldTurn: deps.yieldTurn } : {}),
    })
      .then((report: ValidationReport | null) => {
        if (runId !== activeRunId || disposed) return
        running = false
        if (report) {
          deps.postMessage({ type: 'VALIDATION_RESULT', report })
        }
      })
      .catch((err: unknown) => {
        if (runId !== activeRunId || disposed) return
        running = false
        deps.postMessage({
          type: 'ERROR',
          code: 'VALIDATION_FAILED',
          message: err instanceof Error ? err.message : String(err),
        })
      })
  }

  return {
    handleMessage(raw: unknown): void {
      if (disposed) return
      const parsed = parseUiToWorkerMessage(raw)
      if (!parsed.ok) {
        deps.postMessage({ type: 'ERROR', code: 'INVALID_MESSAGE', message: parsed.error })
        return
      }
      const msg = parsed.data
      if (msg.type === 'CANCEL_VALIDATION') {
        activeRunId += 1
        running = false
        return
      }
      if (msg.type === 'REQUEST_VALIDATION') {
        startValidation(msg)
        return
      }
      deps.postMessage({
        type: 'ERROR',
        code: 'UNSUPPORTED_COMMAND',
        message: `validation.worker "${msg.type}" komutunu işlemez.`,
      })
    },
    isRunning(): boolean {
      return running
    },
    dispose(): void {
      disposed = true
      activeRunId += 1
      running = false
    },
  }
}

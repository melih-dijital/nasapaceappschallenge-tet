// Doğrulama Web Worker giriş noktası (FAZ_08 §3.5). Canlı simülasyondan ayrı iş parçacığında çalışır.
import '../core/schema/jitless'
import type { WorkerToUiMessage } from './protocol'
import { createValidationWorkerHandler } from './validationHandler'

const post = (message: WorkerToUiMessage): void => {
  globalThis.postMessage(message)
}

const handler = createValidationWorkerHandler({
  postMessage: post,
  yieldTurn: () =>
    new Promise((resolve) => {
      globalThis.setTimeout(resolve, 0)
    }),
})

globalThis.onmessage = (event: MessageEvent<unknown>): void => {
  handler.handleMessage(event.data)
}

post({ type: 'READY' })
